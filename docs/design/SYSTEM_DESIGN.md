# SFEN 공통 시스템 설계

이 문서는 B0-A/B/C에서 코드와 Migration에 반영된 공통 기반을 설명한다. 실제 회원가입·승인·로그인 UI, 비밀번호 변경 업무와 B1~B6 업무 Transaction은 아직 구현되지 않았다.

## 기술 스택

- React 19 + Vite 8 + TypeScript 6
- Tailwind CSS 4 + shadcn/ui 방식의 공통 UI 컴포넌트
- Supabase JavaScript Client 2
- PostgreSQL/Supabase Migration 및 pgTAP DB 테스트
- Vitest + Testing Library TypeScript 테스트

브라우저용 Supabase 설정은 `VITE_SUPABASE_URL`과 `VITE_SUPABASE_ANON_KEY`를 사용한다. 실제 값은 저장소에 포함하지 않는다.

## B0-A 데이터 모델

`supabase/migrations/20261108000100_b0_a_core_foundation.sql`은 다음 6개 테이블을 정의한다.

| 테이블 | 주요 필드 및 제약 |
| --- | --- |
| `app_users` | `user_id` PK, nullable `auth_user_id` UUID UNIQUE, 이름, 역할, 재학 상태, 승인 상태, 이용 자격, 정지 유형/기한, 졸업 연도, 증명서 경로. 일반 사용자 ID는 8자리 숫자이며 관리자 ID는 별도 형식을 허용한다. 비밀번호 필드는 없다. |
| `stations` | UUID PK, 이름, 위치, `slot_capacity >= 0`. |
| `batteries` | UUID PK, 모델, `capacity > 0`, `cycle_life >= 1`, `used_count >= 0`, 상태, nullable station FK, `current_charge` 0~100, 충전 시작/폐기 확인 시각. |
| `rentals` | UUID PK, user/battery/rental station FK, 대여 시각, nullable return station/return time, 패널티, 보상 배수, 보상 확인 시각. 반납 시각은 대여 시각보다 빠를 수 없고 보상 배수는 0, 1, 3만 허용한다. |
| `battery_status_history` | UUID PK, battery FK, nullable 이전 상태, 이후 상태, 변경 시각/사용자/station/사유/rental. 최초 등록은 이전 상태가 `NULL`이고 이후 상태가 `Charging`이어야 한다. |
| `system_settings` | `settings_id = 1`인 단일 행. 기본값은 대여 7일, 장기 60일, 시간 배율 1, 배터리 단가 30,000원이다. 모든 수치는 양수이며 장기 기준은 대여 기간보다 길다. |

FK 삭제 동작은 `RESTRICT`이며 조회용 인덱스가 포함된다. B0-B Migration은 `app_users.auth_user_id`가 `auth.users.id`를 참조하도록 연결하며 Auth 사용자가 삭제되면 연결값을 `NULL`로 만든다. Migration 파일과 pgTAP 검증 코드는 존재하며, 실제 환경 적용 여부는 별도로 확인해야 한다.

## Battery 상태와 전이

상태는 `Charging`, `Available`, `Rented`, `Overdue`, `Lost`, `UnderRepair`, `Disposed`의 7개다.

| 현재 상태 | 허용되는 다음 상태 |
| --- | --- |
| 최초 등록 (`NULL`) | `Charging` |
| `Charging` | `Available`, `UnderRepair`, `Disposed` |
| `Available` | `Rented` |
| `Rented` | `Charging`, `Overdue`, `Lost` |
| `Overdue` | `Charging`, `Lost`, `Disposed` |
| `Lost` | `Disposed` |
| `UnderRepair` | `Charging`, `Disposed` |
| `Disposed` | 없음 |

`Disposed`는 종료 상태다. 같은 상태에서 위치만 바꾸는 재배치는 `Charging`, `Available`, `UnderRepair`에 한해 명시적인 relocation 이벤트로 허용된다. 전이 그래프는 현재 TypeScript 공통 검사 로직에 구현되어 있으며, DB Transaction/RPC로 강제하는 기능은 아직 없다.

## 공통 재고 규칙

- 대여 가능한 상태는 `Available`뿐이다.
- Station 슬롯은 `Charging`, `Available`, `UnderRepair` 상태만 점유한다.
- Available 재고 수량은 별도 집계 테이블 없이 `batteries`에서 계산한다.
- 활성 미반납 Rental은 `return_time IS NULL`이면서 Battery 상태가 `Rented` 또는 `Overdue`인 경우다.
- 최초 상태 이력은 `from_status = NULL`, `to_status = Charging`이다.
- 실제 대여·반납·재배치 Transaction은 이후 단계에서 구현한다.

## 인증 기반

- 일반 사용자 로그인 ID는 8자리 학번이다.
- 공통 변환 함수가 학번을 `{학번}@students.sfen.invalid` 형식의 내부 가상 이메일로 변환한다.
- 클라이언트 공통 함수는 이 이메일과 사용자가 입력한 비밀번호를 Supabase Auth에 전달한다. 비밀번호는 애플리케이션 DB에 저장하지 않는다.
- 공개 Supabase Auth 회원가입은 비활성화한다.
- 학생 Auth 계정 생성과 이메일 확인은 관리자 JWT를 검증하는 `provision-student` Edge Function에서 수행한다. 프로필 연결 실패 시 생성한 Auth 사용자를 삭제한다.
- 관리자 계정은 서버 전용 환경 변수와 Secret/Service Role key를 사용하는 `scripts/initialize-admin.ts`로 초기화한다. 기존 Auth 사용자와 프로필을 재사용하여 반복 실행 시 중복 생성하지 않는다.

## RLS 및 공개 조회 계약

- 6개 업무 테이블 모두 RLS를 사용한다.
- 일반 사용자는 자신의 `app_users` 행과 자신의 `rentals`만 조회할 수 있으며 업무 테이블을 직접 수정할 수 없다.
- 관리자 여부는 `auth.uid()`와 `app_users.auth_user_id`를 연결한 DB 함수로 검사한다. 역할 판단에 사용자 수정이 가능한 Auth user metadata를 사용하지 않는다.
- 관리자만 App User, Station, Battery, Rental, History, System Setting을 변경할 수 있다.
- Battery 상태 이력은 관리자만 조회한다.
- `station_inventory` 보안 호출자 View는 Station별 Available 수량과 슬롯 점유 수량만 공개한다. 익명·인증 사용자의 원본 Battery 조회 권한도 재고 계산에 필요한 식별자·Station·상태 열로 제한한다.
- 모든 `SECURITY DEFINER` 함수는 비공개 `private` Schema에 두고 빈 `search_path`와 명시적 실행 권한을 사용한다.

## 재학증명서 Storage

- `enrollment-certificates` Bucket은 Private이며 파일당 최대 5 MiB다.
- 허용 MIME type은 PDF, JPEG, PNG다.
- 객체 경로의 첫 폴더는 Auth 사용자 UUID다.
- 본인은 자신의 UUID 폴더에 소유한 객체만 접근하고, 관리자는 전체 객체에 접근한다.

## 시간과 충전

- 기본 설정은 대여 7일, 장기 미반납 60일, `time_scale = 1`, 배터리 단가 30,000원이다.
- Overdue와 장기 미반납은 각각 시뮬레이션 경과시간이 7일과 60일을 **초과**할 때 성립한다.
- 충전 속도는 시뮬레이션 1분당 10%p이며 DB의 정수 충전량에 맞춰 소수 %p를 내림하고 결과를 0~100%로 제한한다.
- 시간 함수는 현재 시각을 인자로 받아 Scheduler 없이 호출 시점에 계산한다.
- 활성 Rental은 `simulation_elapsed_seconds`, `simulation_anchor_at`, `simulation_time_scale`을 저장한다.
- Charging Battery는 `charge_simulation_elapsed_seconds`, `charge_time_anchor_at`, `charge_time_scale`을 저장한다.
- `set_simulation_time_scale`은 기존 배율 구간을 누적값에 먼저 반영한 후 새 기준 시각과 배율을 원자적으로 저장한다. 직접 `system_settings.time_scale`을 변경하는 것은 Trigger가 차단한다.

## 확률과 관리자 시연 제어

- 사용 중 고장 5%, 충전 중 고장 3%, 수리 성공 90%, 수리 실패 10%다.
- 공통 판정 함수는 난수 공급자를 주입할 수 있으며 기본값은 `Math.random`이다.
- 결과 강제 지정은 관리자, DB의 `demo_mode_enabled`, 서버 환경의 `SFEN_DEMO_MODE_ALLOWED`가 모두 참일 때만 허용한다.
- `SupabaseDemoControlSource`가 서버용 Supabase Client로 역할과 DB 설정을 조회하고 `resolveTrustedSimulationOutcome`이 세 Gate를 구성한다. 클라이언트가 보낸 역할·시연 활성값을 신뢰하지 않는다.
- 운영 환경의 서버 Gate 기본값은 false다. 관리자 시연 UI는 B0-C 범위에 없다.

## B1~B6 Transaction 계약

입력·출력 타입과 오류 코드는 `src/contracts/transactions.ts`에 정의한다. 실제 RPC는 각 후속 블록에서 구현한다.

| 블록 | 원자적 처리 기준 |
| --- | --- |
| B1 | 관리자 권한 확인, Battery/Station 잠금, 등록 또는 재배치, 수용량 검사, History 기록 |
| B3 | 사용자 자격·정지·활성 대여 검사, User/Battery 잠금, Rental 생성, `Available -> Rented`, History 기록 |
| B4 | Rental/Battery/Station 잠금, 미반납·수용량 검사, 반납 필드와 `used_count`, `Charging` 전이·충전 Clock, History 기록 |
| B5/B6 | Battery와 관련 Rental 잠금, 공통 상태 전이·확률 Gate 검사, 충전·수리·연체·분실·폐기 필드와 History 기록 |

- 관련 행은 안정적인 ID 순서로 `FOR UPDATE` 잠금을 획득한다.
- 상태 변경과 정확히 한 건의 History 기록은 같은 DB Transaction에서 성공하거나 함께 rollback한다.
- 수용량과 활성 대여 여부는 잠금 후 다시 검사한다.
- 여러 Supabase 클라이언트 호출을 업무 Transaction의 대체물로 사용하지 않는다.
- 확률 결과 입력은 이벤트별 결과를 묶은 판별 Union으로 제한한다.
- 공통 오류에는 권한, 자격·정지, 미존재, 잘못된 상태 전이, 중복 대여, 수용량 초과, 동시성 충돌과 시연 강제 결과 거부가 포함된다.

## 이후 확장 범위

- B2: 실제 회원가입·승인·로그인 UI와 비밀번호 변경 업무
- B1~B6: 위 계약에 따른 실제 업무 RPC와 화면

확장 시 기존 Schema, 상태 전이, 공통 API 계약을 변경하려면 관련 코드·테스트·이 문서를 함께 갱신한다.
