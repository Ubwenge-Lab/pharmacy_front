## Overview

Frontend for the Ubwenge Lab pharmacy platform — a multi-role system connecting patients, pharmacies, branches, staff, and administrators for medication ordering, inventory, and fulfilment.

**`pharmacy_front`** is a Next.js (App Router) application serving five distinct roles from a single codebase. Each role has its own portal, enforced at the edge using middleware based on the user’s session token.

The frontend communicates with a separate backend API via HTTP using JWT-based authentication (access + refresh tokens stored in cookies).

---

## Portals

| Portal | Route | Description | Notes |
|--------|------|-------------|------|
| Patient | `/patient/*` | End users ordering medication | Feature-flagged |
| Pharmacy | `/pharmacy/*` | Pharmacy owners / representatives | Access depends on application status |
| Branch | `/branch/*` | Branch managers | Inventory, staff, transfers |
| Staff | `/staff/*` | Pharmacists, cashiers, nurses | First login requires password reset |
| Super Admin | `/super-admin/*` | Platform administrators | Approvals, analytics, oversight |

---

## Tech Stack

| Area | Technology |
|------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19 + Tailwind CSS v4 |
| Language | TypeScript 5 |
| State/Auth | Context API + JWT (cookies) |
| API | Axios (with interceptors + token refresh) |
| i18n | i18next (EN / FR / Kinyarwanda) |
| Maps | Leaflet / react-leaflet |
| Charts | Recharts |
| Notifications | react-hot-toast |
| Icons | Heroicons |
| Linting | ESLint 9 |

---

## Getting Started

### Requirements

- Node.js 20+
- npm
- Running backend API (default: `http://localhost:4000/api`)


### Setup

```bash
git clone https://github.com/Ubwenge-Lab/pharmacy_front.git
cd pharmacy_front

npm install

cp .env.example .env.local
# edit .env.local

npm run dev
```

Open: http://localhost:3000

> Patient portal is disabled by default. Enable it with:
>
> NEXT_PUBLIC_ENABLE_PATIENT_FEATURES=true

---

## Environment Variables

| Variable | Default | Purpose |
|----------|--------|---------|
| NEXT_PUBLIC_API_URL | localhost API | Backend base URL |
| NEXT_PUBLIC_ENABLE_PATIENT_FEATURES | false | Enables patient portal |
| NEXT_PUBLIC_SUPPORT_EMAIL | info@ubwengelab.rw | Support contact |

### Backend API environments

`NEXT_PUBLIC_API_URL` points at whichever backend you're developing against.
The known targets (also listed as commented toggles in
[`.env.example`](.env.example) — uncomment the one you need):

| Environment | URL |
|---|---|
| Local | `http://localhost:4000/api` |
| Hosted (Render) | `https://pharmacy-backend-hmir.onrender.com/api` |
| Ubwenge Lab server | `http://evuze.ubwengelab.rw/api` |

---

## Scripts

| Command | Purpose |
|---------|--------|
| npm run dev | Development server |
| npm run build | Production build + typecheck |
| npm run start | Run production build |
| npm run lint | Lint code |
| npm run lighthouse:baseline -- --routes <file> | Authenticated Lighthouse baseline (see below) |

---

## Lighthouse baseline harness

One command, one ruler: every performance number in the Q4 Baseline Pack comes from `scripts/lighthouse-baseline.js`. It logs in, runs Lighthouse on a fixed route list (mobile and desktop, 3 runs each, median taken), and writes JSON + HTML reports, CSVs and a dashboard into a date-stamped folder.

### Prerequisites

- Node 20+ and `npm install` (pins `lighthouse@13.5.0` and `puppeteer@25.12.0` exactly, so numbers stay comparable).
- Google Chrome installed (the harness uses your installed Chrome; set `LH_CHROME_PATH` if it is somewhere unusual).
- A **test account** per role you measure. Reports contain screenshots of the page, so never use an account with real patient data.

### Run it

```bash
# 1. Review the plan, no credentials needed
npm run lighthouse:baseline -- --routes lighthouse/routes.example.json --dry-run

# 2. Real run
npm run lighthouse:baseline -- --routes lighthouse/routes.example.json
```

Useful flags: `--only pharmacy-dashboard,login`, `--devices mobile`, `--runs 5`, `--base-url http://localhost:3000` (or env `LH_BASE_URL`), `--out <dir>`, `--help`.

### Measuring your own surfaces

Copy `lighthouse/routes.example.json`, keep your four surfaces, and pass it with `--routes` (or env `LH_ROUTES`). Each route has a `surface` name, a `path`, and an `auth` value: `none` for public pages or the name of a profile under `profiles`. Profiles exist because the middleware gates every portal by role. One login cannot cover `/pharmacy/*` and `/hospital/*`. Optional `targets` in the same file override the colour thresholds.

### Passing a session

E-Vuze keeps the session in **cookies** (`accessToken`, `refreshToken`, `userRole`, `user`). `src/middleware.tsx` reads them server-side and `src/lib/api.ts` reads `accessToken` client-side with `js-cookie`. That is why the harness does **not** use `lighthouse --extra-headers "Authorization: Bearer …"`: the backend would accept the header, but the Next.js middleware never sees it and redirects to `/`. A `Cookie:` extra header also fails, because it never reaches `document.cookie`. The harness signs in through the real UI with Puppeteer instead, then runs Lighthouse in that same browser with `disableStorageReset` and clears the HTTP cache before every run.

Credentials come from environment variables, one set per profile `<P>` (upper-cased profile name):

| Variable | Use |
|---|---|
| `LH_<P>_EMAIL` + `LH_<P>_PASSWORD` | **Preferred.** Logs in at the profile's `loginPath` (default `/login`) and logs in again automatically when the token is under 5 minutes from expiry. |
| `LH_<P>_ACCESS_TOKEN` (optional `LH_<P>_REFRESH_TOKEN`) | Fallback. The value is injected as the `accessToken` cookie. |

Put them in `.env.lighthouse` at the repo root. Start from `.env.lighthouse.example`. The file is gitignored and real environment variables take precedence. **Never commit credentials or tokens.**

### Refreshing an expired token

Access tokens live about **30 minutes**. With email + password nothing needs doing. If you use `LH_<P>_ACCESS_TOKEN` and the harness reports `expired` or `expires in under 5 minutes`:

1. Log in to the environment in Chrome as the test user.
2. DevTools → Application → Cookies → copy the `accessToken` value.
3. Replace the value in `.env.lighthouse` and re-run.

### What counts as a failure

The command exits non-zero, with a clear message, in each of these cases. It never writes a silently empty report.

- `1`: missing credentials, route file errors, environment unreachable, Chrome missing, or login rejected. Nothing is measured.
- `2`: the reports were written, but at least one run failed. A protected route that ends anywhere other than its own path (for example, redirected to `/`) is marked **FAILED** with no score and sorted to the top of the dashboard. The same happens when a protected page stays on its URL while any of its data requests fail (401/403, 404, 5xx), which would otherwise render an empty state and score better than the real page.

### Where reports land

`lighthouse-reports/<YYYY-MM-DD_HHMMSS>/` (gitignored):

| File | Contents |
|---|---|
| `index.html` | Dashboard: one row per surface × device with the median of N runs, colour-coded against target, **worst first**, with links to every run's report |
| `runs.csv` | One row per run: surface, device, score, LCP, INP, CLS, TBT, Speed Index, FCP, JS bytes, request count, Lighthouse + Chrome version, report paths |
| `summary.csv` | Medians per surface × device, with the min–max score spread |
| `reports/*.report.json` / `*.report.html` | Raw Lighthouse result for every run. Keep the JSON: everything downstream is derived from it. |
| `meta.json` | Base URL, Lighthouse/Chrome/Node versions, Chrome flags, git commit, targets |

`--dashboard-only <run folder>` rebuilds the dashboard and CSVs from an existing folder.

### Reading the numbers

- Medians of 3 runs are used because single Lighthouse runs are noisy. Check the "Spread" column, and if it is wide, re-run with `--runs 5`.
- Mobile uses Lighthouse's default throttled mobile profile, which is the one the roadmap tracks. Desktop uses the desktop preset.
- **INP is `n/a`.** It needs real user interactions, which a navigation-mode lab run cannot measure. **TBT** is its lab proxy. ([web.dev/vitals](https://web.dev/articles/vitals))
- Default targets are the Core Web Vitals "good" thresholds: score ≥ 90, LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms, Speed Index ≤ 3.4 s, FCP ≤ 1.8 s. JS ≤ 350 KB and ≤ 50 requests are team budgets.
- Every row records the Lighthouse and Chrome versions, so a tool upgrade shows up in the data.
- When a number looks wrong, get a second opinion from [WebPageTest](https://www.webpagetest.org/).

### Reproducing a published number

1. Check out the commit in the published run's `meta.json` (`gitCommit`) and run `npm ci`.
2. Use the same routes file (`meta.json` → `routesFile`) and base URL.
3. Run `npm run lighthouse:baseline -- --routes <that file> --only <surface>`.
4. Compare medians, not single runs. Expect ±5 score points from network and server variance.

A sample run is committed in `docs/baseline-2026-Q4/lighthouse-harness-sample/`. Not in CI yet, by policy.

---

## Project Structure

```
src/
├── app/                    # App Router — one folder per route
│   ├── patient/            # Patient portal (feature-flagged)
│   ├── pharmacy/           # Pharmacy owner portal
│   ├── branch/             # Branch manager portal
│   ├── staff/              # Pharmacist / cashier / nurse portal
│   ├── super-admin/        # Platform admin portal
│   ├── login/ signup/ ...  # Public auth & onboarding routes
│   └── layout.tsx          # Root layout (providers, i18n, toasts)
├── components/
│   ├── shared/             # Cross-portal components (StatusBadge, LoadingSpinner, …)
│   ├── map/                # Leaflet map building blocks
│   ├── guards/             # Client-side route guards
│   └── <portal>/           # Per-portal sidebars, topbars, views
├── context/                # React context providers (AuthContext, CartContext)
├── hooks/                  # Reusable hooks (useFetch, useGeolocation, …)
├── lib/
│   ├── api.ts              # axios instance + auth API + token refresh
│   ├── auth.ts             # token & cached-user helpers
│   ├── constants.ts        # shared constants (FDA categories, polling, …)
└── DESIGN_TOKENS.md        # Brand tokens & UI conventions
```

---

## Architecture Highlights


- **Role-based routing at the edge.** `src/middleware.tsx` runs on every `/patient`, `/pharmacy`, `/branch`, `/staff`, and `/super-admin` request. It reads the session token, derives the user's role and account status, and redirects anyone who doesn't belong.
- **Status-aware pharmacy access.** Pharmacy accounts route differently based on `PENDING` / `REJECTED` / `APPROVED` application status.
- **Centralised API layer.** All requests go through the shared axios instance in `src/lib/api.ts`, which attaches the access token and transparently refreshes it on a `401` using the refresh token.
- **Auth context.** `AuthContext` exposes `login`, `logout`, and the current user, and handles post-login routing per role.

For a deeper walkthrough, see [`docs/architecture.md`](docs/architecture.md).

---

## Conventions

- **Design tokens & UI patterns** are documented in [`src/DESIGN_TOKENS.md`](src/DESIGN_TOKENS.md). Use brand token utilities (`bg-brand-navy`, `text-brand-teal`, …) rather than raw hex values.
- **Status pills** use the shared `StatusBadge` (`src/components/shared/StatusBadge.tsx`) — don't hand-roll status colours.
- **Icons** come from Heroicons; size them with Tailwind (`w-5 h-5`).
  
---

## Internationalization

Supported languages:
- English
- French
- Kinyarwanda

---

## Documentation

- architecture.md — system design
- i18n.md — translation workflow
- support-tickets-api-spec.md — API contract
- DESIGN_TOKENS.md — UI system

---

## Maintainers

Lead: @tresor-01

---
> Internal Ubwenge Lab project. Proprietary — © Ubwenge Lab. All rights reserved. See [LICENSE](LICENSE).
