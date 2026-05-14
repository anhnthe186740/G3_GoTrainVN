# Project Name

A production-ready fullstack monorepo starter for a team of 5 developers.

## Stack

- Frontend: React, Vite, React Router DOM, Axios, Tailwind CSS, React Hook Form, Zustand, TanStack Query, Sonner, Lucide React
- Backend: Node.js, Express.js, Prisma ORM, MongoDB, JWT, bcryptjs, cookie-parser, cors, dotenv, express-validator, morgan
- Dev tools: ESLint, Prettier, Husky, lint-staged, Nodemon, Concurrently

## Structure

- `client/` - React application
- `server/` - Express API
- `docs/` - architecture and collaboration notes
- `.github/workflows/` - CI checks

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

- Copy `server/.env.example` to `server/.env`
- Update values for your MongoDB Atlas cluster and JWT secret

3. Run the development stack:

```bash
npm run dev
```

## Scripts

- `npm run dev` - start client and server together
- `npm run client` - start the frontend only
- `npm run server` - start the backend only
- `npm run build` - build both apps
- `npm run lint` - lint both apps
- `npm run format` - format project files

## Collaboration guide for a team of 5

### Branch strategy

- `main` - production-ready releases
- `develop` - integration branch for active work
- `feature/frontend` - frontend tasks and UI work
- `feature/backend` - API, data, and infrastructure work
- `feature/auth` - authentication flow and security
- `feature/ui` - reusable UI components and design system

### Team workflow

- Keep work scoped to one feature branch at a time.
- Open pull requests into `develop`.
- Run lint and build checks before review.
- Keep commits small and descriptive.
- Use code owners or review assignments so at least one teammate reviews each change.

### Suggested responsibilities

- Developer 1: app shell and routing
- Developer 2: reusable UI and styling system
- Developer 3: auth and session flow
- Developer 4: API and database layer
- Developer 5: CI, release process, and integration polish

## Notes

This starter is intentionally modular so you can expand pages, features, and domain modules without changing the core architecture.
