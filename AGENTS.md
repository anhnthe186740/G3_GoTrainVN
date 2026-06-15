# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

Run from the root (npm workspaces monorepo):

```bash
npm install          # install all workspace dependencies
npm run dev          # start client (port 5173) and server (port 5000) together
npm run client       # start frontend only
npm run server       # start backend only
npm run build        # build both workspaces
npm run lint         # lint both workspaces
npm run format       # prettier-format all files
```

Server-specific (run from `server/`):

```bash
npm run prisma:generate   # regenerate Prisma client after schema changes
npm run prisma:dbpush     # push schema changes to MongoDB Atlas
```

## Environment setup

Copy `server/.env.example` to `server/.env` and set:

- `DATABASE_URL` — MongoDB Atlas connection string
- `JWT_SECRET` — signing secret for JWTs
- `JWT_EXPIRES_IN` — token lifetime (default `7d`)
- `CLIENT_URL` — allowed CORS origin (e.g. `http://localhost:5173`)

The client reads `VITE_API_URL` (default: `http://localhost:5000/api/v1`) from `client/.env`.

## Architecture

### Monorepo structure

npm workspaces with two packages: `client/` (React/Vite, ESM) and `server/` (Express, ESM). No TypeScript — both packages use plain JS/JSX. Husky runs lint-staged on pre-commit; CI (`.github/workflows/ci.yml`) runs lint + build on pushes to `main`/`develop` and all PRs.

### Server (`server/src/`)

Entry point is `server.js` → `app.js`. Request lifecycle:

1. Global middleware: CORS, JSON body, cookie-parser, morgan logger
2. Routes: `/api/v1/auth` and `/api/v1/users`
3. Not-found handler → centralized error handler

**Route → Controller → Service** layering:

- Routes (`routes/`) define validation rules via `express-validator` and call `validate` middleware before the controller.
- Controllers (`controllers/`) are thin — they call service functions and shape the HTTP response.
- Services (`services/`) contain business logic and all Prisma calls.
- Wrap every async controller with `asyncHandler` (from `utils/asyncHandler.js`) so thrown errors flow to the error handler automatically.

**Auth**: `auth.service.js` hashes passwords with bcrypt, issues JWTs signed with `JWT_SECRET`. On login the token is set as an `httpOnly` cookie _and_ returned in the JSON body. `authMiddleware` (`middlewares/auth.js`) accepts the token from either `req.cookies.token` or `Authorization: Bearer <token>`.

**Database**: Prisma ORM against MongoDB Atlas. Schema lives in `server/prisma/schema.prisma`. The `User` model uses MongoDB ObjectId (`@db.ObjectId`). Run `prisma:generate` after any schema edit.

### Client (`client/src/`)

**Routing** (`App.jsx`): React Router v6 nested under `<AppLayout>`. Route guards:

- `ProtectedRoute` — redirects to `/login` if no token in Zustand store.
- `PublicRoute` — redirects authenticated users away from login/register.

**State**: Zustand `authStore` holds `{ user, token }` in memory. Token is not persisted to localStorage, so it is lost on page refresh (the httpOnly cookie keeps the session alive server-side, but the client guard will redirect to login until the app re-hydrates from an API call).

**API**: A single Axios instance (`services/api.js`) with `withCredentials: true` targets `VITE_API_URL`. Use this instance for all requests so cookies are sent automatically.

**Data fetching**: TanStack Query for server state; Zustand for auth state only.

**UI**: Tailwind CSS for styling. Reusable primitives are in `components/ui/` (Button, Card, Input). Layout shell in `components/layout/` (AppLayout wraps the entire route tree via `<Outlet>`). Toast notifications via Sonner; icons via Lucide React.
