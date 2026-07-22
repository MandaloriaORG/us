# Phase 0 - Foundation

## Objective

Prepare the technical project and establish base rules before implementing features.

## Checklist

- [ ] Create Next.js project.
- [ ] Configure TypeScript.
- [ ] Configure linting.
- [ ] Configure formatter.
- [ ] Configure Supabase client.
- [ ] Initialize Supabase CLI.
- [ ] Create `supabase/migrations/`.
- [ ] Create reproducible seed.
- [ ] Create infrastructure layer for Supabase clients.
- [ ] Avoid direct SDK imports outside the defined boundary.
- [ ] Configure environment variables.
- [ ] Create `.env.example` without secrets.
- [ ] Forbid hardcoded project refs and URLs.
- [ ] Create folder structure.
- [ ] Define base layout.
- [ ] Define main navigation.
- [ ] Define initial visual theme.
- [ ] Define base UI components.
- [ ] Create Home page.
- [ ] Create Plazas page.
- [ ] Create Codex Libre page.
- [ ] Create Holochat placeholder page.
- [ ] Create Clans/Casas placeholder page.
- [ ] Create Members page.
- [ ] Create protected Council route.

## Security

- [ ] Separate public and private variables.
- [ ] Confirm service role key is not used on the client.
- [ ] Create error handling policy.
- [ ] Confirm that schema and RLS are rebuilt only through migrations.
- [ ] Document database/Auth and Storage backup separately.

## Done when

- [ ] The app runs locally.
- [ ] The main navigation exists.
- [ ] Supabase is configured.
- [ ] Supabase can be replaced by changing configuration and restoring data.
- [ ] Protected routes redirect correctly.
