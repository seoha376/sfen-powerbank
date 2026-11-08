# B0-A Core Foundation Design

## Intent

Establish the first executable foundation for the Shared Power Bank Circular Inventory Management System. B0-A provides a minimal React application shell, a Supabase-ready PostgreSQL schema, shared battery-state rules, and automated tests. It deliberately stops before authentication, authorization, and operational workflows.

## Goals

- Initialize a maintainable React + Vite + TypeScript application.
- Configure Tailwind CSS and shadcn/ui for later feature work.
- Configure the Supabase JavaScript client through non-secret environment variables.
- Create one PostgreSQL migration containing the six required tables, defaults, and integrity constraints.
- Implement reusable TypeScript battery-state and inventory predicates.
- Test TypeScript behavior with Vitest and database behavior with pgTAP when a local Supabase database is available.
- Keep the repository's existing documentation and prompt-management rules intact.

## Non-goals

- Authentication, sign-up, or login.
- RLS access policies that grant browser roles access.
- Rental, return, relocation, or other business RPCs.
- Simulation engines, administrator demonstration mode, or B1-B6 features.
- User-facing membership, rental, return, or administration screens.
- Recording Test Case, Test Result, Evidence, or Regression Matrix Markdown files.

## Constraints

- No secret values are committed. `.env.example` documents `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only.
- The application must build without live Supabase credentials; attempting to use the client without configuration must fail with a clear runtime error at the client boundary rather than during module import.
- TypeScript unit tests do not stand in for database constraint tests.
- Database integration tests are reported as NOT RUN when the local Supabase/PostgreSQL test environment is unavailable.
- Existing repository content is preserved unless a generated placeholder is superseded by the initialized project.

## Approaches considered

### Selected: Vitest plus Supabase pgTAP

Use Vitest for pure TypeScript domain rules and pgTAP under `supabase/tests/` for applied-schema behavior. This matches the application stack, keeps fast logic tests independent of infrastructure, and validates PostgreSQL constraints against a real database when Docker and the Supabase CLI are available.

### Rejected: Vitest-only SQL source checks

Parsing or matching migration text is fast but does not prove that PostgreSQL accepts the migration or enforces its constraints. It would create false confidence in database integrity.

### Rejected: Generic PostgreSQL Testcontainers

Testcontainers would provide real database tests but adds a second database lifecycle beside the Supabase CLI and can drift from the project's intended local Supabase workflow.

## Project structure

```text
src/
  components/ui/        shadcn/ui primitives used by the shell
  domain/               shared battery, inventory, and rental rules
  lib/                   utilities and lazy Supabase client creation
  test/                  Vitest setup
supabase/
  migrations/            ordered PostgreSQL migrations
  tests/database/         pgTAP integration tests
tests/                   executable TypeScript tests
```

Standard Vite, TypeScript, Tailwind, ESLint, shadcn, and npm configuration files remain at the repository root. Existing `docs/` and `prompts/` content remains in place.

## Application shell

The shell contains only a project title, a brief B0-A foundation status, and non-interactive summary cards describing the configured foundation. It has no membership, rental, return, relocation, or administrator workflow controls. A small shadcn/ui primitive such as `Card` demonstrates that the component system is correctly wired.

## Database design

PostgreSQL uses `gen_random_uuid()` for generated infrastructure identifiers. `app_users.user_id` remains `text` because it is the login ID and foreign-key target for rentals and history actors.

### `app_users`

- `user_id text` primary key.
- `auth_user_id uuid` nullable and unique.
- Required `user_name` and `role`; `role` is `user` or `administrator`.
- Nullable `user_status` and `approval_status` use the specified values.
- `eligibility_status` defaults to `false`.
- `suspension_type` defaults to `none` and uses the specified values.
- Remaining optional profile and suspension fields use nullable PostgreSQL types.
- `user` rows require an exactly eight-digit `user_id`; administrator IDs may use a separate non-empty identifier format.
- No password or password hash column exists.

### `stations`

- UUID primary key.
- Required name and location.
- `slot_capacity` is an integer greater than or equal to zero.

### `batteries`

- UUID primary key.
- Required model, positive integer capacity, `cycle_life >= 1`, and `used_count >= 0`.
- Status is one of the seven specified battery states.
- `station_id` is nullable because rented, overdue, lost, and disposed batteries do not occupy a station slot.
- `current_charge` is an integer from 0 through 100.
- Charge and disposal timestamps are nullable.

### `rentals`

- UUID primary key with foreign keys to the user, battery, and station rows.
- `rental_time` defaults to the current time; return fields are nullable.
- When present, `return_time` cannot precede `rental_time`.
- `compensation_multiplier` defaults to zero and is limited to `0`, `1`, or `3`.
- `penalty_type` remains nullable text because B0-A does not define its vocabulary.

### `battery_status_history`

- UUID primary key.
- Required battery, target status, and timestamp.
- `from_status` is nullable only to represent initial registration.
- Optional actor, station, reason, and rental references support system and later workflow events.
- Status columns accept only the seven battery states.
- The table records events but B0-A does not add triggers that synchronize it with the current battery row; that belongs with later transactional workflows.

### `system_settings`

- A small fixed primary key constrained to `1` guarantees at most one row.
- The migration inserts the single default row idempotently.
- Defaults are `rental_period_days = 7`, `long_term_days = 60`, `time_scale = 1`, and `battery_unit_price = 30000`.
- Periods, scale, and price must be positive, and `long_term_days` must be greater than `rental_period_days`.

Foreign-key deletion uses restrictive behavior so foundational records cannot be silently removed while referenced. The migration adds only indexes that support the declared foreign keys and common active-rental/status lookups; no workflow-specific optimization is introduced.

Row Level Security is enabled on all six public tables, but B0-A creates no access-granting policies. This makes the browser Data API deny table access by default until B0-B defines authenticated roles and policies, avoiding a temporarily exposed schema without prematurely implementing the security model.

## Shared TypeScript rules

- `BatteryStatus` is a closed union of the seven database values.
- `canTransitionBatteryStatus(from, to, options)` allows exactly the requested transition graph.
- Initial registration is `null -> Charging` only.
- `Disposed` is terminal and rejects every outgoing transition.
- Same-status movement is accepted only when explicitly marked as a relocation and only for station-slot states (`Charging`, `Available`, `UnderRepair`).
- `occupiesStationSlot` is true only for `Charging`, `Available`, and `UnderRepair`.
- `isBatteryAvailableForRental` is true only for `Available`.
- `countAvailableInventory` derives inventory from battery rows and can optionally limit the count to one station.
- `isActiveUnreturnedRental` requires a null `return_time` and a related battery in `Rented` or `Overdue`.

These are pure validation and calculation functions. They do not update records or implement business transactions.

## Testing strategy

### TypeScript tests

Vitest tests are written first and observed failing before the domain implementation. They cover:

- every allowed and representative disallowed transition;
- initial registration and the terminal `Disposed` state;
- relocation as a same-status special event;
- station-slot occupancy;
- rentable and available inventory calculations;
- active unreturned rental detection.

### Database tests

pgTAP tests apply against a local Supabase database and cover:

- six-table existence and the singleton settings row;
- required settings defaults;
- accepted and rejected user IDs, roles, statuses, battery bounds, station capacity, compensation multipliers, and rental timestamps;
- valid foreign-key inserts and representative FK rejection.

The local database test command is run only when its prerequisites are available. Failure to provide Docker or a local Supabase database is reported as NOT RUN, not PASS.

## Error handling and environment behavior

- Missing Supabase browser variables produce a clear error only when the application requests a client.
- The static shell does not require or call Supabase, so local development and production builds work before B0-B configuration.
- Database constraints use stable, named checks so failures are identifiable in integration tests and future migrations.

## Builder decisions

- Use npm and commit `package-lock.json`.
- Use UUIDs for station, battery, rental, and history identifiers; use text for the application login ID.
- Use integer battery capacity and charge values.
- Keep `penalty_type` unconstrained until its domain vocabulary is defined by a later block.
- Do not implement data-seeding beyond the required singleton settings row.
- Enable RLS with no granting policies; B0-B must add and verify the actual access model before browser data access is introduced.
