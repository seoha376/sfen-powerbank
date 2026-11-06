# Final Reproduction Prompts

This directory is reserved for the approved prompt sequence that reproduces the functioning application from a new Lovable project.

## Running the sequence

1. Start with a fresh Lovable project that meets the prerequisites in [`../../experiments/environment.md`](../../experiments/environment.md).
2. Confirm the prompt-set version and baseline recorded in [`../../experiments/baseline.md`](../../experiments/baseline.md).
3. Open [`execution-order.md`](execution-order.md) and complete its required configuration without adding secrets to the repository.
4. Run only the finalized prompt files listed there, one at a time and in the documented order.
5. At every checkpoint, record the observed outcome. Do not continue past a failed dependency or checkpoint without documenting the intervention.
6. Record the run with [`../../tests/reproduction/TEMPLATE.md`](../../tests/reproduction/TEMPLATE.md), then verify functionality using the documented test cases.
7. Compare completed independent runs in [`../../experiments/reproduction-summary.md`](../../experiments/reproduction-summary.md).

## Directory rules

- Store only prompts that belong to the approved final reproduction sequence here.
- Do not store exploratory, intermediate Build/Fix, troubleshooting, or one-off prompts here.
- Keep each prompt in a separately versioned Markdown file and reference it from `execution-order.md`.
- Do not include credentials, access tokens, certificates, personal data, or real student records.
- If a final prompt changes, update the prompt-set version, execution order, dependencies, and affected checkpoints before the next reproduction run.
