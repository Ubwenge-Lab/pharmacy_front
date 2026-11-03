# Network request audit, baseline 2026 Q4

Scope: pharmacy portal only (owner, branch manager, cashier, pharmacist, patient). The hospital portal is out of scope.

Status: Phase 1 (measure) is complete. Phase 2 (fix the top 3 duplicate patterns) has the code fixes and unit tests done, one same day HAR pair captured (cashier), and three HAR pairs pending because of internet connectivity problems (see 4.4). API failures found in the captures are listed in 4.6. None of them is caused by this work.

## 1. Method

- Capture: Chrome DevTools, Network panel, Fetch/XHR filter, cache disabled, Keep log off, one HAR per session saved with content.
- App: the production build (`npm run build`, then `npm start -- -p 3000`), never `next dev`. The dev server runs effects twice and shows duplicate calls that do not exist in production.
- API: `pharmacy-backend-jaqu.onrender.com`.
- Counting rule: a duplicate is the same method and URL seen more than once in a session. A parallel duplicate is a repeat within 1 second of the same call, which is the real waste. Repeats on later navigation or polls are counted separately.
- Tools: `har/analyze_har.py` recomputes every number from a HAR. `har/compare_har.py` prints one before and after row for a pair. `har/sanitize_har.py` removes tokens, cookies, passwords and bodies, and keeps URLs, status, timings and sizes.
- Prefetch means Next.js route prefetches (URLs ending in `?_rsc=...`), not API calls.

Limits of the data:

- HARs are filtered to Fetch/XHR, so JS, CSS, images and fonts are not counted. Transferred figures are not page weight.
- Each HAR is one session across several pages, so per page figures are read from the timeline.
- Captures use a disabled cache, so repeat visit caching was not tested.
- No 401 or token refresh event occurred in any capture.

## 2. Phase 1 baseline (original, kept unchanged)

### 2.1 Per session

| Session | Span | Total requests | Transferred | API calls | Prefetch | Duplicate API calls | 4xx / 5xx |
|---|---|---|---|---|---|---|---|
| Cashier | 560 s | 98 | 95 KB | 30 | 68 | 21 (6 parallel) | 1 x 500 |
| Branch manager | 81 s | 74 | 61 KB | 20 | 54 | 5 (0 parallel) | 1 x 500 |
| Branch manager, direct load of branch notifications | 2 s | 28 | 21 KB | 2 | 26 | 1 (parallel) | 0 |
| Owner (pharmacy) | 17 s | 51 | 43 KB | 11 | 40 | 3 (0 parallel) | 1 x 404 |
| Patient | 294 s | 41 | 44 KB | 12 | 29 | 9 (0 parallel) | 0 |
| Pharmacist | 52 s | 17 | 23 KB | 17 | not captured | 9 (4 parallel) | 2 x 500 |

### 2.2 Per page, read from the timeline

| Page (role) | API calls on load | Duplicates | Slowest call | Notes |
|---|---|---|---|---|
| /staff/dashboard (cashier) | 4: profile/me x2, attendance/my-current, orders/pharmacy-orders (19 KB) | 1 (parallel) | 3.4 to 3.8 s | Repeated on every revisit, 4 times in the session. Heaviest page |
| /branch/dashboard (manager) | 5: notifications, attendance summary, pending clock-ins, pending clock-outs, staff | 0 | 2.8 s | All five start at the same instant |
| /branch/pos (manager, cashier) | 2: my-medications (7 KB), sales/summary | 0 | 3.1 s | Page loads, but search crashes it |
| /branch/prescriptions (manager, pharmacist) | 1: prescriptions/branch | 0 | 2.3 s | Empty queue in the test data |
| /branch/notifications, direct load (manager) | 2: the same notifications call twice at +0.0 s | 1 (parallel) | 1.5 s | Topbar hook and page both fetch |
| /pharmacy/dashboard (owner) | 6, then a 404 on /users/me | 0 on load | 5.3 s (dashboard/stats) | Stats and analytics fetched again about 12 s later |
| /patient/dashboard (patient) | 3: notifications, my-orders (7.7 KB), pharmacies/locations (12 KB) | 0 | 4.7 s | Shows 6 of the pharmacies it downloads |
| /patient/notifications (patient) | 1 on mount, then 1 every 30 s | 6 polls in 150 s | 1.9 s | Polling confirmed |

### 2.3 Waste patterns found

| ID | Pattern | Evidence | File and line | Direction |
|---|---|---|---|---|
| W1 | Identical calls fired in parallel by two components | `GET /api/staff/profile/me` twice at the same instant on each staff page load. 12 duplicates in the cashier session | `hooks/useStaffPermissions.ts:38`, called by `StaffSidebar:20`, `PermissionGate:42`, `staff/orders:41`, `staff/inventory:24`, `staff/profile:84`, plus `app/staff/dashboard/page.tsx:71` | Fetch once and share |
| W2 | Payload far larger than rendered | `GET /api/orders/pharmacy-orders` returns 18,999 B on every staff dashboard load | `app/staff/dashboard/page.tsx:73`, `app/staff/orders/page.tsx:54`, `app/branch/analytics/page.tsx:109` | Summary endpoint (backend work) |
| W3 | Payload far larger than rendered | `GET /api/pharmacies/locations` returns 12,150 B, three times in 294 s | `app/patient/dashboard/page.tsx:97-98`, `services/pharmacies.ts:26` | Share, or limit server side |
| W4 | Same call fired by two components, direct load only | Two identical `GET /api/notifications?userType=branch` at +0.0 s | `components/branch/BranchTopbar.tsx:19` via `hooks/useUnreadNotifications.ts:11`, and `app/branch/notifications/page.tsx:46,73` | One shared source |
| W5 | Polling with no need | Patient notifications every 30 s | `app/patient/notifications/page.tsx:75` | Pause when hidden or poll less |
| W6 | Prefetch inflates request counts | 69% to 78% of requests are prefetches | Sidebar Link items | Report separately, consider turning prefetch off on rare links |
| W7 | 5xx on a feature (reported only) | Leave endpoints return 500 on every call | `app/staff/leave/page.tsx:36`, `app/branch/staff-leave/page.tsx:31` | Cause not investigated |
| W8 | 4xx on every dashboard load | `GET /api/users/me` returns 404 (owner) | `app/pharmacy/dashboard/page.tsx:118` | Remove or repoint the call |

### 2.4 Latency, not bytes

Almost every API response is small (largest 2.9 KB transferred) yet each call takes 1.4 to 5.3 s, even a 2 byte empty list. The cause is undetermined (database round trip, region distance, slow queries) and was not investigated.

### 2.5 Found broken while capturing

- POS medication search throws "Cannot read properties of null (reading 'toLowerCase')" and replaces the page with "Application error" (`pos/page.tsx:135`; `Medication.category` is nullable in `schema.prisma:378`). A POS sale could not be captured.
- Medications could not be selected from the POS list. Cause not confirmed.
- Every call to the leave endpoints returns 500 (W7).

## 3. Phase 2: fixes

Three patterns were selected by wasted call count from the Phase 1 data. None is a user triggered burst, so none uses a debounce. All three are fixed at the source with one shared owner for the fetch (`lib/requestCache.ts`), which shares an in flight request between concurrent callers, reuses a successful result inside a short window, never caches errors, and is cleared on login and logout so one user's data never reaches the next.

| # | Pattern | Causing files | Phase 1 evidence | Fix | Commit |
|---|---|---|---|---|---|
| F1 | `GET /staff/profile/me` fetched by every component that needs the profile, in parallel and once per `PermissionGate` | `hooks/useStaffPermissions.ts:38` (used by `StaffSidebar:20`, `PermissionGate:42`, `staff/orders:41`, `staff/inventory:24`, `staff/profile:84`), `app/staff/dashboard/page.tsx:71`, `app/staff/profile/page.tsx:92`, `hooks/useMedicationForm.ts:117` | 12 duplicate calls in the cashier session, 4 parallel in the pharmacist session | One owner in `services/staffProfile.ts`, result kept for 60 s, cleared after a profile edit | `fix(staff): share one staff profile request across sidebar, gates and pages` |
| F2 | `GET /pharmacies/locations` (12,150 B) fetched again on every page that shows pharmacies | `services/pharmacies.ts` (`fetchPharmacyLocations`), used by `patient/dashboard/page.tsx:97`, `patient/search/page.tsx:61`, `super-admin/map/page.tsx:49` | 3 calls in 294 s in the patient session | Shared result for 5 minutes. Callers get a copy so one page cannot change another's list | `fix(patient): reuse the pharmacy locations result across pages` |
| F3 | `GET /pharmacies/dashboard/stats` and `/analytics` fetched by two owner pages | `app/pharmacy/dashboard/page.tsx:102-103`, `app/pharmacy/analytics/page.tsx:152-153` | Stats and analytics fetched again about 12 s after the dashboard load in the owner session | Shared result for 30 s via `services/pharmacyDashboard.ts` | `fix(pharmacy): share dashboard stats and analytics between dashboard and analytics pages` |

Ranking basis: wasted calls in the Phase 1 report. F3 should be re-ranked against the owner HAR when it is captured. If the owner session shows a different third duplicate, swap F3.

## 4. Phase 2: results

### 4.1 Same day pair, cashier (F1)

Same account, same day, production build of `main` (before) and of the fix branch (after). Files: `har/cashier.before.sanitized.har` and `har/cashier.after.sanitized.har`.

| Measure | Before (main) | After (fix) |
|---|---|---|
| `GET /staff/profile/me` calls | 11 | 2 |
| Parallel duplicates (within 1 s) | 5 | 0 |
| Duplicate API calls, all endpoints | 15 | 4 |
| API calls | 27 | 11 |
| Prefetch requests | 26 | 34 |
| Total requests | 53 | 45 |
| Transferred (Fetch/XHR) | 65 KB | 44 KB |
| 4xx / 5xx | 1 x 400, 2 x 500 | 2 x 500 |

Notes: Same day, same account, production build. Click paths differ slightly (leave submissions, medications visits), so compare the endpoint line, not the totals.

How to read it:

- The `profile/me` line is the result for F1: 11 calls down to 2, and parallel pairs from 5 to 0. The 2 remaining calls are expected: one on the first load and one after the 60 s window expired.
- Do not quote 27 to 11 API calls as the effect of the fix. The before session also made two leave submissions and visited the medications page twice. Roughly 9 of the 16 fewer calls are `profile/me`. The rest come from the click path.
- The 4xx and 5xx differences come from what was clicked. All the failures are the known leave endpoint problem (W7).
- `orders/pharmacy-orders` (3 calls) and `attendance/my-current` (2 calls) appear in both captures. They come from real visits to the dashboard and orders pages and are intentionally not cached, so they are unchanged.

### 4.2 Per page, `/staff/dashboard` (cashier)

| | Before | After |
|---|---|---|
| API calls on load | 4: profile/me x2, attendance/my-current, orders/pharmacy-orders | 3: profile/me x1, attendance/my-current, orders/pharmacy-orders |
| Parallel duplicates on load | 1 | 0 |

Before is from the Phase 1 timeline. After is from the production capture. After that first load, no further `profile/me` call happened while moving between Orders, Inventory, Attendance and Leave for about 85 s.

### 4.3 Earlier capture on the dev server (not valid evidence)

One cashier capture was taken on `next dev`. Every endpoint that loads on mount fired twice at the same instant, which is React Strict Mode double running effects. It was discarded and is not used in any figure above.

### 4.4 Pending HAR pairs

| Session | Fix tested | Before | After | Status |
|---|---|---|---|---|
| Cashier | F1 | captured | captured | Done, see 4.1 |
| Pharmacist (5 or more prescription rows) | F1, per row permission gates | pending | pending | Pending capture |
| Patient (dashboard, then search) | F2 | pending | pending | Pending capture |
| Owner (dashboard, then analytics within 30 s) | F3 | pending | pending | Pending capture |

Reason these are pending: unreliable internet access during this period. Each capture needs a stable connection to the hosted backend for the length of a session, and that was not available, so the pharmacist, patient and owner sessions could not be recorded. This is a limit of the environment, not a result: nothing is assumed about those pages. They will be captured once a stable connection is available, or by a teammate on a preview deployment of the branch, using the same click paths and the same method as the cashier pair.

Until those pairs exist, F2 and F3 are verified by unit tests only (4.5), not by HAR.

### 4.5 Unit tests (no network)

Files: `src/__tests__/lib/requestCache.test.ts` and `src/__tests__/services/sharedRequests.test.tsx`. 13 tests pass.

| Check | Result |
|---|---|
| A sidebar plus a 15 row table with 3 permission gates per row (46 consumers) makes 1 `profile/me` request | Pass. On the old code the same test makes 46 |
| `profile/me` is read again after a profile edit | Pass |
| Two pages load pharmacy locations with 1 request, and sorting one list does not change the other | Pass |
| Dashboard then analytics make 1 stats call and 1 analytics call | Pass |
| A response that lands after logout is not stored | Pass |

These prove the code makes one call where it made several. They do not measure timing or page weight on the deployed app, which is what the HAR pairs are for.

### 4.6 API failures found in the captures (4xx and 5xx)

| Endpoint | Status | Where seen | Related to this work | Status |
|---|---|---|---|---|
| GET `/api/staff-leave/my` | 500 | Phase 1 cashier and pharmacist sessions, and both same day cashier captures (before and after) | No. It fails the same way on `main` | Open (W7). Cause not investigated |
| POST `/api/staff-leave` | 500 | Both same day cashier captures (leave submissions) | No. It fails the same way on `main` | Open (W7). Cause not investigated |
| POST `/api/staff-leave` | 400 | Same day cashier before capture only (one of two submissions) | No. It appears only in the `main` capture | Cause not investigated. The server rejected a submission, the reason is not confirmed |
| GET `/api/staff-leave/branch` | 500 | Phase 1 branch manager session | No | Open (W7). Cause not investigated |
| GET `/api/users/me` | 404 | Phase 1 owner session, every dashboard load (error swallowed in the page) | No | Open (W8). Remove the call or point it at a real endpoint |

Non API failure: typing in the POS medication search crashes the page (see 2.5), so a POS sale could not be captured.

What this shows:

* Every API failure is on the leave feature, apart from the owner `users/me` 404. All of them were already present in the Phase 1 captures, before any change, and in the same day capture of `main`. The fix branch neither adds nor removes any failing endpoint.
* The 4xx and 5xx counts in 4.1 differ between the two sessions only because of what was clicked (the before session submitted the leave form twice).
* No new failing requests appeared after the changes. This is one of the regression checks: any failure not in this table counts as a regression.

## 5. What the fixes cannot change

The 4xx and 5xx counts (W7, W8), the 30 second polls (W5), the prefetch fan out (W6), the size of `orders/pharmacy-orders` (W2), and the 1.4 s latency floor.

## 6. Remaining duplicates (not fixed this week)

| Pattern | Why left |
|---|---|
| W4: `GET /notifications?userType=branch` twice on a direct load of `/branch/notifications` | One wasted call, direct load only. The same shared request helper fixes it in two small edits. Next in the queue |
| W5 polling, W2 and W3 payload size | A different class of problem, not duplicates |
| `orders/pharmacy-orders` and `attendance/my-current` repeated on dashboard revisits | Intentionally fresh on each visit |

## 7. Corrections to Phase 1 from reading the code

"Endpoint called once per table row: not observed" was true of the HARs only because the prescription queue was empty in the test data. The pattern is present in code: `PermissionGate` calls `useStaffPermissions` inside it, and it is rendered 2 to 3 times per row in `staff/prescriptions/page.tsx:238-272`, `staff/orders/page.tsx:274-308` and `staff/inventory/page.tsx:194`. Before F1, each instance would fire its own `/staff/profile/me`. The unit test in 4.5 reproduces it (46 calls on the old code). The pharmacist capture with 5 or more rows should confirm it in a HAR.

## 8. Evidence files

| File | Contents |
|---|---|
| `har/*.sanitized.har` (Phase 1) | Six sanitized sessions: branch-manager, branch-manager-notifications, cashier, pharmacist, pharmacy-owner, patient |
| `har/cashier.before.sanitized.har`, `har/cashier.after.sanitized.har` | Phase 2 same day pair for F1 |
| `har/analyze_har.py`, `har/compare_har.py`, `har/sanitize_har.py` | Recompute numbers, compare a pair, sanitize a capture |
| `docs/qa/regression-checklist.md` | Regression checklist, with the Phase 2 corrections merged in |

Evidence handling: original HAR files contain live login tokens and passwords and are kept outside the repository. Only sanitized copies are committed. The passwords of the three test accounts that appeared in the Phase 1 originals should be changed.

## 9. Regression checklist

The checklist has not been run end to end. The Phase 2 run sheet and the six corrections are in `docs/qa/regression-checklist.md`. Record the measured run time and any corrected steps there once it has been run.

## 10. Open items

- Capture the pharmacist, patient and owner HAR pairs and fill 4.4. They were blocked by internet connectivity problems and need a stable connection or a teammate on a preview deployment.
- Run the regression checklist once and record the actual time.
- Report the leave 500s and the 400 to whoever owns that feature, and decide whether the owner `users/me` 404 call is removed or repointed (W7, W8).
- Fix W4 with the shared request helper.
- Find the source of the 1.4 s latency floor (Render region, database region and plan, then time one query directly).
- Commit date: Friday 13 November 2026 (proposed, to be recorded by Robert).
