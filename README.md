# AI Interview Preparation Platform - Backend

This repository contains the backend API for the AI Interview Preparation Platform for Engineering Students.

## Setup

**1. Required Node Version:**
Ensure you are using Node.js v24.18.0 (specified in `.nvmrc`).

**2. Install Dependencies:**

```powershell
npm install
```

**3. Run Development Server:**

```powershell
npm run typecheck
```

## Configuration

This project uses a strict, typed configuration system. Raw environment variables are validated before the server starts.

1. **Setup**: Copy the template file to `.env`:
   ```powershell
   Copy-Item ".env.example" ".env"
   ```
2. **Values**: Fill in only the local development values in your `.env` file.
3. **Security**: Never commit the `.env` file to version control.
4. **Supabase**: Provide `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and exactly one privileged key (either `SUPABASE_SECRET_KEY` [preferred] or `SUPABASE_SERVICE_ROLE_KEY` [legacy]). User operations use the publishable key + user token. Missing Supabase configuration does not prevent unrelated startup, but dependent operations will fail safely.
5. **Startup**: Run the development server:
   ```powershell
   npm run dev
   ```
6. **Fail-fast**: If any required configuration is missing or invalid, the server will intentionally fail to start.

Detailed documentation on the environment configuration rules and secret classification can be found in:

- [03. Environment Configuration](./docs/backend/phase-2/03-environment-configuration.md)
- [04. Supabase Client Foundation](./docs/backend/phase-2/04-supabase-client-foundation.md)
- [05. Security Middleware Foundation](./docs/backend/phase-2/05-security-middleware-foundation.md).

- **Phase 2: Core Platform Infrastructure** _(In Progress)_
  - Express.js Setup (Completed)
  - Validation Pipeline (Completed)
  - Environment Management (Completed)
  - Database Client Setup (Completed)
  - Base Security Middleware (Completed)
  - Authentication Domain Foundation (Completed)

**4. Run Validation Pipeline:**

```powershell
npm run validate
```

## Directory Structure

- `src/` - Production source code (Express app, controllers, services).
- `tests/` - Jest test suites (unit, integration, security).
- `docs/backend/` - Architecture and planning documentation.

## Documentation

- [Phase 1 Documentation](docs/backend/phase-1/) - Architecture, Database Design, RLS, API Blueprint.
- [Phase 2 Documentation](docs/backend/phase-2/) - Backend Foundation, CI/CD, Core scaffolding.
