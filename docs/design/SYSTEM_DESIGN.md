# SFEN 공통 시스템 설계

이 문서는 B0-A/B에서 코드와 Migration에 반영된 공통 기반을 설명한다. 실제 회원가입·승인·로그인 UI, 비밀번호 변경 업무, 대여·반납 Transaction과 시뮬레이션은 아직 구현되지 않았다.

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

## 이후 확장 범위

- B2: 실제 회원가입·승인·로그인 UI와 비밀번호 변경 업무
- B0-C 이후 업무 블록: 확정 요구사항에 따른 공통 설계를 이 문서에 추가

확장 시 기존 Schema, 상태 전이, 공통 API 계약을 변경하려면 관련 코드·테스트·이 문서를 함께 갱신한다.
