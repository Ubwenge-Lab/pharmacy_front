# Regression Checklist

Run after **any** performance change (caching, memoization, fetch/query changes, bundle splitting, middleware or layout edits). Target: **under 30 minutes**, one developer. Pharmacy portal only; the hospital portal is out of scope.

**Run info:** date ___ · branch/commit ___ · env ___ · tester ___
**Setup (3 min):** use a production build (`npm run build && npm start`), fresh browser profile, DevTools Network open with "Preserve log". Seeded accounts: one per role below. Test SKU: `TODO: name + known stock` ___. Keep `src/middleware.tsx` and `src/app/branch/layout.tsx` open for the gating section.

Mark PASS / FAIL (+ ticket). A FAIL in section 2, 6 or 7 is **P1** (see `bug-severity-levels.md`).

## Known failing on the baseline (2026-10-25) — recorded, not fixed
- **POS** `/branch/pos`: typing in the medication search crashes the page ("Application error", null `category`, `pos/page.tsx:135`); medications could not be selected; a sale could not be completed. Section 2 is expected to FAIL until fixed.
- **Leave pages**: `GET /staff-leave/my` and `/staff-leave/branch` return 500.
- **Pharmacy dashboard**: `GET /users/me` returns 404 (harmless, swallowed).
Any **new** 4xx/5xx beyond these is a FAIL.

## 1. Login, each role (5 min)
Roles in scope (from `src/middleware.tsx`): SUPER_ADMIN, SYSTEM_ADMIN, PHARMACY (APPROVED), BRANCH_MANAGER, PHARMACIST, CASHIER, NURSE (branch), PATIENT.
- [ ] Each role: log in at `/login`, land on its own home, no console error, log out.
- [ ] Wrong password rejected. Session survives a reload.
- [ ] Landing pages match:

| Role | Lands on |
|---|---|
| PATIENT | `/patient/dashboard` |
| PHARMACY (APPROVED) | `/pharmacy/dashboard` (PENDING → `/pending-approval`, REJECTED → `/pharmacy-rejected`) |
| SUPER_ADMIN / SYSTEM_ADMIN | `/super-admin/dashboard` / `/system-admin` |
| BRANCH_MANAGER | `/branch/dashboard` |
| PHARMACIST, CASHIER, branch NURSE | `/staff/dashboard` (counter workspace `/branch/pos` via the workspace switcher) |
| any role with `requiresPasswordChange` | its change-password page first |

## 2. POS checkout with stock deduction — MONEY PATH (6 min) — `/branch/pos`
- [ ] Search: type `a`, then `zz`. The page must **not** show "Application error".
- [ ] Clicking a medication card adds it to the cart and the cart is visible at the current window width.
- [ ] Note starting stock of test SKU: ___
- [ ] Cart: 2 units + a second item + a discount. Hand-calculate subtotal − discount = total: ___ . On-screen total = receipt total = sale record total.
- [ ] Amount received below total is blocked; change is correct when above.
- [ ] After sale, stock down by exactly 2: ___ (not 0, not 4).
- [ ] Double-click Pay and reload mid-submit: exactly one sale, stock decremented once. Network shows one `POST /pos/sales`.
- [ ] **Atomic decrement:** two tabs, last unit, pay in both: one succeeds, the other is rejected "Insufficient stock", stock never negative.
- [ ] Daily summary (`GET /pos/sales/summary`) updates after the sale.

## 3. Prescription upload and queue (4 min)
- [ ] `/branch/prescription-upload`: patient search works, upload valid file, prescription created.
- [ ] `/branch/prescriptions`: item appears in queue; status filter works; confirm-transcription works.
- [ ] Invalid file type/size rejected with a message.
- [ ] Network: queue page makes one `GET /prescriptions/branch` per filter change, not per keystroke.

## 4. Patient dashboard (3 min) — `/patient/dashboard`
- [ ] Orders stats and recent orders show for a patient with orders and for one without.
- [ ] Pharmacy map block shows up to 6 pharmacies. No new 4xx/5xx.
- [ ] `NEXT_PUBLIC_ENABLE_PATIENT_FEATURES` is `true` in the test env (middleware blocks `/patient/*` otherwise).

## 5. Pharmacy directory search (3 min)
- [ ] `/patient/search` and `/patient/pharmacies`: search by name and location; type a term that matches nothing; empty-state works, no crash (same null-`category` risk at `patient/pharmacies/[id]/page.tsx:91-92`).

## 6. Role gating through BOTH layers — FAILURE CLASS 1 (5 min)
Layer 1: `src/middleware.tsx` (cookie JWT decode, runs on direct URL / hard refresh).
Layer 2: layout guards (`src/app/*/layout.tsx`, `components/guards/PharmacyGuard.tsx`, using `AuthContext`, runs on client navigation).
For each role, test **(a) pasting the URL directly** and **(b) clicking in via the app**. Expected: allowed roles reach it, others are redirected, and (a) and (b) agree.

| Route | BRANCH_MGR | PHARMACIST | CASHIER | NURSE (branch) | PATIENT | PHARMACY | other |
|---|---|---|---|---|---|---|---|
| `/branch/pos` | allow | allow | allow | allow | deny | deny | deny |
| `/branch/dashboard` | allow | allow | allow | allow | deny | deny | deny |
| `/staff/*` | deny | allow | allow | allow | deny | deny | deny |
| `/pharmacy/*` | deny | deny | deny | deny | deny | allow (APPROVED) | deny |
| `/patient/*` | deny | deny | deny | deny | allow | deny | deny |
| `/super-admin/*` | deny | deny | deny | deny | deny | deny | SUPER_ADMIN only |

(Values come from the code on this commit; re-derive if role lists change. `BRANCH_PORTAL_ROLES` in `branch/layout.tsx` must equal `branchRoles` in `middleware.tsx`.)
- [ ] No legitimate role is rejected (false rejection).
- [ ] No role reaches a route it must not.
- [ ] Unauthenticated user redirected from every protected route.
- [ ] Middleware result == layout-guard result for every cell; any mismatch is a FAIL.
- [ ] The page's API calls do not 403 for a role the UI allows (check Network 4xx per role).

## 7. Money paths regressed? — FAILURE CLASS 2 (confirm, 2 min)
- [ ] Amounts identical to the pre-change baseline for the same test cart.
- [ ] Atomic stock decrement re-verified (section 2 concurrency step).
- [ ] Any change touching `pos.service.ts`, `CartContext`, or order totals: also run one patient checkout (`/patient/checkout`) and compare totals.

## Close-out
- [ ] Request count / bytes on touched pages compared with `baseline-2026-Q4/network-request-audit.md`: ___
- [ ] Known failures above unchanged (or fixed and removed from this list). Any new 4xx/5xx is a FAIL.
- [ ] Staff pages: `GET /staff/profile/me` count per page load (baseline 2; target 1): ___
- [ ] Run `python docs/baseline-2026-Q4/har/analyze_har.py <new>.har` on one cashier session and compare duplicate count (baseline 21).
- [ ] All FAILs ticketed with severity. Sign-off: ___
