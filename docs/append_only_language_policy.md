# SFEN — Append-only Language Policy for In-Progress Blocks (B2–B7)

**Usage:** Append the text below at the *end* of each block's existing development prompt. Do not replace or rewrite prompts that teammates may already be executing. The prompt's instruction language may remain Korean. This policy concerns generated product UI and compatibility.

## Additional Global Requirements — English UI, No Breaking Changes

The current block extends the SFEN B0 foundation and prior implemented blocks. Before editing, inspect the existing code, database schema, migrations, API/RPC contracts, canonical statuses, authentication and permission rules. Do not assume an earlier prompt was successfully implemented merely because it was issued.

1. All **user-visible product text** must be in English: page titles, menus, navigation, buttons, form labels, placeholders, dialogs, status labels, help text, notifications, validation and error messages, and empty states. This applies even if the rest of this implementation prompt is written in Korean.
2. Preserve the exact canonical technical identifiers, database schema, field names, enum values, API/RPC names, TypeScript types, security permissions and transaction invariants. English UI presentation does not authorize a schema rename or data migration.
3. Reuse the English vocabulary already established by B0 and previous blocks. If no exact display label exists, choose a concise, consistent English label. Do not introduce Korean fallback text.
4. If Korean UI strings were already generated, change only the **visible display strings** and directly affected UI tests as a bounded localization task. Do not broadly refactor working business logic, authentication, transaction handling or database structures.
5. Implement the requested block only. Do not use localization as justification for introducing unrelated features or rebuilding completed blocks.
6. Report which screens and messages were checked for English consistency. Distinguish tests actually executed from unverified claims and explicitly disclose any platform-specific manual setup.

For any conflicts between an older prompt's Korean UI wording and these rules, the **English user-facing output requirement takes precedence**. All non-language functional requirements and existing contracts remain in force.
