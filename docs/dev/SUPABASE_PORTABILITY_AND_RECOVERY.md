# Supabase Portability and Recovery

## Decision

Mandaloria will use a single primary Supabase project during the MVP. From the first technical change, the system must be able to be rebuilt on another project using the repository, backups and a tested procedure.

Active-active, bidirectional replication or federation will not be implemented during the MVP.

## Goals

- Switch to another Supabase project without redesigning the application.
- Recreate schema, RLS, functions, triggers, indexes and controlled configuration.
- Migrate users preserving their identifiers and hashes when the mechanism used allows it.
- Copy Storage files and metadata.
- Change endpoints and keys through configuration, not by editing code.
- Have backups outside the primary project.
- Know how much data can be lost and how long a recovery would take.

## Non-initial goals

- Two primaries accepting writes simultaneously.
- Automatic failover without intervention.
- Zero seconds of data loss.
- Federation between Mandaloria installations.
- P2P for private content or accounts.

## Portability contract

A new installation is considered equivalent when it can recover:

- application schema and data;
- Auth users and their relationships with profiles;
- roles, permissions, grants and RLS;
- functions, triggers, extensions and indexes;
- Storage buckets, policies, metadata and objects;
- relevant Auth configuration;
- Realtime configuration;
- webhooks, cron and deployed functions;
- variables and secrets through a secure manager;
- pending jobs/outbox without duplicating effects;
- published Codex versions and their allowed sources.

## Planned repository structure

Will be created when implementation begins:

```text
supabase/
  config.toml
  migrations/
  seed.sql

src/infrastructure/supabase/
  browser-client.ts
  server-client.ts
  admin-client.ts
  database.types.ts

docs/runbooks/
  backup.md
  restore-to-new-project.md
  rotate-supabase-keys.md
```

The structure can adapt to the final framework, but responsibilities must not be mixed.

## Schema source of truth

- [ ] Initialize Supabase CLI within the repository.
- [ ] Save `supabase/config.toml` without secrets.
- [ ] Create one migration per coherent change.
- [ ] Include tables, enums, constraints and indexes.
- [ ] Include functions, triggers and grants.
- [ ] Include RLS and all its policies.
- [ ] Include reproducible Storage buckets and policies.
- [ ] Record required extensions.
- [ ] Record Realtime publications when used.
- [ ] Record cron, webhooks and related functions.
- [ ] Maintain a minimal and deterministic seed.
- [ ] Do not edit migrations already applied in shared environments.
- [ ] Be able to run local reset from an empty database.
- [ ] Verify that the final diff contains no unknown changes.
- [ ] Regenerate TypeScript types after migrating.

Schema changes must be made locally and captured as migrations. The official Supabase documentation also recommends capturing changes via `supabase db diff`: https://supabase.com/docs/guides/deployment/database-migrations

## Provider boundary

- [ ] Create Supabase clients only in the infrastructure layer.
- [ ] Do not import the SDK directly from domain components.
- [ ] Encapsulate Auth, Storage and privileged access in clear modules.
- [ ] Do not create Supabase URLs within domain entities.
- [ ] Do not use project refs as Mandaloria identifiers.
- [ ] Configure endpoints and keys through environment variables.
- [ ] Keep service role exclusively on server.
- [ ] Use Mandaloria's own URLs for public links.
- [ ] Document any capability that depends exclusively on Supabase.

This does not mean creating a universal database abstraction. PostgreSQL, Auth and RLS can be fully used; the goal is to concentrate the dependency so that it is locatable and replaceable.

## Identifiers

- [ ] Use stable UUIDs for main entities.
- [ ] Preserve IDs during restorations and migrations.
- [ ] Do not use email, username or URL as foreign key.
- [ ] Do not expose sensitive sequential IDs.
- [ ] Maintain public references independent of the project ref.
- [ ] Define explicit strategy before separating member ID from Auth ID.

During the MVP a direct and stable relationship with `auth.users.id` can be maintained. A complete migration between Supabase projects can preserve users, hashes and IDs; changing JWT keys can invalidate sessions and force re-login. This is accepted as a possible recovery cost and must be tested: https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects

## Portable Auth

- [ ] Keep community data out of Auth metadata except what is strictly necessary.
- [ ] Do not use user-editable metadata for permissions.
- [ ] Keep roles and permissions in versioned tables with RLS.
- [ ] Include the Auth schema in the appropriate backup/restore procedure.
- [ ] Preserve user UUID when restoring.
- [ ] Document active OAuth providers and their callback URLs.
- [ ] Document templates, redirects and Auth policies.
- [ ] Test password login and each enabled provider.
- [ ] Decide in each recovery whether to preserve or rotate signing keys.
- [ ] If keys change, communicate that existing sessions will expire.
- [ ] Never store JWT secrets or private keys in Git.

## Portable Storage

- [ ] Store `bucket`, `object_path`, owner, MIME, size and checksum.
- [ ] Do not store public URLs or signed URLs as file identity.
- [ ] Declare buckets and policies reproducibly.
- [ ] Back up actual objects, not just `storage.objects` rows.
- [ ] Back up metadata needed to reconstruct relationships.
- [ ] Verify count and checksum of restored objects.
- [ ] Regenerate URLs after project change.
- [ ] Test public, private and quarantined objects.
- [ ] Maintain EXIF metadata removal according to privacy policy.

Cloning/restoring a database to another project does not automatically copy Storage files or all project configuration; they must be migrated separately: https://supabase.com/docs/guides/platform/clone-project

## Variables and configuration

- [ ] No URL, project ref or key is hardcoded.
- [ ] Separate public and private variables.
- [ ] Maintain `.env.example` template without real values.
- [ ] Inventory required variables and their owner.
- [ ] Store secrets in Vercel/Supabase or authorized manager.
- [ ] Have procedure for rotating keys after a migration.
- [ ] Keep community settings in migratable tables.
- [ ] Keep absolute security limits in controlled configuration.

## Backups

Independent surfaces:

1. Application PostgreSQL.
2. Auth schema and data.
3. Storage objects and metadata.
4. Auth, Realtime, webhooks, cron and functions configuration.
5. Variables and secrets, backed up through a secure procedure.

Checklist:

- [ ] Define frequency of each backup.
- [ ] Define retention.
- [ ] Encrypt backups before storing externally.
- [ ] Keep at least one copy outside Supabase.
- [ ] Restrict and audit access to dumps.
- [ ] Do not include backups in Git.
- [ ] Validate checksums.
- [ ] Test restoration in an isolated project.
- [ ] Delete expired copies securely.
- [ ] Document responsible person and date of last drill.

## Initial recovery goals

Before real users:

- RPO: does not apply to production data; reproducibility is tested.
- RTO: documented manual restoration.

First public MVP:

- Target RPO: maximum 24 hours of data.
- Target RTO: maximum 4 hours for essential service.
- Codex publicly exportable independently.

These goals are reviewed when activity, cost and risk justify more frequent backups or a standby.

## Runbook: switching to another Supabase

1. Declare incident or migration window.
2. Activate maintenance mode and stop new writes.
3. Wait for or resolve in-progress outbox events.
4. Take final backup of database and Auth.
5. Copy Storage objects and calculate checksums.
6. Create the destination Supabase project in the chosen region.
7. Apply base configuration, extensions and migrations.
8. Restore users, data and relationships preserving IDs.
9. Recreate buckets, policies and Storage objects.
10. Configure Auth, redirects, providers, Realtime, webhooks, cron and functions.
11. Configure destination environment variables without including them in Git.
12. Regenerate types if the final schema changed.
13. Run tests as visitor, member, Archivist, moderator and admin.
14. Verify RLS by attempting unauthorized accesses.
15. Verify login, uploads, private files, Codex, posts, chat and outbox.
16. Switch Vercel/DNS/configuration toward the new project.
17. Monitor errors, latency and permissions.
18. Keep the origin in read-only mode during the defined window.
19. Rotate secrets that must change.
20. Record result, actual data loss and recovery time.

## Restoration tests

- [ ] Empty database is rebuilt with migrations alone.
- [ ] Seed runs twice in a controlled way or documents its single use.
- [ ] Users retain relationships and permissions.
- [ ] A normal user does not get admin access.
- [ ] Drafts and private channels remain private.
- [ ] Public and private Storage works.
- [ ] Quarantined files are not served publicly.
- [ ] Counts and foreign keys are consistent.
- [ ] Outbox events are not duplicated.
- [ ] Search does not index prohibited content.
- [ ] Old sessions behave as expected according to JWT keys.
- [ ] The application contains no references to the previous project ref.

## Phases

### Phase A - Now, documentation

- [x] Decide on one primary Supabase and portability from the start.
- [x] Create permanent instructions in `AGENTS.md`.
- [x] Create this plan.
- [ ] Define final RPO/RTO before launch.

### Phase B - When creating the application

- [ ] Initialize Supabase CLI.
- [ ] Create migrations and seed structure.
- [ ] Create Supabase infrastructure boundary.
- [ ] Create variable template.
- [ ] Add migration verification in CI.
- [ ] Add RLS tests.

### Phase C - Before accepting real users

- [ ] Automate database/Auth backup.
- [ ] Automate Storage copy.
- [ ] Encrypt and store external copy.
- [ ] Write executable runbooks.
- [ ] Restore on temporary project.
- [ ] Measure actual RPO/RTO.

### Phase D - When risk justifies it

- [ ] Evaluate cold or warm secondary project.
- [ ] Evaluate lower RPO.
- [ ] Evaluate semi-automatic failover.
- [ ] Evaluate read replicas by latency, not as primary replacement.
- [ ] Evaluate signed mirrors of the Codex.

## Definition of done

Portability is demonstrated when a person who did not create the project can follow the runbook, spin up a new Supabase, restore users and files, change the configuration and complete the tests without manually rebuilding Mandaloria.
