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
| npm test | Run the Jest test suite |
| npm run test:cov | Run tests with coverage report |

---

## Running CI gates locally

Run these before pushing to catch failures before CI does:

```bash
# 1. Lint (no auto-fix — mirrors what CI runs)
npx eslint .

# 2. Type check
npx tsc --noEmit

# 3. Tests with coverage
npm run test:cov

# 4. Production build
npm run build

# 5. Dependency vulnerability check
npm audit --audit-level=high
```

The coverage threshold is set in `jest.config.js` (`coverageThreshold.global.lines`). After running `npm run test:cov`, record the output percentage and bump the threshold to match — it should only ever go up.

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
