# Phase 0 - Foundation

## Objective

Prepare the technical project and establish base rules before implementing features.

## Checklist

- [x] Create Next.js project.
- [x] Configure TypeScript.
- [x] Configure linting.
- [x] Configure formatter.
- [x] Configure Supabase client.
- [x] Initialize Supabase CLI.
- [x] Create `supabase/migrations/`.
- [x] Create reproducible seed.
- [x] Create infrastructure layer for Supabase clients.
- [x] Avoid direct SDK imports outside the defined boundary.
- [x] Configure environment variables.
- [x] Create `.env.example` without secrets.
- [x] Forbid hardcoded project refs and URLs.
- [x] Create folder structure.
- [x] Define base layout.
- [x] Define main navigation.
- [x] Define initial visual theme.
- [x] Define base UI components.
- [x] Create Home page.
- [x] Create Plazas page.
- [x] Create Codex Libre page.
- [x] Create Holochat placeholder page.
- [x] Create Clans/Casas placeholder page.
- [x] Create Members page.
- [x] Create protected Council route.

## Security

- [x] Separate public and private variables.
- [x] Confirm service role key is not used on the client.
- [x] Create error handling policy.
- [x] Confirm that schema and RLS are rebuilt only through migrations.
- [x] Document database/Auth and Storage backup separately.

## Done when

- [x] The app runs locally.
- [x] The main navigation exists.
- [x] Supabase is configured.
- [x] Supabase can be replaced by changing configuration and restoring data.
- [x] Protected routes redirect correctly.
