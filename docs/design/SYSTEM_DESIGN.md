# SFEN 공통 시스템 설계

이 문서는 B0-A 코드와 Migration에 반영된 공통 기반만 설명한다. 인증 연동, 업무 트랜잭션, 전체 RLS 정책, 시뮬레이션은 아직 구현되지 않았다.

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

FK 삭제 동작은 `RESTRICT`이며 조회용 인덱스가 포함된다. 6개 테이블 모두 RLS가 활성화되어 있지만 접근 정책은 B0-B 범위로 남아 있다. Migration 파일과 pgTAP 검증 코드는 존재하며, 실제 환경 적용 여부는 별도로 확인해야 한다.

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

## 이후 확장 범위

- B0-B: 내부 가상 이메일을 이용한 Supabase Auth 연동과 접근 보안/RLS 정책
- B0-C 이후: 확정 요구사항에 따른 공통 설계를 이 문서에 추가

확장 시 기존 Schema, 상태 전이, 공통 API 계약을 변경하려면 관련 코드·테스트·이 문서를 함께 갱신한다.
