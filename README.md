# sfen-powerbank

Shared Power Bank Circular Inventory Management System, developed with Lovable.

## B0-A development setup

Prerequisites:

- Node.js 24.15 or newer within the 24.x release line (see `.nvmrc`)
- npm
- Docker Desktop for local Supabase database tests

Install dependencies and start the static application shell:

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and supply the project URL and browser-safe anonymous key before code calls `getSupabaseClient()`. The B0-A shell itself does not require a live Supabase project. Never commit real environment values.

Run the TypeScript verification commands:

```sh
npm run typecheck
npm run lint
npm run test:run
npm run build
```

Run the PostgreSQL migration and pgTAP tests with Docker Desktop running:

```sh
npx supabase start
npx supabase db reset
npm run test:db
```

TypeScript tests do not verify PostgreSQL constraints. If the local Supabase stack is unavailable, report database migration and pgTAP verification as NOT RUN.

## Repository management

- Keep confirmed requirements and shared design documents under `docs/`.
- Keep only approved final reproduction prompts under `prompts/final/`, and list their Lovable execution order in `prompts/execution-order.md`.
- Keep executable automated tests and their required fixtures, helpers, and configuration under the test structure used by the project. Do not create per-run Test Case, Test Result, Evidence, or Regression Matrix Markdown files in this repository.

When a feature block is complete, upload its feature code, final reproduction prompt, and automated test code if tests were added. Development process guidance, the GitHub usage guide, the Regression Matrix, feature blocks, and ownership are managed in Notion.

Do not commit intermediate Build/Fix prompts, secrets, access tokens, certificates, or real student records.
