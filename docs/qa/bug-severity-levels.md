# Bug Severity Levels (P1–P4)

Pin this in the team channel and link it from the bug template. Four levels only.

| Level | Definition | Response | Examples from this codebase |
|---|---|---|---|
| **P1** | Blocks a clinical or client workflow, **or loses/corrupts data or money**. | Same day. Drop other work. | A legitimate role is bounced by `src/middleware.tsx` or a layout guard (e.g. a CASHIER redirected away from `/branch/pos`). `POST /pos/sales` (`back-end/src/pos/pos.service.ts`, `createSale`) charges the wrong total or does not decrement stock atomically, so concurrent sales oversell. |
| **P2** | Breaks a feature for everyone, but a workaround exists. | Within the current sprint. | **Real, 2026-10-25:** the POS medication search crashes `/branch/pos` with "Application error" (`pos/page.tsx:135`, null `category`), and medications could not be selected, so the counter workflow is blocked (P1 while no workaround exists; P2 if browsing the list still works). **Real, measured 2026-10-25:** `GET /api/staff-leave/my` and `/api/staff-leave/branch` return 500 on every call, so the Leave pages fail for all staff and managers (workaround: ask the manager out of band). Also: patient pharmacy search returns nothing while `/patient/pharmacies` still works. |
| **P3** | Visual defect, or a defect affecting a single role only. | Scheduled (next planning). | `/branch/dashboard` may fail for non-manager branch roles because `/staff` is BRANCH_MANAGER-only (unverified, audit W6). Sidebar collapsed state wrong on one portal. |
| **P4** | Cosmetic. | Backlog. | Spacing, icon alignment, typo in a toast. **Real:** pharmacy dashboard calls a non-existent `GET /api/users/me` (404, swallowed) on load, with no visible effect. |

`TODO (Daniel + Robert): replace the examples above with ticket links as real bugs come in.`

## Decision tests (apply in order)
1. Does it lose data or money, or block a clinical/client workflow? → **P1**
2. Does the feature fail for everyone? → **P2** (P1 if there is no workaround and the workflow is clinical/client)
3. Is it visual-only or limited to one role? → **P3**
4. Otherwise → **P4**

Auto-rules: any regression-checklist item failing in section 2 (POS/money) or section 6 (role gating) is **P1**. Any other checklist failure is at least **P2**.

## Who may raise
Anyone (developer, QA, support, client-facing staff) may raise a bug at any level, including P1.

## Who may downgrade
- **P1:** only the engineering lead (Robert) or the on-call lead, with the reason written in the ticket; the reporter is told.
- **P2–P4:** the triaging developer or QA owner, with a one-line reason in the ticket.
- **Upgrades:** anyone may propose, the triager confirms.
- Nobody downgrades their own bug to meet a deadline.

## Rules
- Severity follows user impact, not fix effort.
- When unsure between two levels, pick the higher; the triager decides.
- Re-check severity when the fix lands and record any change in the ticket.
