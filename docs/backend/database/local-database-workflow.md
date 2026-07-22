# Local Database Workflow

This document explains how to run the local Supabase environment for backend development and testing.

## Prerequisites
1. Docker Desktop must be installed and running.
2. Ensure you have run `npm install` to get the `supabase` CLI package.

## Starting the Database
To start the local Supabase stack:
```bash
npm run db:start
```
This will spin up PostgreSQL, Supabase Studio, Auth, and the REST API. You can access Supabase Studio locally at `http://127.0.0.1:54323`.

## Stopping the Database
```bash
npm run db:stop
```

## Resetting the Database
If you need to wipe the database and re-apply all migrations from scratch:
```bash
npm run db:reset
```

## Generating Types
After making changes to migrations, you must regenerate the TypeScript types. This ensures `src/persistence/database.types.ts` is deterministic and up to date.
```bash
npm run db:types:generate
```

## Running Database Tests (pgTAP)
To run the SQL tests inside `supabase/tests/` and verify RLS policies:
```bash
npm run db:test
```

## Validating the Database in CI
To run the linting, testing, and type freshness checks automatically:
```bash
npm run db:validate
```
