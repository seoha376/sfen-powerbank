# SFEN — Design Specification (Draft)

Status: **Draft / layout proposal, not an approved screenshot-exact design**  
Scope: Shared Power Bank Circular Inventory Management System (B0–B7)  
Sources: SFEN B0/B1 requirements, B2–B6 block responsibilities, Lovable Pilot notes, and the team's statement of the instructor's reproduction criterion (2026-11-12). The interim report's actual figures/screens have **not been visually verified** against this draft.

## 1. Design intent and reproduction priority

The application must reproduce the intended behavior, permissions, state transitions, and data correctness. The layout should be recognizable and consistent across reproductions, but **pixel-level or identical visual styling is not an acceptance requirement** based on the instructor feedback relayed by the team.

Priority: (1) workflows and data validity, (2) screen identity/navigation, (3) relative arrangement of major sections, (4) visual polish.

Do not allow this document to override validated B0–B6 database schemas, authentication, state machines, or transactions. Use the feature prompts and final requirements as the functional source of truth.

## 2. Shared UI conventions

- Product language: **English for all user-visible strings**, regardless of the language of an implementation prompt.
- Technology: React, Vite, TypeScript, Tailwind CSS, shadcn/ui; reuse existing components.
- Consistent labels: **Stations**, **Batteries**, **Available**, **Charging**, **Under Repair** (UI presentation of `UnderRepair`), **Rented**, **Overdue**, **Lost**, **Disposed**, **Register Battery**, **Relocate Battery**, **Save Changes**.
- Never rename technical IDs or canonical enum values for presentation.
- Keep explicit loading, empty, permission-denied, invalid-input and failed-operation states. Confirm success only after the server operation succeeds.
- Responsive behavior: on a narrow screen, stack sections vertically and keep primary actions accessible. Desktop is the baseline for the proposed layout.

## 3. Navigation and page ownership

This is a **proposed navigation framework** to harmonize functional blocks, not a claim that the interim report mandated these exact tabs.

| Area | Core screen | Block | Allowed role / notes |
| --- | --- | --- | --- |
| Foundation | Minimal App Shell, sign-in entry | B0 | Do not add B2 registration or approval workflows in B0 |
| Inventory administration | Stations and Batteries | B1 | Administrator only |
| Accounts and eligibility | Student enrollment/approval | B2 | Follow B2 requirements and security |
| Lending | Available stations/batteries, rental | B3 | Follow eligibility and active-rental checks |
| Returns | Return workflow and result | B4 | Respect atomic capacity and history checks |
| Operations | Charging, repair, retirement | B5 | Administrator features as permitted by B5 |
| Exceptions | Overdue, loss, compensation | B6 | Follow B6 permissions and policies |
| Final verification | E2E/demo navigation | B7 | No new business features solely for aesthetics |

Navigation labels and routes should be finalized only after integration confirms which screens actually exist. Hide or disable functions not allowed for the logged-in role; server-side permissions remain authoritative.

## 4. Layout specification — B1 administrator inventory

**Desktop screen structure (recommended):**

1. Header: application name, current role/session, logout.
2. Navigation: a compact sidebar or horizontal sections for the implemented modules.
3. Page heading **Inventory Management** with short context.
4. Stations section: station list or table with **Station**, **Location**, **Capacity**, **Occupied**, **Remaining**, **Available**; **Add Station** action and **Edit** per row.
5. Batteries section: battery list/table with **Battery ID**, **Model**, **Capacity**, **Status**, **Current Station**, **Charge**; **Register Battery** and **Relocate Battery** actions.
6. Registration and relocation forms: side panel, dialog or dedicated form section; keep actions and validation close to affected inputs.

**Interaction rules:**

- `Add Station` requires valid nonnegative integer capacity; reducing capacity below current occupancy is rejected by the database.
- `Register Battery` requires battery UUID, model, positive capacity, cycle life >= 1, and an existing station with spare slots. The initial state is `Charging`, charge 0%, usage count 0; insert its first history entry atomically.
- `Relocate Battery` source list may include a **full** station. Source batteries are selectable only when `Charging`, `Available`, or `UnderRepair`. The **destination** must have spare slots and differ from the source.
- Relocation never resets charge, battery state, usage count, or charging clock. History must record `Relocation`.
- Provide feedback for forbidden roles, invalid UUIDs, duplicate identifiers, full destinations, invalid source or same source/destination. Confirm success after the transaction completes.

## 5. B2–B6 screen behavior and visual consistency

The individual block's approved functional specification takes precedence over generic layout recommendations. For every implemented page, display the key input first, the main action second, and the persisted result/status third. Use a consistent table/filter/form pattern where appropriate. Display human-readable status labels but preserve canonical enum values in data and API calls. Never invent a feature merely to fill an empty design region.

## 6. Minimum visual acceptance checklist

- [ ] English headings, navigation, buttons, labels, messages and status presentation throughout.
- [ ] The same key workflow can be reached from a recognizable navigation point.
- [ ] The primary input and action remain in the same broad region of the page across reproductions.
- [ ] B1 Station capacity/availability and Battery status are both visible, not conflated.
- [ ] Full source stations are still selectable for relocation; full destinations are not.
- [ ] Errors are distinguishable from success; unauthorized operations are not exposed as valid user actions.
- [ ] Functional E2E / DB / RLS tests are reported separately from visual inspection.

## 7. Rollout plan

**Before first integrated Lovable reproduction:** provide this document as a *design draft* alongside B0–B1 foundations and current block prompts. B0 should set global language/components, while B1 should establish the first concrete inventory screen. **Do not use the design draft to trigger unrequested B2–B6 screens in B0.**

**During first integrated reproduction:** observe whether major layout regions and navigation remain coherent, log differences, and adjust only the relevant block's prompt/design guidance. Do not spend repeated Build credits chasing pixel identity.

**Before B7 fresh-project reproduction:** incorporate the confirmed B2–B6 layout and screenshots, freeze the DESIGN.md revision, and reference it from the reproduction instructions. If a fresh Lovable project cannot read repository files, paste the necessary design rules into the prompt or attach the document explicitly; a file path reference alone is not sufficient.

## 8. Open references / not yet verified

- Exact figures, wireframes, and UI design language of the interim report: **not yet compared**.
- Actual routes and final integrated navigation: **pending B2–B6 implementation**.
- Colors, fonts, exact geometry, responsive breakpoints: **team choice, not established by the cited sources**.
- Proof of independent prompt-only reproduction: **pending B7**.
