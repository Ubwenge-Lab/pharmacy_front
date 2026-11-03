# Regression checklist, pharmacy portal

Version: Phase 2 (supersedes the Phase 1 template). Place at `docs/qa/regression-checklist.md`.

Purpose: run after any performance or data fetching change. One developer, one run. Every step names an action and an expected result, so someone who did not write it can run it.

Status: not yet run end to end. The section times below are estimates and are unverified. Replace them with measured times after the first run (see the run log).

## 0. Before you start

| Item | Requirement |
|---|---|
| Build | Production build only: `npm run build`, then `npm start -- -p 3000`. Never `next dev`. Dev mode runs effects twice and shows duplicate calls that do not exist in production |
| URL | Open the app at exactly `http://localhost:3000` (the backend allows that origin) |
| Accounts | One account per role: owner, branch manager, cashier, pharmacist, patient |
| Test data | Cashier orders list with rows. Pharmacist prescription queue with 5 or more rows. Patient with and without orders |
| DevTools | Network tab, Fetch/XHR filter, Disable cache ticked, Keep log OFF. Clear the log before each section that counts requests |
| Counting | An API call is a request to the backend host. Prefetch requests (`?_rsc=`) are not API calls. A duplicate is the same method and URL twice within 1 second |
| Record | Build commit hash, date, runner. Fill the run log at the end |

## Known failures on the baseline

These are already failing before any change. They do not count as regressions, but any other 4xx or 5xx does.

| Item | Where | Status |
|---|---|---|
| Leave endpoints return 500 (GET `/staff-leave/my`, POST `/staff-leave`, GET `/staff-leave/branch`) and a 400 on one POST submission | Staff leave pages, branch staff leave page | Open (W7). Ticket: [INSERT] |
| `GET /users/me` returns 404, error swallowed | Owner dashboard on every load | Open (W8). Ticket: [INSERT] |
| Typing in the POS medication search crashes the page (`m.category.toLowerCase()` on a null category) | `/branch/pos`, also `branch/inventory`, `patient/pharmacies/[id]` | Open, P1. Ticket: [INSERT] |
| Medications cannot be selected from the POS list | `/branch/pos` | Open, cause not confirmed. Ticket: [INSERT] |

## Blocked until fixed

Sections 2 and 7 depend on the POS. Skip them while the POS defects above are open, and write "blocked" in the run log with the ticket. The time target below applies to the runnable sections only.

## How to score a failure

A failed step is a bug. Severity follows `docs/qa/bug-severity-levels.md`. Automatic rule: a failure in section 2 (POS) or section 6 (role gating) is P1. Any other failure is at least P2.

## 1. Login, each role (est. 6 min)

| Step | Action | Expected | Result |
|---|---|---|---|
| 1.1 | Log in as each role at the single login page | Each role lands on its own home page | |
| 1.2 | Log out for each role | Returns to login, protected pages no longer open | |
| 1.3 | Log in with a wrong password | Rejected with a message, no crash | |
| 1.4 | Reload the page while logged in | Session survives, same page, same user | |
| 1.5 | **New.** As the cashier, note the name shown. Log out and log in as the pharmacist in the same tab without reloading the page | Name, branch, sidebar items and permissions belong to the pharmacist. Nothing from the cashier is visible | |
| 1.6 | **New.** In Network, confirm `GET /staff/profile/me` is called again after step 1.5 | One new call (the shared cache was cleared on logout and login) | |

Step 1.5 catches shared request data leaking between users. It matters because profile, permission and dashboard data are now shared between components.

## 2. POS checkout with stock deduction, money path (est. 6 min) BLOCKED

| Step | Action | Expected | Result |
|---|---|---|---|
| 2.1 | Type in the medication search | Page does not crash | |
| 2.2 | Add a medication to the cart | It appears in the cart | |
| 2.3 | Check the totals | They match a hand calculation | |
| 2.4 | Complete the sale | Stock drops by exactly the quantity sold | |
| 2.5 | Double click submit | One sale is created | |
| 2.6 | Two tabs buy the last unit | One succeeds and one is rejected (atomic decrement) | |
| 2.7 | Open the daily summary | It includes the sale | |

## 3. Prescription upload and queue (est. 4 min)

| Step | Action | Expected | Result |
|---|---|---|---|
| 3.1 | Upload a valid prescription | It appears in the queue | |
| 3.2 | Use each status filter | The list changes. Exactly one new `prescriptions/branch` call per filter change. Filter names and expected query for each: [FILL on first run] | |
| 3.3 | Confirm a transcription | Status updates | |
| 3.4 | Upload an invalid file | Rejected with a message | |

## 4. Patient dashboard (est. 4 min)

| Step | Action | Expected | Result |
|---|---|---|---|
| 4.1 | Open the dashboard with and without orders | Orders and stats show correctly in both cases | |
| 4.2 | Check the pharmacy block | Shows up to 6 pharmacies | |
| 4.3 | Check Network for failures | No new 4xx or 5xx | |
| 4.4 | **New.** Open `/patient/search`, then go back to the dashboard, all within 5 minutes | `GET /pharmacies/locations` appears once in total. Search shows all pharmacies, the dashboard still shows 6 | |

## 5. Pharmacy directory search (est. 3 min)

| Step | Action | Expected | Result |
|---|---|---|---|
| 5.1 | Search by name | Matching pharmacies shown | |
| 5.2 | Search by location | Matching pharmacies shown | |
| 5.3 | Search with no matches | Empty state, no crash | |

## 6. Role gating through both layers (est. 7 min)

Insert the role by route matrix from the Phase 1 checklist here: [PASTE]. For every role and route, test both layers.

| Step | Action | Expected | Result |
|---|---|---|---|
| 6.1 | Paste each route URL directly (middleware layer) | Allowed roles open it, others are redirected | |
| 6.2 | Click into each route from the sidebar (layout guard layer) | Same result as 6.1. The two layers agree | |
| 6.3 | Check Network on each allowed page | No 403 for a role the UI allows | |
| 6.4 | **New.** As the pharmacist, open `/staff/prescriptions` with 5 or more rows | Exactly one `GET /staff/profile/me` call, not one per row. Approve and reject buttons show or lock as before | |
| 6.5 | **New.** As a manager, change one staff permission. As that staff user, reload the page | The new permission applies. Without a reload it may take up to 60 s (the profile is kept for 60 s) | |
| 6.6 | **New.** As the cashier, edit the profile (name or phone) and save | Exactly one new `GET /staff/profile/me` after the PUT. Sidebar items unchanged | |

## 7. Money paths regressed? (est. 2 min) BLOCKED

| Step | Action | Expected | Result |
|---|---|---|---|
| 7.1 | Repeat the sale from section 2 | Amounts identical to the baseline | |
| 7.2 | Re-verify the atomic stock decrement | One success and one rejection | |

## 8. New: request budget (est. 3 min)

The checklist used to check function only. This section checks the thing performance work changes. Clear the log, load each page cold (first load after login), count API calls, and compare.

| Page (role) | Expected API calls on load | Result |
|---|---|---|
| `/staff/dashboard` (cashier) | 3: `staff/profile/me`, `attendance/my-current`, `orders/pharmacy-orders` | |
| `/patient/dashboard` (patient) | 3: `notifications`, `my-orders`, `pharmacies/locations` | |
| `/pharmacy/dashboard` (owner) | Phase 1 baseline was 6, plus the known 404 on `users/me`. Record the count from the after capture: [FILL] | |
| `/branch/dashboard` (manager) | 5, all starting at the same instant (Phase 1 baseline) | |

Rules for every page in the table and every section above:

| Step | Rule | Expected | Result |
|---|---|---|---|
| 8.1 | Identical method and URL fired twice within 1 second | None. Any pair is a failure | |
| 8.2 | Moving between staff pages inside 60 s | No new `staff/profile/me` call | |
| 8.3 | Opening dashboard then analytics inside 30 s (owner) | `dashboard/stats` and `dashboard/analytics` once each | |
| 8.4 | Any 4xx or 5xx not listed under known failures | None. Any new one is a failure | |

To count calls precisely, export a HAR for the section and run `python docs/baseline-2026-Q4/har/analyze_har.py <file>`. Sanitize it with `sanitize_har.py` before committing and never commit the original.

## Time

| Set | Sections | Estimate (unverified) |
|---|---|---|
| Runnable now | 1, 3, 4, 5, 6, 8 | 27 min |
| Blocked until the POS is fixed | 2, 7 | 8 min |
| Full run | all | 35 min, over the 30 minute target. If the first real run confirms this, split into two runs |

## Run log

| Date | Runner | Build commit | Sections run | Result | Measured time | Failures and severity |
|---|---|---|---|---|---|---|
| | | | | | | |

Sign off: ______________________ Date: ____________

## Revisions (what was wrong, what changed)

These were found by reading the Phase 1 checklist against the Phase 2 fixes. They have not been confirmed on a real run yet. Confirm each one on the first run and correct anything that proves wrong.

| # | What was wrong | What changed |
|---|---|---|
| 1 | No step checked request counts, so a duplicate could return while every step passed | Added section 8, the request budget, with expected counts per page |
| 2 | No step caught data leaking between users after logout and login | Added steps 1.5 and 1.6 |
| 3 | Role gating had no permission change case, and permissions are now read for up to 60 s | Added 6.5 with the 60 s window stated, and 6.6 for profile edits |
| 4 | Section 2 blocked the run, and a new tester could not tell a known failure from a regression | Added the known failures table and the blocked until fixed table, and applied the time target to the runnable sections only |
| 5 | The 28 minute estimate was unverified, and the new steps push a full run over 30 minutes | Re estimated in the Time table. Replace with the measured time after the first run |
| 6 | "One queue call per filter change" in section 3 gave no filter names or expected URL | Step 3.2 now says to record them on the first run. [FILL] |
| 7 | The per row case (an endpoint called once per table row) was recorded as not observed because the test queue was empty | Added 6.4 and the data requirement of 5 or more prescription rows |