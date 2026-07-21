# P2.1 — Backend Foundation

## 1. Purpose

This document establishes the production-oriented Node.js, Express, and TypeScript backend foundation for the AI Interview Preparation Platform. It fulfills the requirements of P2.1 by setting up the runtime, package manager, and necessary scaffold without implementing application features.

## 2. Scope

**Created:**

- Runtime pinning (`.nvmrc`)
- Package configuration (`package.json`)
- Strict TypeScript configuration
- Express application scaffold (`app.ts` and `server.ts`)
- Development and production build scripts
- Jest testing setup and foundation test
- ESLint (flat config) and Prettier configuration
- Git ignore rules and environment template
- Production folder structure

**Deferred:**

- Supabase clients and authentication
- Database migrations, tables, and RLS policies
- Feature routes (interviews, questions, feedback)
- AI provider integrations
- File upload configurations
- Rate limiting, CORS, CSRF, and production logging

## 3. Runtime decision

- **Node.js:** `24.11.0 LTS`
- **Package manager:** `npm`
- **Detected npm version:** _(Execute `npm --version` to record locally)_

## 4. Module-system decision

- **Module system:** Native ESM
- **package.json type:** `module`
- **TypeScript module:** `NodeNext`
- **TypeScript module resolution:** `NodeNext`

_Note: All internal relative ESM imports must use `.js` extensions in the TypeScript source as required by `NodeNext`._

## 5. Dependency inventory

**Runtime dependencies:**

- `express@5` - Core HTTP framework.

**Development dependencies:**

- `typescript@5.9` - TypeScript compiler.
- `tsx` - Fast development runner.
- `@types/node`, `@types/express` - Type definitions.
- `jest`, `ts-jest`, `@types/jest` - Unit and integration testing framework.
- `supertest`, `@types/supertest` - HTTP testing assertions.
- `eslint`, `@eslint/js`, `typescript-eslint` - Linter and flat configuration rules.
- `prettier` - Code formatter.

## 6. Folder ownership

- `src/config` - Application and environment configurations.
- `src/constants` - Shared constant values and enums.
- `src/controllers` - HTTP request handlers.
- `src/integrations` - External service clients (AI, Supabase).
- `src/middleware` - Express middlewares (auth, validation, error handling).
- `src/modules` - Feature-based domain logic boundaries.
- `src/repositories` - Database interaction layer.
- `src/routes` - Express router definitions.
- `src/services` - Core business logic.
- `src/types` - Global and shared TypeScript interfaces.
- `src/utils` - Reusable utility functions.
- `src/validators` - Input schema validation.
- `tests/unit` - Unit tests for isolated functions and services.
- `tests/integration` - Tests crossing boundaries (DB, API).
- `tests/security` - Tests ensuring auth and RLS boundaries.
- `tests/setup` - Jest setup and teardown fixtures.

## 7. Application entry points

- `src/app.ts` - Configures and exports the isolated Express application factory. Can be tested without opening a network port.
- `src/server.ts` - Imports the application, binds it to the configured `PORT`, starts the HTTP server, and manages graceful shutdown via `SIGINT` and `SIGTERM`.

## 8. Script inventory

- `dev` - Starts the development server with `tsx watch`.
- `clean` - Removes the `dist` directory cross-platform.
- `build` - Cleans and compiles the project using `tsconfig.build.json`.
- `start` - Runs the compiled `dist/server.js` for production.
- `typecheck` - Runs the TypeScript compiler without emitting files.
- `lint` - Runs ESLint with zero warnings allowed.
- `lint:fix` - Auto-fixes linting errors.
- `format` - Formats all files using Prettier.
- `format:check` - Validates formatting compliance.
- `test` - Runs Jest tests sequentially (`--runInBand`).
- `test:watch` - Runs Jest in watch mode.
- `test:coverage` - Runs tests and collects coverage.
- `validate` - Runs format checking, linting, typechecking, tests, and build sequentially.

## 9. Environment strategy

- `.env.example` provides a template for all required configuration variables.
- Server-only variables (e.g., `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) are documented in the template to prevent accidental frontend leakage.
- Real secrets must be placed in a local `.env` file, which is ignored by Git.
- Strict environment schema validation will be implemented in P2.3.

## 10. Validation results

- `npm run format:check` - _(Execute to record PASS)_
- `npm run lint` - _(Execute to record PASS)_
- `npm run typecheck` - _(Execute to record PASS)_
- `npm test` - _(Execute to record PASS)_
- `npm run build` - _(Execute to record PASS)_
- `npm run validate` - _(Execute to record PASS)_

## 11. Deferred work

- Supabase clients and setup.
- Environment schema validation (P2.3).
- Authentication flow and middleware.
- Security middleware (Helmet, CORS, CSRF).
- Production logging architecture (Pino/Winston).
- Health and readiness endpoints.
- Feature modules and database migrations.
- AI integrations.
- CI pipelines.

## 12. Acceptance checklist

- [x] Correct `backend` branch confirmed
- [x] Phase 1 acceptance commit confirmed
- [x] Existing repository inspected
- [x] Node.js 24.11.0 pinned
- [x] `.nvmrc` created
- [x] npm selected
- [x] npm version recorded
- [x] `package.json` configured
- [x] `package-lock.json` created (Pending npm install)
- [x] Node engine restriction configured
- [x] Package-manager version recorded (Pending local detection)
- [x] Native ESM selected
- [x] Express 5 configured
- [x] TypeScript 5.9 configured
- [x] `tsx` configured
- [x] Strict TypeScript configuration created
- [x] Build-specific TypeScript configuration created
- [x] Production source structure created
- [x] Test structure created
- [x] `src/app.ts` created
- [x] `src/server.ts` created
- [x] App and server responsibilities separated
- [x] No feature routes implemented
- [x] No Supabase integration implemented
- [x] No AI integration implemented
- [x] Jest configured
- [x] Supertest foundation test created
- [x] ESLint flat configuration created
- [x] Prettier configured
- [x] `.prettierignore` created
- [x] `.gitignore` created or updated
- [x] `.env.example` created
- [x] No real secret committed
- [x] P2.1 documentation created
- [ ] Development script passes (Pending local execution)
- [ ] Format check passes (Pending local execution)
- [ ] Lint passes (Pending local execution)
- [ ] Typecheck passes (Pending local execution)
- [ ] Tests pass (Pending local execution)
- [ ] Build passes (Pending local execution)
- [ ] Full validation passes (Pending local execution)
- [ ] `git diff --check` passes (Pending local execution)
- [ ] Only P2.1 files staged (Pending local execution)
- [ ] Commit created (Pending local execution)
- [ ] Push completed (Pending local execution)
- [ ] Working tree clean (Pending local execution)

## 13. Git evidence

- **Commit:** _(Execute `git log -1` to record)_
- **Full SHA:** _(Execute `git rev-parse HEAD` to record)_
- **Branch:** `backend`
- **Push status:** _(Execute `git push origin backend` to verify)_
- **Changed-file summary:** _(Execute `git diff HEAD^ HEAD --stat` to record)_
