# Network Request Audit — Baseline 2026-Q4

Captured 2026-10-25 on the deployed app (`evuze.ubwengelab.rw` → API `pharmacy-backend-jaqu.onrender.com`), Chrome DevTools, one HAR per role. Code references are to `pharmacy_front-main` and `back-end-main`.
Owner: Daniel · Commit date: ___

## Scope
Pharmacy portal only (owner, branch manager, cashier, pharmacist, patient). The hospital portal is out of scope for this task and is not audited.

## Read this first (limits of the data)
- **Fetch/XHR only.** The HARs were filtered to Fetch/XHR, so JS, CSS, images and fonts are **not** in any total. "Transferred" here is understated and must not be quoted as page weight.
- **One HAR = one session across several pages**, not one page. Per-page numbers below are read from the timeline.
- Only **6 sessions** exist. **Not captured, and why:** a **POS sale** and the cashier's `/branch/dashboard` (both blocked: the POS page is broken, see "Known broken" below); a login for patient/manager (their sessions were already logged in); any 401/refresh event.
- Pharmacist HAR has no Next prefetch entries, so its totals are not comparable with the others on that axis.
- Response bodies were removed from the committed copies (see below).

## Evidence files (`har/`)
Sanitized: auth headers, cookies, request bodies (login passwords) and all response bodies removed; sizes and timings kept. Originals contained live tokens and login passwords for the cashier, pharmacist and owner accounts, so **never commit or share the originals, and change those three test passwords.**

| File | Role | Entries |
|---|---|---|
| `har/branch-manager.sanitized.har` | BRANCH_MANAGER | 74 |
| `har/branch-manager-notifications.sanitized.har` | BRANCH_MANAGER, direct load of `/branch/notifications` | 28 |
| `har/cashier.sanitized.har` | CASHIER | 98 |
| `har/pharmacist.sanitized.har` | PHARMACIST | 17 |
| `har/pharmacy-owner.sanitized.har` | PHARMACY (owner) | 51 |
| `har/patient.sanitized.har` | PATIENT | 41 |

Re-run any time: `python har/analyze_har.py har/<file>.har` (no jq needed).

## Per-session table (Fetch/XHR only)
"Prefetch" = Next.js `<Link>` route prefetches (`/…?_rsc=…`), not API calls.

| Session | Span | Total requests | Transferred | API calls | Prefetch | Duplicate API calls¹ | 4xx/5xx |
|---|---|---|---|---|---|---|---|
| Cashier | 560 s | **98** | 95 KB | 30 | 68 | **21** (6 parallel) | 1 × 500 |
| Branch manager | 81 s | 74 | 61 KB | 20 | 54 | 5 (0 parallel) | 1 × 500 |
| Branch manager, direct load `/branch/notifications` | 2 s | 28 | 21 KB | 2 | 26 | **1 (parallel)** | 0 |
| Owner (pharmacy) | 17 s | 51 | 43 KB | 11 | 40 | 3 (0 parallel) | 1 × 404 |
| Patient | 294 s | 41 | 44 KB | 12 | 29 | 9 (0 parallel) | 0 |
| Pharmacist | 52 s | 17 | 23 KB | 17 | not captured | 9 (4 parallel) | 2 × 500 |

¹ Same method + URL seen more than once in the session. **Parallel** = fired within 1 s of the same call, which is the real waste. The rest are repeats on later navigation (no client cache) or polls.

**Heaviest session: cashier — 98 requests, 21 duplicate API calls, 12 of them `GET /api/staff/profile/me`.**
**Heaviest page: `/staff/dashboard` (and other `/staff/*` pages) — every load fires `/staff/profile/me` twice in parallel (1 duplicate per load; 3 identical calls once at +559.6 s).**

### Per-page reading from the timeline
| Page (role) | API calls on load | Duplicates | Slowest call | Notes |
|---|---|---|---|---|
| `/staff/dashboard` (cashier) | 4: `profile/me` ×2, `attendance/my-current`, `orders/pharmacy-orders` (19 KB body) | 1 (parallel) | 3.4–3.8 s | Repeated on each revisit, 4 times in the session. |
| `/branch/dashboard` (manager) | 5: notifications, attendance summary, pending-clock-ins, pending-clock-outs, staff | 0 | 2.8 s | All 5 start at the same instant (good). |
| `/branch/pos` (manager, cashier) | 2: `medications/pharmacy/my-medications` (7.2 KB body), `pos/sales/summary` | 0 | 3.1 s | Sale itself not captured. |
| `/branch/prescriptions` (manager, pharmacist) | 1: `prescriptions/branch` | 0 (2nd call at +25.9 s is a filter/revisit) | 2.3 s | Body 2 bytes (empty queue): test data is empty. |
| `/pharmacy/dashboard` (owner) | 6: notifications, stats, analytics, daily-revenue, weekly-revenue, profile/me; then `/users/me` | 0 on load; stats+analytics refetched at +17 s | **5.3 s** (`dashboard/stats`) | `/users/me` returns **404**. |
| `/patient/dashboard` (patient) | 3: notifications, `orders/my-orders` (7.7 KB), `pharmacies/locations` (12.2 KB) | 0 | 4.7 s | Page shows only 6 of the pharmacies it downloads. |
| `/patient/search` (patient) | 1: `pharmacies/locations` (12.2 KB) | n/a | 3.8 s | Same payload fetched again. |
| `/branch/notifications` direct load (manager) | 2: `GET /notifications?userType=branch` ×2 at +0.0 s | **1 (parallel)** | 1.5 s | Topbar hook + page both fetch. Body 2 B (empty list). |
| `/patient/notifications` (patient) | 1 on mount, then **1 every ~30 s** | 6 polls in 150 s | 1.9 s | Polling confirmed. |

## Waste patterns — status after measurement

| ID | Pattern | Status | Evidence | File:line | Effect |
|---|---|---|---|---|---|
| **W12** | **Identical calls fired in parallel by two components** | **CONFIRMED** | `GET /api/staff/profile/me` ×2 at the same instant on each staff page load (cashier +4.3, +25.4, +46.4, +550.7 s; 3× at +559.6 s; pharmacist +3.2, +24.3, +33.1, +51.9 s). 12 duplicates in the cashier session. | `hooks/useStaffPermissions.ts:38` (called per component: `components/staff/StaffSidebar.tsx:20`, `components/shared/PermissionGate.tsx:42`, `app/staff/orders/page.tsx:41`, `app/staff/inventory/page.tsx:24`, `app/staff/profile/page.tsx:84`) plus `app/staff/dashboard/page.tsx:71` | Each fetch is a separate state; no sharing. Fix: put permissions in `AuthContext` or one provider. |
| **W2** | **Polling without need** | **CONFIRMED** | Patient session: `GET /api/notifications?userType=patient` at +144, +174, +204, +235, +265, +294 s. | `app/patient/notifications/page.tsx:75`; same pattern in `branch/`, `pharmacy/`, `super-admin/` notification pages (not captured) | Poll runs even if the tab is hidden; topbar badge does not poll, so it goes stale. Payload is small (647 B). |
| **W3** | **Payload larger than rendered** | **CONFIRMED** | `GET /api/pharmacies/locations` body 12,150 B, 3 times in 294 s; the dashboard keeps 6 items. | `app/patient/dashboard/page.tsx:97-98`; `services/pharmacies.ts:26`; backend `pharmacies.service.ts:832` | Whole list downloaded, 6 rendered. Grows with every pharmacy. |
| **W16** | **Payload larger than rendered** | **CONFIRMED** | `GET /api/orders/pharmacy-orders` body 18,999 B, 4× in the cashier session and on every staff dashboard load. | `app/staff/dashboard/page.tsx:73`, `app/staff/orders/page.tsx:54`, `app/branch/analytics/page.tsx:109` | The dashboard only needs today's counts. Fix: server-side summary endpoint. |
| **W15** | **Prefetch inflates request counts** | **CONFIRMED** | 54 / 68 / 40 / 29 of the requests (74% / 69% / 78% / 71%) are `?_rsc=` prefetches; each sidebar route is prefetched 3–4 times with different tokens (e.g. 6 for `/branch/notifications`). | `components/*/…Sidebar.tsx` `<Link>` items (Next 16 prefetch) | Small bytes (0.6–1.0 KB) but slow (0.3–4 s each). Count separately from API. Fix option: `prefetch={false}` on low-traffic links. |
| **W13** | **5xx on a feature** | **CONFIRMED** | `GET /api/staff-leave/branch` → 500 (manager); `GET /api/staff-leave/my` → 500 (cashier ×1, pharmacist ×2). Every call fails, so the leave page is broken for all roles. | `app/branch/staff-leave/page.tsx:31`, `app/staff/leave/page.tsx:36`; backend `staff-leave.controller.ts:34,41`, `staff-leave.service.ts:67,84` | **Reported only; cause not investigated (out of scope for this task).** |
| **W14** | **4xx on every dashboard load** | **CONFIRMED** | `GET /api/users/me` → 404 at +9.9 s, owner session. | `app/pharmacy/dashboard/page.tsx:118` (fallback when `representativeName` is missing; error is swallowed) | Wasted request plus a hidden failure. |
| **W1** | **Same call fired by two components** | **CONFIRMED** (direct load only) | Manager direct load of `/branch/notifications`: two identical `GET /api/notifications?userType=branch` at +0.0 s, both 200, 1.47 s each. In normal navigation (earlier manager, patient, owner HARs) only one fires. | `components/branch/BranchTopbar.tsx:19` via `hooks/useUnreadNotifications.ts:11`, and `app/branch/notifications/page.tsx:46,73` | Same pattern expected on `/pharmacy/notifications` and `/patient/notifications` (not captured). Fix: share one source. |
| W4 | Unbounded notifications payload | Not a problem yet | 647 B (patient), 2 B (branch). | `notifications.service.ts:33` (no `take`) | Test data is small; risk grows with history. |
| W6 | Manager-only call on a shared dashboard | **Not measured (blocked)** | Cashier cannot be captured on `/branch/dashboard` because the counter workspace (POS) is broken. Manager: `/api/staff` returns 200. | `app/branch/dashboard/page.tsx:32-36`; `staff.controller.ts:42-43` | Open until the POS is working. |
| W9 | Refresh storm | Not observed | No 401 in any HAR. | `lib/api.ts` 401 handler | Needs an expired-token test. |
| W10 | Timeout GET retry | Not observed | No retried duplicates in parallel. | `lib/api.ts:36-44` | — |
| W11 | Summary refetch after each sale | **Not measured (blocked)** | No sale could be completed (POS broken). | `app/branch/pos/page.tsx:104-108, 270` | Open. |
| — | Requests finishing after unmount | Not measurable from HAR | Needs a React profiler or code review. | `hooks/useUnreadNotifications.ts:8-20`, `app/patient/dashboard/page.tsx:67-70` have no cancellation | Code-only finding. |

### Known broken (recorded, not fixed here)
| Item | What happens | Effect on this audit |
|---|---|---|
| **POS medication search (W17)** | Typing in the search box crashes `/branch/pos` with "Application error". | POS sale baseline **not captured**. |
| **POS medication selection** | Reported by the tester: medications cannot be selected from the list. | POS sale baseline **not captured**; cashier cannot reach `/branch/dashboard` through the counter workspace switch, so W6 is **not measured**. |
| **Leave pages (W13)** | `staff-leave/my` and `staff-leave/branch` return 500 on every call. | Reported only. |

### Bug found while capturing (not a network issue)
**W17: POS medication search crashes the page.** Typing in `/branch/pos` search throws `Cannot read properties of null (reading 'toLowerCase')` and the whole page is replaced by "Application error". Cause: `category` is nullable in the database (`Medication.category String?`, `schema.prisma:378`) but `app/branch/pos/page.tsx:134-135` calls `m.category.toLowerCase()`. Same pattern in `app/branch/inventory/page.tsx:42-43` and `app/patient/pharmacies/[id]/page.tsx:91-92`. Money-path page, so it blocks the baseline POS sale capture. **Recorded only; no fix is part of this task.**

### Biggest finding: latency, not bytes
Every API response is small (most under 3 KB transferred, largest 2.9 KB), yet each call takes **1.4–5.3 s**. Even a 2-byte empty list took 1.4–2.1 s, and the slowest is `GET /api/pharmacies/dashboard/stats` at 5.3 s. The floor of about 1.4 s per call points at hosting/database latency (Render plus remote DB), so **cutting request count and parallel calls matters more than trimming payloads.** The backend log at 13:12 showed a cold start of about 10 s, so check whether the cold-start effect shaped the first calls.

### Ranked by expected saving
1. **W12** `profile/me` duplicates, 12 wasted calls per 10-minute staff session, each 2–3 s, on the page every cashier sees.
2. **W16** 19 KB orders list on every staff dashboard load.
3. **W3** 12 KB pharmacies list ×3 on patient pages.
4. **W2** 30 s notification polling on every notifications page.
5. **W15** prefetch fan-out (70% of requests).
6. **W13 / W14** failing calls (correctness first).

## Still to capture (optional, if time allows)
1. HAR filtered to **All** (not Fetch/XHR) for one page per role, to get true page weight.
2. Cold-cache and warm-cache run of the two heaviest pages.
3. A 35 s wait on `/branch/notifications` to catch the branch poll (polling is already confirmed on the patient page).
4. **Blocked until the POS is fixed:** POS sale (W11) and cashier on `/branch/dashboard` (W6).
