# sfen-powerbank

Shared Power Bank Circular Inventory Management System, developed with Lovable.

## Documentation and reproduction workflow

- Record requirements, design material, and architectural decisions under `docs/`.
- Keep only the approved, finalized Lovable reproduction prompts in `prompts/final/`, and run them in the order defined by `prompts/final/execution-order.md`.
- Define test cases in `tests/cases/`, record observed results in `tests/results/`, and document fresh-project reproduction runs in `tests/reproduction/`.
- Record non-secret environment details, the application baseline, and cross-run comparisons in `experiments/`.

Do not commit secrets, access tokens, certificates, or real student records. Keep exploratory Build/Fix prompts outside `prompts/final/`.
