---
status: accepted
---

# A single Supabase with a portable core

Mandaloria will use a single main Supabase project during the MVP and will avoid active-active or bidirectional replication. Every schema change, permission, Auth, Storage, and configuration must remain reproducible or documented in the repository, with external backups and tested restorations, so the system can be moved to another project when the real risk justifies redundancy without paying the complexity of a distributed system from the start.

## Consequences

Initial availability depends on the main project and recovery will be manual. In exchange, development remains simple; migrations, provider boundaries, Storage copies, and restoration drills become mandatory requirements from the beginning.
