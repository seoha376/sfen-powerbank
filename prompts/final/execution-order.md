# Final Prompt Execution Order

Complete this document when the final prompt set is approved. Do not add intermediate Build/Fix prompts.

## Prompt-set metadata

- **Prompt-set version:** <!-- Version or immutable identifier -->
- **Approved date:** <!-- YYYY-MM-DD -->
- **Approved by:** <!-- Team member(s) or review role -->
- **Related application baseline:** <!-- Commit SHA or baseline document reference -->

## Required configuration

Document configuration names and setup steps only. Never record secret values.

| Configuration | Required before prompt | Setup or verification method | Secret handling notes |
| --- | --- | --- | --- |
| <!-- Name --> | <!-- Prompt number or "all" --> | <!-- Non-secret instructions --> | <!-- Where the value is managed outside Git --> |

## Ordered prompt sequence

Add one row for every finalized prompt. The order in this table is the required execution order.

| Order | Final prompt file | Purpose | Dependencies | Expected checkpoint |
| --- | --- | --- | --- | --- |
| 1 | <!-- `01-descriptive-name.md` --> | <!-- Intended outcome --> | <!-- Fresh-project state and required configuration --> | <!-- Observable, verifiable state; do not pre-record a result --> |

<!-- Add subsequent finalized prompts as additional rows. -->

## Execution rules

1. Use a fresh Lovable project for an independent reproduction run.
2. Apply required configuration through the approved secret-management or platform interface; do not paste secrets into prompts or Git-tracked files.
3. Execute each listed prompt exactly as finalized and wait for Lovable to finish before checking the expected checkpoint.
4. Stop and document any failed dependency, checkpoint, retry, or manual intervention in the reproduction-run record.
5. Do not insert ad hoc Build/Fix prompts into the final sequence. Revise and re-approve the prompt set instead.
