# Baseline Pack v1: Mobile-responsiveness sweep

**Target:** `http://localhost:3000` (`npm run dev`) 
**Widths:** 390 px (390×844, mobile and touch) and 768 px (768×1024, touch)

## Method

Each surface was loaded in headless Chrome at exactly 390 and 768 px, through the same emulation the DevTools device toolbar uses, and checked by script. Every flagged item was then confirmed against the screenshot.

- **Horizontal overflow:** `document.scrollWidth > viewport`, plus any element whose box extends past the viewport edge, including inside clipped (`overflow:hidden`) containers.
- **Tap targets under 44 px:** every visible `a`, `button`, `input`, `select`, `textarea`, `[role=button]` or `[role=tab]` whose rendered width **or** height is under 44 px.
- **Tables:** clipped columns (past the viewport with no scroll container) and columns hidden by `display:none`.
- **Modals:** any `[role=dialog]`, `[aria-modal]` or `position:fixed` panel larger than the viewport.
- On signup, all three role tabs (Patient, Pharmacy Owner, Hospital) were checked.

**Row grouping:** one row = one defect on one surface at one breakpoint. Controls from the same component are one row: EN/FR/RW is one language switcher, the map's +/− is one zoom control.

## The ten surfaces

The agreed ten-surface list isn't written down anywhere in this repo, so this sweep uses the public and login-adjacent surfaces that are available, plus the pharmacy directory named in the brief. The unreachable surfaces would need a token-holding harness run.

| # | Surface | URL | 390 | 768 |
|---|---|---|---|---|
| 1 | Landing | `/` | Swept | Swept |
| 2 | Signup (Patient, Pharmacy Owner and Hospital tabs) | `/signup` | Swept | Swept |
| 3 | Login | `/login` | Swept | Swept |
| 4 | Forgot password | `/forgot-password` | Swept | Swept |
| 5 | Reset password | `/reset-password` | Swept | Swept |
| 6 | Verify email | `/verify-email` | Swept | Swept |
| 7 | Hospital register | `/hospital/register` | Swept | Swept |
| 8 | Super-admin login | `/super-admin/login` | **Not reachable.** Leftover secret-key page, not linked anywhere; it redirects to `/login`. Super admins use the shared `/login`, which is swept above. | Not reachable |
| 9 | Pending approval | `/pending-approval` | **Needs a session.** Redirects to `/login`. | Needs a session |
| 10 | Pharmacy directory | `/patient/pharmacies` | **Needs a token.** Middleware sends `307 → /`. | Needs a token |

## Defects

Evidence paths are relative to `docs/baseline-2026-Q4/`. Sizes are rendered width×height in CSS px.

| # | Surface | Width | Category | Defect | Evidence |
|---|---|---|---|---|---|
| 1 | Landing | 390 | Layout / clipping | Header is too crowded for 390 px. The "E-Vuze" logo breaks across two lines (61 px tall at a 32 px line-height), "Sign Up" wraps to two lines, and the Sign Up button sits **1 px** from the right edge. | `screenshots/responsive/landing-390.png` |
| 2 | Landing | 390 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/landing-390.png` |
| 3 | Landing | 390 | Tap target | Header "Login" button is 81 × **40** | `screenshots/responsive/landing-390.png` |
| 4 | Landing | 768 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/landing-768.png` |
| 5 | Landing | 768 | Tap target | Header "Login" button is 81 × **40** | `screenshots/responsive/landing-768.png` |
| 6 | Landing | 768 | Tap target | Header "Sign Up" button is 93 × **36** | `screenshots/responsive/landing-768.png` |
| 7 | Signup | 390 | Clipping | **Role tab bar is wider than the screen.** The bar is 371 px wide, starts at x=32 and ends at x=403, so **13 px is clipped**. The "Hospital" tab is cut off at the right edge. The page doesn't scroll sideways because a parent clips it, so the overflow is hidden from the user instead of scrollable. | `screenshots/responsive/signup-pharmacy-390.png` |
| 8 | Signup | 390 | Clipping | Pharmacy Owner tab: two-column fields at about 151 px truncate their placeholders. Email shows "pharmacy@er…", Phone "+250 7XX XX…", Address "Full pharmacy…". | `screenshots/responsive/signup-pharmacy-390.png` |
| 9 | Signup | 390 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/signup-patient-390.png` |
| 10 | Signup | 390 | Tap target | "Use My Location" button is 142 × **30** (Patient and Hospital tabs) | `screenshots/responsive/signup-patient-390.png` |
| 11 | Signup | 390 | Tap target | Map zoom + / − controls are **30 × 30** (Leaflet default) | `screenshots/responsive/signup-patient-390.png` |
| 12 | Signup | 390 | Tap target | Map attribution links "Leaflet" / "OpenStreetMap" are **14 px** tall (third-party Leaflet control) | `screenshots/responsive/signup-patient-390.png` |
| 13 | Signup | 390 | Tap target | Password show/hide toggle is **16 × 16** | `screenshots/responsive/signup-patient-390.png` |
| 14 | Signup | 390 | Tap target | "Sign in" footer link is 46 × **17** (inline text link) | `screenshots/responsive/signup-patient-390.png` |
| 15 | Signup | 390 | Tap target | Gender `<select>` is 155 × **43** (Patient tab, 1 px short) | `screenshots/responsive/signup-patient-390.png` |
| 16 | Signup | 768 | Tap target | Role tabs Patient / Pharmacy Owner / Hospital are 111–181 × **36** | `screenshots/responsive/signup-pharmacy-768.png` |
| 17 | Signup | 768 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/signup-pharmacy-768.png` |
| 18 | Signup | 768 | Tap target | "Use My Location" button is 142 × **30** | `screenshots/responsive/signup-pharmacy-768.png` |
| 19 | Signup | 768 | Tap target | Map zoom + / − controls are **30 × 30** | `screenshots/responsive/signup-pharmacy-768.png` |
| 20 | Signup | 768 | Tap target | Map attribution links are **14 px** tall | `screenshots/responsive/signup-pharmacy-768.png` |
| 21 | Signup | 768 | Tap target | Password show/hide toggle is **16 × 16** | `screenshots/responsive/signup-patient-768.png` |
| 22 | Signup | 768 | Tap target | "Sign in" footer link is 46 × **17** (inline text link) | `screenshots/responsive/signup-patient-768.png` |
| 23 | Signup | 768 | Tap target | Gender `<select>` is 248 × **43** (Patient tab) | `screenshots/responsive/signup-patient-768.png` |
| 24 | Login | 390 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/login-390.png` |
| 25 | Login | 390 | Tap target | Password show/hide toggle is **20 × 20** | `screenshots/responsive/login-390.png` |
| 26 | Login | 390 | Tap target | "Forgot Password?" link is 120 × **17** | `screenshots/responsive/login-390.png` |
| 27 | Login | 390 | Tap target | "Sign up" link is 58 × **20** (inline text link) | `screenshots/responsive/login-390.png` |
| 28 | Login | 768 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/login-768.png` |
| 29 | Login | 768 | Tap target | Password show/hide toggle is **20 × 20** | `screenshots/responsive/login-768.png` |
| 30 | Login | 768 | Tap target | "Forgot Password?" link is 120 × **17** | `screenshots/responsive/login-768.png` |
| 31 | Login | 768 | Tap target | "Sign up" link is 58 × **20** (inline text link) | `screenshots/responsive/login-768.png` |
| 32 | Forgot password | 390 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/forgot-password-390.png` |
| 33 | Forgot password | 390 | Tap target | "← Back to Login" link is 110 × **17** | `screenshots/responsive/forgot-password-390.png` |
| 34 | Forgot password | 768 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/forgot-password-768.png` |
| 35 | Forgot password | 768 | Tap target | "← Back to Login" link is 110 × **17** | `screenshots/responsive/forgot-password-768.png` |
| 36 | Reset password | 390 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/reset-password-390.png` |
| 37 | Reset password | 390 | Tap target | Password show/hide toggle is **16 × 16** | `screenshots/responsive/reset-password-390.png` |
| 38 | Reset password | 390 | Tap target | "← Back to Login" link is 110 × **17** | `screenshots/responsive/reset-password-390.png` |
| 39 | Reset password | 768 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/reset-password-768.png` |
| 40 | Reset password | 768 | Tap target | Password show/hide toggle is **16 × 16** | `screenshots/responsive/reset-password-768.png` |
| 41 | Reset password | 768 | Tap target | "← Back to Login" link is 110 × **17** | `screenshots/responsive/reset-password-768.png` |
| 42 | Verify email | 390 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/verify-email-390.png` |
| 43 | Verify email | 390 | Tap target | "Resend Code" button is 90 × **20** | `screenshots/responsive/verify-email-390.png` |
| 44 | Verify email | 390 | Tap target | "← Back to Login" link is 109 × **17** | `screenshots/responsive/verify-email-390.png` |
| 45 | Verify email | 768 | Tap target | Language switcher EN / FR / RW is 33–39 × **28** | `screenshots/responsive/verify-email-768.png` |
| 46 | Verify email | 768 | Tap target | "Resend Code" button is 90 × **20** | `screenshots/responsive/verify-email-768.png` |
| 47 | Verify email | 768 | Tap target | "← Back to Login" link is 109 × **17** | `screenshots/responsive/verify-email-768.png` |
| 48 | Hospital register | 390 | Clipping | Two-column fields at 151 px truncate their placeholders: "admin@hospital.com", "+250 7XX XXX XXX", "Hospital street address" | `screenshots/responsive/hospital-register-390.png` |
| 49 | Hospital register | 390 | Tap target | "Use My Location" button is 142 × **30** | `screenshots/responsive/hospital-register-390.png` |
| 50 | Hospital register | 390 | Tap target | Map zoom + / − controls are **30 × 30** | `screenshots/responsive/hospital-register-390.png` |
| 51 | Hospital register | 390 | Tap target | Map attribution links are **14 px** tall | `screenshots/responsive/hospital-register-390.png` |
| 52 | Hospital register | 390 | Tap target | Password show/hide toggle is **16 × 16** | `screenshots/responsive/hospital-register-390.png` |
| 53 | Hospital register | 390 | Tap target | "Sign in" footer link is 46 × **17** (inline text link) | `screenshots/responsive/hospital-register-390.png` |
| 54 | Hospital register | 768 | Tap target | "Use My Location" button is 142 × **30** | `screenshots/responsive/hospital-register-768.png` |
| 55 | Hospital register | 768 | Tap target | Map zoom + / − controls are **30 × 30** | `screenshots/responsive/hospital-register-768.png` |
| 56 | Hospital register | 768 | Tap target | Map attribution links are **14 px** tall | `screenshots/responsive/hospital-register-768.png` |
| 57 | Hospital register | 768 | Tap target | Password show/hide toggle is **16 × 16** | `screenshots/responsive/hospital-register-768.png` |
| 58 | Hospital register | 768 | Tap target | "Sign in" footer link is 46 × **17** (inline text link) | `screenshots/responsive/hospital-register-768.png` |

Signup and hospital register scroll inside an inner container, so their "full-page" screenshots only show the first viewport. The defects lower down (password toggle, "Sign in" link) were found from the DOM measurements in `sweep-results.json`.

## Checks with zero defects

| Check | Result on all 7 reachable surfaces at both widths |
|---|---|
| Page-level horizontal scroll (`scrollWidth > viewport`) | **0.** No page scrolls sideways. The one real overflow (#7) is hidden by a clipping parent. |
| Tables hiding or clipping columns | **0.** No public surface contains a table. Tables live in token-gated portals that couldn't be reached. |
| Modals exceeding the viewport | **0.** No public surface opens a modal or dialog on load or through its main controls. |

## Summary

| | Count |
|---|---|
| Surfaces in scope | 10 |
| Surfaces swept | 7 (14 viewport checks, plus 2 extra signup tabs at each width) |
| Surfaces not reachable | 3: super-admin login (leftover route, redirects to `/login`), pending approval (needs a session), pharmacy directory (needs a token) |
| **Defect rows logged** | **58** |
| At 390 px | 30 |
| At 768 px | 28 |
| Layout or clipping (not tap targets) | 4: #1, #7, #8, #48 |
| Tap targets under 44 px | 54 |

**Distinct root causes behind the 58 rows (fixing a shared component clears many rows):**

1. Language switcher EN/FR/RW, 28 px tall: 12 rows across 6 surfaces
2. Password show/hide icon button, 16–20 px: 8 rows
3. Text links with no padding ("Back to Login", "Forgot Password?", "Sign in/up"), about 17–20 px tall: 14 rows
4. Leaflet map controls (zoom 30 px, attribution 14 px): 8 rows. These are third-party defaults and can be enlarged with CSS.
5. "Use My Location" button, 30 px: 4 rows
6. Smaller one-off issues: Resend Code (2), role tabs at 768 (1), gender select at 43 px (2), header Login/Sign Up (3)
7. Layout at 390: signup role-tab bar clipped (#7), landing header crowding (#1), two-column field truncation (#8, #48)

**Highest-impact items:** #7 (a role tab is partly off-screen on the signup page, which is every new user's first screen on a phone) and #1 (landing header at 390).

Raw data: `screenshots/responsive/sweep-results.json` and `screenshots/responsive/sweep-results-signup-pharmacy.json`.
