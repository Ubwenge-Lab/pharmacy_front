# Baseline Pack v1: Public pages, PWA and offline shell

**Target:** `http://localhost:3000` (`npm run dev`) 
**Folder:** `docs/baseline_public_pwa`
**Lighthouse:** 13.5.0 (CLI, `--chrome-flags="--headless=new"`)

---

# Week 6 (30 Oct 2026): fix and re-measure, surfaces 9 and 10

**Phase 1 status:** this file and `mobile-responsiveness-sweep.md` exist from Phase 1 (11 Oct, branch `docs/baseline_public_pwa`). They were pushed but never merged into `dev`. The Phase 1 sections further down are unchanged. This section adds the fix and the before/after.

## What was changed (the single biggest cause on each surface)

| Surface | Biggest cause (from the "before" reports) | Fix |
|---|---|---|
| Landing `/` | The LCP element is the hero `<h1>`, and about 2.8 s of its LCP was **element render delay**. `src/app/page.tsx` returned a spinner while the session check was `loading`, so the server-rendered HTML was a spinner and the hero only appeared after all the JS had run. | Render the landing page while the session check runs. Logged-in users are still redirected as soon as it finishes. Also removed an unused `@sentry/nextjs` import. |
| Signup `/signup` | The LCP element was an **OpenStreetMap tile** from the Leaflet map, which loaded on page open even though it's halfway down the form. Leaflet JS is about 145 KB, plus 4 tile requests. | New opt-in `lazy` prop on `LocationPicker`: a same-size "Tap to open the map" placeholder until the user opens the map or taps "Use My Location". Signup uses it; hospital register keeps its current behaviour. |
| PWA shell (all pages) | No manifest, no theme colour, no service worker. Offline reload showed Chrome's dino page. | `src/app/manifest.ts` (name, `#1E4D8C`, `standalone`, 192/512 and maskable icons from the E-Vuze logo), `theme-color` and apple-touch icon, `public/sw.js` (navigation-only offline fallback; it does **not** cache pages or API data), `public/offline.html` (self-contained, auto-reloads when the connection returns), `ServiceWorkerRegister` (production only). |

## Method (same for before and after)

- **Tool:** Nelly's harness (`scripts/lighthouse-baseline.js` from `feat/nelly_lighthouse_harness`), Lighthouse 13.5.0, Chrome 156. Routes file: `week6-lighthouse/routes.kethia.json`.
- **Target:** local **production** builds (`next build` + `next start`). "Before" is the original code (commit `0466147`) on port 3001; "after" is this branch on port 3000.
- **Runs:** **5 runs per surface per device; medians reported.** Before and after were run back to back.
- **Noise check:** `/login` wasn't changed apart from the shared layout (theme colour and SW registration), so it serves as a control. Mobile was then re-run in **reverse order** (after first, then before) to separate real changes from run-order effects.
- These numbers **replace the Phase 1 dev-server numbers** for comparison purposes. Dev-server numbers can't be compared with a production build.

## Before / after (medians of 5)

Units: LCP and Speed Index in seconds, TBT in ms, JS and page weight in KiB transferred.

| Surface | Device | Perf | LCP | INP | CLS | TBT | Speed Index | JS | Page weight | Requests |
|---|---|---|---|---|---|---|---|---|---|---|
| **Landing** | Mobile | 84 → **86** | 4.16 → **2.99** | n/a → n/a | 0 → 0 | 151 → 390² | 1.07 → 1.09 | 398 → 398 | 480 → 483 | 32 → 32 |
| **Landing** | Desktop | 100 → 100 | 0.80 → **0.65** | n/a → n/a | 0 → 0 | 0 → 11 | 0.30 → 0.30 | 398 → 398 | 480 → 483 | 32 → 32 |
| **Signup** | Mobile | 77 → **87** | 5.75 → **2.96** | n/a → n/a | 0 → 0 | 146 → 342² | 1.61 → **1.07** | 427 → **385** | 643 → **464** | 26 → **21** |
| **Signup** | Desktop | 89 → **100** | 2.24 → **0.72** | n/a → n/a | 0 → 0 | 0 → 9 | 0.45 → **0.31** | 427 → **385** | 695 → **464** | 28 → **21** |
| Login (control) | Mobile | 92 → 88 | 3.18 → 2.96 | n/a → n/a | 0 → 0 | 92 → 295² | 1.06 → 1.07 | 396 → 396 | 481 → 481 | 32 → 32 |
| Login (control) | Desktop | 100 → 100 | 0.67 → 0.64 | n/a → n/a | 0 → 0 | 10 → 0 | 0.30 → 0.30 | 396 → 396 | 481 → 481 | 32 → 32 |

**Reverse-order check (mobile, medians of 5, after measured first):**

| Surface | Perf | LCP | TBT |
|---|---|---|---|
| Landing | 82 → 87 | 4.04 → 3.23 | 243 → 278 |
| Signup | 71 → 85 | 6.12 → 3.24 | 296 → 355 |
| Login (control) | 87 → 89 | 3.23 → 2.97 | 251 → 234 |

² **TBT: no reliable change.** In the first pair, TBT rose on all three pages, including the control. In the reverse-order pair the before and after values are close (243 vs 278, 296 vs 355, 251 vs 234). So the first-pair TBT rise came from run order, not the code. INP is n/a in lab runs (no user interaction); TBT is its lab proxy.

**Results**

- **Landing:** mobile LCP drops by **about 1.0–1.2 s** in both orders. The hero's render delay went from about 2.8 s to about 0.4 s because the hero is now in the server HTML. The score change is small because the mobile score is limited by the JS shared by every page (see next steps).
- **Signup:** mobile LCP drops from **about 5.8–6.1 s to about 3.0–3.2 s**, score rises by 10–14 points, and desktop reaches 100. Page weight is down 28% (643 → 464 KiB), JS is down 42 KiB, and there are 5 fewer requests, because Leaflet and the tiles no longer load on page open.
- **CLS stays 0.** The map placeholder has the same height as the map.
- Mobile LCP is still above the 2.5 s "good" line on both pages (about 3.0 s).

**Next biggest cause (not changed this week):** `@sentry/nextjs` with Session Replay and Feedback is a 346 KB chunk loaded on every page (about 100 KiB of it unused on load, according to Lighthouse). There's no `NEXT_PUBLIC_SENTRY_DSN` in the local `.env`, so locally it ships without reporting anything. Lazy-loading Replay is the obvious next step, but Sentry setup is a team decision, so it's flagged here rather than changed.

## PWA shell: before / after

Checked with CDP (`Page.getAppManifest`, `Page.getInstallabilityErrors`, service worker registrations) on the local production builds, which is the same data as the DevTools Application panel.

| Check | Before | After |
|---|---|---|
| Manifest | ❌ none | ✅ `/manifest.webmanifest`, no parse errors |
| Name / short name | ❌ | ✅ "E-Vuze Healthcare Hub" / "E-Vuze" |
| Theme colour `#1E4D8C` | ❌ | ✅ manifest `theme_color` and `<meta name="theme-color">` |
| Icons | ❌ 16×16 favicon only | ✅ 192, 512, maskable 512 (logo inside the safe zone), apple-touch 180 |
| `display` / `start_url` | ❌ undefined | ✅ `standalone` / `/` |
| Service worker | ❌ none | ✅ `/sw.js` **activated** and controlling the page |
| Installability (Chrome) | ❌ `no-manifest` | ✅ **no installability errors** |

## Offline behaviour: before / after

Same scenarios as Phase 1: 390×844 mobile, offline emulated over CDP for both the page and the service worker. Raw numbers are in `screenshots/offline/week6-{before,after}/pwa-offline-results.json`.

| # | Scenario | Before (original code, prod build) | After |
|---|---|---|---|
| 1 | Landing loaded, offline, **reload** | ❌ Chrome dino page (158 chars, no branding) | ✅ **E-Vuze offline page** with "Try again" |
| 2 | Landing loaded, offline, **tap "Sign up"** | ✅ Works (production prefetches the link) | ✅ Works |
| 3 | Login filled, offline, **tap Login** | ⚠️ "Network Error" toast, form kept | ⚠️ Same; the API call isn't touched by the SW |
| 4 | Signup open, offline, **reload** | ❌ Dino page, form lost | ✅ E-Vuze offline page |
| 5 | After #4, **connection restored, no reload** | ❌ Still the dino page | ✅ **Recovers by itself**: the offline page reloads on `online` and signup comes back |

Screenshots:
- Before: `screenshots/offline/week6-before/01-landing-reload-offline.png`, `04-signup-reload-offline.png`, `05-signup-after-reconnect-no-reload.png`
- After: `screenshots/offline/week6-after/01-landing-reload-offline.png`, `04-signup-reload-offline.png`, `05-signup-after-reconnect-no-reload.png`

**Desktop (1440×900), after:** `screenshots/desktop/week6-after/`

- `landing-1440.png`, `signup-1440.png` (map placeholder), `signup-map-opened-1440.png`
- `offline-landing-reload-1440.png`, `offline-signup-reload-1440.png`: the E-Vuze offline page
- `offline-signup-reconnected-1440.png`: signup back on its own after reconnecting
- `desktop-results.json`: URL, title and text length for each shot

No desktop "before" screenshots were taken. Before the fix there was no service worker, so an offline reload on desktop showed the same Chrome dino page as the 390 px "before" screenshots; only the window size differs.

Still open: scenario 3 shows a generic "Network Error". An "You appear to be offline" message in the shared axios error handler would be the follow-up.

## Functional check of the signup map

| Check | Result |
|---|---|
| Tile requests on page load | 0 (before: 4) |
| Tap "Tap to open the map", then tap the map | Map opens, marker placed, coordinates shown |
| Tap "Use My Location" before the map is opened | Map opens with the marker at the GPS position |

## Week 6 artifacts

- `week6-lighthouse/before/` and `week6-lighthouse/after/`: harness output (dashboard `index.html`, `summary.csv`, `runs.csv`, and all 30 raw `.report.json`/`.report.html` per side)
- `week6-lighthouse/{before,after}-reverse-order-check/`: CSVs for the reverse-order mobile run
- `week6-lighthouse/routes.kethia.json`: the routes file used
- `screenshots/offline/week6-before/` and `screenshots/offline/week6-after/`: offline screenshots (390 px) and raw JSON
- `screenshots/desktop/week6-after/`: desktop (1440×900) page and offline screenshots

`meta.json` `gitCommit` (`8dfad8c`) is the harness's own commit, not the app's. The app commits are given in the Method section.

**Not measured this week:** `/patient/pharmacies` (pharmacy directory). It needs the local back-end with the seeded test patient. The harness profile is ready (`patient` in `routes.kethia.json`); run it once the back-end is up.

---

# Phase 1 baseline (11 Oct 2026)

## How this was measured

- **Target:** local dev server (`npm run dev`, Next.js 16.0.8) at `http://localhost:3000`. No production build or deploy was involved.
- **Mobile:** Lighthouse default (Moto G Power emulation, simulated slow 4G, 4× CPU slowdown). **Desktop:** `--preset=desktop`.
- **One run per page per form factor.** Lighthouse scores vary from run to run. Treat differences under about 5 points as noise.
- Every page was warmed once before auditing, so the scores don't include Next.js dev compile time.
- Backend (`localhost:4000`) was **not running**. None of the measured pages need data to render.


## 1. Lighthouse results: public and login-adjacent pages

Units: LCP and Speed Index in seconds, TBT in ms, JS transferred and page weight in KiB (transfer size). Page weight = Lighthouse `total-byte-weight`.

| Surface | URL | Form factor | Perf | LCP (s) | INP | CLS | TBT (ms) | Speed Index (s) | JS (KiB) | Page weight (KiB) | Requests | Report |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Landing | `/` | Mobile | 55 | 8.3 | N/A¹ | 0.000 | 926 | 1.7 | 1,132 | 1,212 | 32 | `landing-mobile` |
| Landing | `/` | Desktop | 91 | 1.8 | N/A¹ | 0.000 | 91 | 0.9 | 1,132 | 1,212 | 32 | `landing-desktop` |
| Signup | `/signup` | Mobile | 52 | 12.0 | N/A¹ | 0.000 | 1,004 | 3.0 | 1,256 | 1,478 | 41 | `signup-mobile` |
| Signup | `/signup` | Desktop | 81 | 3.2 | N/A¹ | 0.000 | 85 | 0.9 | 1,256 | 1,530 | 43 | `signup-desktop` |
| Login | `/login` | Mobile | 62 | 4.9 | N/A¹ | 0.000 | 869 | 0.9 | 1,131 | 1,214 | 32 | `login-mobile` |
| Login | `/login` | Desktop | 97 | 1.3 | N/A¹ | 0.000 | 55 | 0.3 | 1,131 | 1,214 | 32 | `login-desktop` |
| Forgot password | `/forgot-password` | Mobile | 59 | 6.8 | N/A¹ | 0.000 | 715 | 1.0 | 1,130 | 1,212 | 32 | `forgot-password-mobile` |
| Forgot password | `/forgot-password` | Desktop | 95 | 1.6 | N/A¹ | 0.000 | 62 | 0.4 | 1,130 | 1,212 | 32 | `forgot-password-desktop` |
| Reset password | `/reset-password` | Mobile | 63 | 6.7 | N/A¹ | 0.000 | 551 | 0.9 | 1,132 | 1,215 | 32 | `reset-password-mobile` |
| Reset password | `/reset-password` | Desktop | 96 | 1.4 | N/A¹ | 0.000 | 48 | 0.3 | 1,132 | 1,215 | 32 | `reset-password-desktop` |
| Verify email | `/verify-email` | Mobile | 58 | 8.8 | N/A¹ | 0.000 | 579 | 3.5 | 1,131 | 1,214 | 32 | `verify-email-mobile` |
| Verify email | `/verify-email` | Desktop | 96 | 1.4 | N/A¹ | 0.000 | 24 | 0.3 | 1,131 | 1,214 | 32 | `verify-email-desktop` |
| Hospital register | `/hospital/register` | Mobile | 68 | 10.7 | N/A¹ | 0.000 | 316 | 3.0 | 1,248 | 1,469 | 40 | `hospital-register-mobile` |
| Hospital register | `/hospital/register` | Desktop | 86 | 2.6 | N/A¹ | 0.000 | 41 | 0.8 | 1,248 | 1,521 | 42 | `hospital-register-desktop` |

¹ **INP: N/A, not reported by a lab audit.** Lighthouse navigation mode does no user interaction, so it can't produce INP. TBT is the closest lab proxy, but it's a different metric and isn't substituted here. INP needs field data (CrUX/RUM) or a Lighthouse timespan run with scripted interactions.

### Surfaces not measured (stated, not dropped)

| Surface | URL | Why not measured | Raw report kept? |
|---|---|---|---|
| Pharmacy directory | `/patient/pharmacies` | **Needs a token.** There's no public pharmacy directory in the app. The only directory is in the patient portal, and middleware returns `307 → /` without an `accessToken` cookie. | No |
| Super-admin login | `/super-admin/login` | **Leftover route, not a live surface.** Super admins sign in on the shared `/login` page; `AuthContext` routes `SUPER_ADMIN` to `/super-admin/dashboard`. This older secret-key page isn't linked from anywhere, and the `src/app/super-admin/layout.tsx` guard redirects it to `/login` when logged out. Lighthouse measured `/login`, not this page. Candidate for cleanup. | Yes, flagged as a redirect: `super-admin-login-*` |
| Pending approval | `/pending-approval` | **Needs a session.** Redirects client-side to `/login` when there's no user (`page.tsx:26`). | Yes, flagged as a redirect: `pending-approval-*` |
| Pharmacy rejected | `/pharmacy-rejected` | **Needs a session.** Redirects client-side to `/login` when there's no user (`page.tsx:37`). | Yes, flagged as a redirect: `pharmacy-rejected-*` |

The three "redirect" report pairs are kept only as evidence of the redirect. **Don't put their numbers in the group table.** Their `finalDisplayedUrl` is `/login`.

### What stands out

- **Mobile is the problem; desktop is fine.** Desktop scores range from 81 to 97, mobile from 52 to 68. Mobile LCP is above the 2.5 s "good" threshold on every page (4.9 to 12.0 s).
- **Signup and hospital register are the heaviest pages** (40 to 43 requests, about 1.5 MB). The extra weight is the Leaflet map and its OpenStreetMap tiles, loaded eagerly even though the map is lower down the form.
- **CLS is 0.000 everywhere.** Layout stability is not an issue on public pages.
- **Every page ships about 1.1 MB of JS,** even simple ones like forgot-password. Some of that is dev-mode overhead (see caveat). Re-check it on a production build before acting on it.

## 2. PWA: manifest, installability and service worker

Checked with the Chrome DevTools Protocol (`Page.getAppManifest`, `Page.getInstallabilityErrors`, `navigator.serviceWorker.getRegistrations()`) on `/`. That's the same data the DevTools **Application** panel shows. A source check confirms it: there's no `manifest.*` in `public/` or `src/app/`, and no service worker or PWA plugin in `next.config.ts` or `package.json`.

| Check | Expected | Actual | Result |
|---|---|---|---|
| `<link rel="manifest">` | Present | **Absent** (`/manifest.json`, `/manifest.webmanifest` and `/site.webmanifest` all 404) | ❌ |
| App name / short name | "E-Vuze" | No manifest, so none. The page `<title>` is "E-Vuze Healthcare Hub". | ❌ |
| Theme colour | `#1E4D8C` | **None.** No manifest `theme_color` and no `<meta name="theme-color">`. | ❌ |
| Icons (192 px and 512 px, plus maskable) | Required for install | **Only a 16×16 `favicon.ico`.** No `apple-touch-icon` (404), no 192 or 512 icons, no maskable icon. | ❌ |
| `display` / `start_url` | `standalone` / `/` | No manifest, so `display` is undefined and Chrome falls back to the defaults. | ❌ |
| Viewport meta | Present | `width=device-width, initial-scale=1` | ✅ |
| Service worker | Registered and activated | **None registered** (`getRegistrations()` → `[]`). No `sw.js` or `service-worker.js` (404). | ❌ |
| Installability (Chrome) | No errors | **Not installable.** Chrome reports `no-manifest`. | ❌ |

**pwabuilder.com and maskable.app:** not run. PWABuilder needs a publicly reachable URL (it can't audit `localhost`), and there's no manifest or maskable icon for either tool to check. When a manifest exists, run both against the hosted URL.

**Summary:** the PWA/installable shell **doesn't exist yet**. It isn't a partly configured shell. All the items above are missing, not misconfigured.

## 3. Offline behaviour

**Method:** headless Chrome (390×844 mobile viewport) driven over CDP with `Network.emulateNetworkConditions({ offline: true })`. That's the same switch as the **Offline** option in the DevTools Network panel. Each scenario loads the page online, then cuts the connection mid-flow. Raw numbers are in `screenshots/offline/pwa-offline-results.json`.

| # | Scenario | What the user sees | Visible elements | Page text (chars) | Failed requests | Verdict |
|---|---|---|---|---|---|---|
| 0 | Landing, **online** (reference) | Normal landing page | 63 | 792 | 0 | — |
| 1 | Landing loaded, then offline, then **reload** | Chrome's "No internet" dino page (`ERR_INTERNET_DISCONNECTED`). No app UI or branding. Error shown about 1.1 s after the reload. | 19 | 158 (all Chrome's) | 1 | ❌ **Goes blank** |
| 2 | Landing loaded, then offline, then **tap "Sign up"** (client-side link) | The router's `/signup?_rsc` fetch fails, Next.js falls back to a hard navigation, and the dino page appears. The user loses the page they were on. | 19 | 158 | 3 | ❌ **Goes blank** |
| 3 | Login form filled, then offline, then **tap Login** | Stays on the page. A red **"Network Error"** toast appears and the typed email and password **are kept**. The message is generic and doesn't say "you're offline". | 55 | 194 | 2 (`/api/auth/login`) | ⚠️ **Degrades acceptably** |
| 4 | Signup open, then offline, then **reload** | Dino page. Any form progress is gone. | 19 | 158 | 1 | ❌ **Goes blank** |
| 5 | After #4, **connection restored, no reload** | Still the dino page. The app doesn't recover on its own; the user has to reload manually. | 19 | 158 | — | ❌ |

**Offline result:** with no service worker, any navigation or reload while offline replaces the app with Chrome's error page. The only graceful path is an in-page API call (scenario 3), where the existing axios error toast keeps the user on a working form.

Dev-mode note: in production, Next.js prefetches `<Link>` targets in the viewport, so scenario 2 *might* succeed for a page that was already prefetched. Reloads (scenarios 1 and 4) will still fail the same way, because nothing caches the HTML.

## 4. Artifacts

All paths are relative to `docs/baseline-2026-Q4/`.

**Lighthouse raw reports:** `lighthouse-reports/`, 20 runs, each saved as `.report.html` and `.report.json`:

- Measured: `landing-{mobile,desktop}`, `signup-*`, `login-*`, `forgot-password-*`, `reset-password-*`, `verify-email-*`, `hospital-register-*`
- Redirect evidence only, not measurements: `super-admin-login-*`, `pending-approval-*`, `pharmacy-rejected-*`
- `lighthouse-reports/first-attempt/`: the earlier manual landing run (11:07 UTC). It was superseded by the batch run so all pages share the same conditions.

**Offline screenshots:** `screenshots/offline/`

- `00-landing-online-reference.png`
- `01-landing-reload-offline.png`
- `02-landing-click-signup-offline.png`
- `03-login-submit-offline.png`
- `04-signup-reload-offline.png`
- `05-signup-after-reconnect-no-reload.png`
- `pwa-offline-results.json`: raw manifest, installability and SW data, plus the per-scenario numbers

## 5. Limitations

- These are dev-server numbers, not production (see caveat). Each page and form factor was run once, with no median of 3 or 5.
- No token was available, so the pharmacy directory and session-gated pages weren't measured (table above).
- INP isn't available from lab navigation audits.
- To re-run in Nelly's harness, use the 7 measured URLs above.
