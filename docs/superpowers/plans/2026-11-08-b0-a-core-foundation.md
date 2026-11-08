# B0-A Core Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an executable React foundation, Supabase schema, shared battery-domain rules, and honest automated verification for B0-A.

**Architecture:** A static Vite shell uses Tailwind and shadcn/ui without calling backend workflows. Pure TypeScript modules own reusable state and inventory rules, while one Supabase migration owns relational integrity and pgTAP tests exercise the applied schema when local infrastructure is available.

**Tech Stack:** React, Vite, TypeScript, Tailwind CSS, shadcn/ui, Supabase JavaScript Client, Vitest, Testing Library, PostgreSQL, Supabase CLI, pgTAP

**Spec:** `docs/superpowers/specs/2026-11-08-b0-a-core-foundation-design.md`

## Global Constraints

- Preserve existing `README.md`, `docs/`, and `prompts/` content and update references only where the initialized application requires it.
- Do not implement authentication, access-granting RLS policies, workflow RPCs, simulations, administration features, or B1-B6 functionality.
- Enable RLS on all six public tables without granting policies.
- Never commit real Supabase credentials; document only variable names in `.env.example`.
- Do not create Test Case, Test Result, Evidence, or Regression Matrix Markdown files.
- Do not commit, push, or open a PR during this task.
- TypeScript test success must not be reported as database constraint verification.

## Review Focus

- A user-role login ID containing anything other than exactly eight digits must be rejected by PostgreSQL; covered by Task 4 pgTAP tests.
- A same-status battery event must be rejected unless it is an explicit relocation of a station-slot state; covered by Task 2 Vitest tests.
- A returned rental must never be classified as active even if the battery remains `Rented` or `Overdue`; covered by Task 3 Vitest tests.
- `long_term_days <= rental_period_days` must be rejected without weakening the singleton settings invariant; covered by Task 4 pgTAP tests.
- Missing browser environment variables must not break the static app shell or build, but client creation must fail clearly; covered by Task 1 Vitest tests.

---

### Task 1: Initialize the application toolchain and static shell

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `eslint.config.js`
- Create: `components.json`
- Create: `postcss.config.js` or the current Tailwind/Vite equivalent selected by official documentation
- Create: `.env.example`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`
- Create: `src/vite-env.d.ts`
- Create: `src/components/ui/card.tsx`
- Create: `src/lib/utils.ts`
- Create: `src/lib/supabase.ts`
- Create: `src/test/setup.ts`
- Test: `tests/app-shell.test.tsx`
- Test: `tests/supabase-client.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: no project code.
- Produces: `App(): JSX.Element`; `getSupabaseClient(): SupabaseClient`; npm scripts `dev`, `build`, `lint`, `test`, `test:run`, `typecheck`, and `test:db`.

- [ ] **Step 1: Confirm current official setup paths**

Check primary Vite, Tailwind, shadcn/ui, and Supabase documentation for the current React/Vite installation commands and compatible configuration. Record no generated prose document; use the results to choose dependency versions and config syntax.

- [ ] **Step 2: Install scaffold and test dependencies**

Initialize npm metadata and install React/Vite/TypeScript, Tailwind/shadcn dependencies, `@supabase/supabase-js`, Vitest, jsdom, and Testing Library. Preserve existing repository files and generate `package-lock.json`.

- [ ] **Step 3: Configure Vite, TypeScript, Tailwind, shadcn/ui, ESLint, and Vitest**

Configure the `@` alias to `src`, jsdom test environment, test setup, and CSS entry point. Add `.env.example` with empty `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; keep `.env*` ignored except `.env.example`.

- [ ] **Step 4: Write failing shell and Supabase boundary tests**

`tests/app-shell.test.tsx` asserts the project title and B0-A foundation text render without workflow controls. `tests/supabase-client.test.ts` resets modules/environment and asserts `getSupabaseClient()` throws a clear missing-configuration error when variables are absent.

- [ ] **Step 5: Run the focused tests and verify RED**

Run: `npm run test:run -- tests/app-shell.test.tsx tests/supabase-client.test.ts`

Expected: FAIL because `App`, the UI primitives, and `getSupabaseClient` do not exist.

- [ ] **Step 6: Implement the minimal shell and lazy Supabase client**

Create a shadcn `Card` primitive and an accessible, responsive shell that displays only foundation status. Implement `getSupabaseClient(): SupabaseClient` with a cached client and environment validation performed when called, not at module import.

- [ ] **Step 7: Run focused and full verification**

Run `npm run test:run -- tests/app-shell.test.tsx tests/supabase-client.test.ts`, then `npm run typecheck`, `npm run build`, and `npm run lint`.

Expected: all PASS with no shell dependency on live Supabase values.

- [ ] **Step 8: Inspect changes without committing**

Run `git status --short` and confirm no existing documentation or prompt files were removed or overwritten.

### Task 2: Implement the battery state model and transition validator

**Files:**
- Create: `src/domain/battery-status.ts`
- Test: `tests/battery-status.test.ts`

**Interfaces:**
- Consumes: no earlier domain module.
- Produces: `BATTERY_STATUSES`, `BatteryStatus`, `BatteryTransitionOptions`, `canTransitionBatteryStatus(from, to, options?)`, `occupiesStationSlot(status)`, and `isBatteryAvailableForRental(status)`.

- [ ] **Step 1: Write the failing transition tests**

Add table-driven literal expectations for every required allowed transition, initial `null -> Charging`, representative forbidden edges, all outgoing transitions from `Disposed`, and same-state relocation behavior. Add separate slot-occupancy and rental-availability assertions.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm run test:run -- tests/battery-status.test.ts`

Expected: FAIL because `src/domain/battery-status.ts` does not exist.

- [ ] **Step 3: Implement the closed status union and rules**

Use a readonly status tuple and an explicit transition map. Permit same-status transition only when `options?.relocation === true`, the status is `Charging`, `Available`, or `UnderRepair`, and it is not `Disposed`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm run test:run -- tests/battery-status.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the full suite and inspect changes**

Run `npm run test:run` and `git status --short`. Do not commit.

### Task 3: Implement inventory and active-rental calculations

**Files:**
- Create: `src/domain/inventory.ts`
- Create: `src/domain/rentals.ts`
- Test: `tests/inventory.test.ts`
- Test: `tests/rentals.test.ts`

**Interfaces:**
- Consumes: `BatteryStatus` and `isBatteryAvailableForRental` from Task 2.
- Produces: `BatteryInventoryItem`, `countAvailableInventory(batteries, stationId?)`, `RentalActivityInput`, and `isActiveUnreturnedRental(rental, batteryStatus)`.

- [ ] **Step 1: Write failing inventory tests**

Assert that only `Available` rows count, station filtering uses exact `stationId`, and an empty collection returns zero. Expected counts are literal values derived from fixed fixtures.

- [ ] **Step 2: Write failing active-rental tests**

Assert true for null `returnTime` with `Rented` and `Overdue`; false for returned rentals and for every other battery status.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm run test:run -- tests/inventory.test.ts tests/rentals.test.ts`

Expected: FAIL because both domain modules are missing.

- [ ] **Step 4: Implement the minimal pure calculations**

Use immutable structural input types. `countAvailableInventory` filters battery rows; `isActiveUnreturnedRental` combines the return timestamp and status conditions without mutating inputs.

- [ ] **Step 5: Run focused and full tests and verify GREEN**

Run `npm run test:run -- tests/inventory.test.ts tests/rentals.test.ts`, then `npm run test:run`.

Expected: all PASS.

- [ ] **Step 6: Inspect changes without committing**

Run `git status --short`. Do not commit.

### Task 4: Create the six-table Supabase migration and pgTAP contract tests

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/20261108000100_b0_a_core_foundation.sql`
- Create: `supabase/tests/database/b0_a_core_foundation.test.sql`

**Interfaces:**
- Consumes: exact status values and transition assumptions defined in the design and Task 2.
- Produces: tables `app_users`, `stations`, `batteries`, `rentals`, `battery_status_history`, `system_settings`; their named constraints, indexes, singleton defaults, and deny-by-default RLS state.

- [ ] **Step 1: Write pgTAP tests before the migration**

Test six table names, system-setting defaults, RLS enabled state, and representative valid/invalid inserts for login IDs, enums, numeric bounds, timestamps, foreign keys, singleton enforcement, and period relationships. Use transactions so fixtures roll back.

- [ ] **Step 2: Attempt the database RED run**

Run: `npx supabase test db`

Expected with local prerequisites: FAIL because the migration/tables do not exist. If Docker or the Supabase local database is unavailable, record the exact prerequisite failure and mark the database RED run NOT RUN rather than treating it as a product failure.

- [ ] **Step 3: Implement the migration**

Create `pgcrypto` if needed, define all six tables with named PK/FK/UNIQUE/CHECK constraints, create narrowly useful FK/status indexes, insert singleton settings idempotently, and enable RLS on every public table without policies. Use `ON DELETE RESTRICT` for domain references.

- [ ] **Step 4: Apply and test the migration when infrastructure is available**

Run `npx supabase db reset` followed by `npx supabase test db`.

Expected: migration applies and pgTAP passes. If infrastructure is unavailable, report both commands as NOT RUN with the blocking dependency; do not claim database verification.

- [ ] **Step 5: Review migration consistency**

Compare each SQL status, role, approval value, default, and numeric bound against the design and TypeScript tuple. Confirm no auth trigger, granting policy, or workflow function was added.

- [ ] **Step 6: Inspect changes without committing**

Run `git status --short`. Do not commit.

### Task 5: Document local operation and perform final verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: npm scripts and environment names from Task 1; Supabase commands from Task 4.
- Produces: concise setup, application verification, and honest database-test instructions.

- [ ] **Step 1: Update README operational instructions**

Add prerequisites, `npm install`, `.env.example` usage, development/build/test commands, and the local Supabase database test requirement. Preserve the repository-management and Notion rules already present.

- [ ] **Step 2: Run complete non-database verification**

Run `npm run typecheck`, `npm run lint`, `npm run test:run`, and `npm run build`.

Expected: every command exits zero with no unexpected warnings.

- [ ] **Step 3: Run database verification if possible**

Run `npx supabase db reset` and `npx supabase test db` only when Docker/Supabase local prerequisites are available. Record PASS, FAIL, or NOT RUN separately from TypeScript tests.

- [ ] **Step 4: Inspect repository scope and secrets**

Run `git diff --check`, inspect `git status --short`, and search tracked/untracked project files for accidental secret values. Confirm no B0-B or B1-B6 feature was introduced.

- [ ] **Step 5: Review final file tree without committing**

Print the relevant tree, categorize added/modified files, and leave all changes uncommitted for user review.
