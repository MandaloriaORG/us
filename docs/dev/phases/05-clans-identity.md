# Phase 5 - Clans, Casas and Identity

## Objective

Give Mandaloria its own social structure.

## Clans/Casas

- [x] List clans/casas.
- [x] View clan/casa page.
- [x] Create clan/casa from admin.
- [x] Edit name, slug, description and emblem. (name/description/emblem done; slug has no RPC parameter in 0016 — handoff)
- [x] Change privacy.
- [x] Archive clan/casa.
- [x] Request entry.
- [x] Invite user.
- [ ] Accept request. (action exists; no RPC lists a clan's pending requests — handoff)
- [ ] Reject request. (same read-contract gap as accept)
- [x] Leave clan/casa.
- [x] Expel member.
- [x] Change leader.
- [x] Define mission.
- [ ] Assign areas of responsibility. (no DB table links clans to areas — handoff)
- [ ] Relate areas that help care for the Codex. (no clan↔Codex relation in the contract — handoff)

## Expeditions

- [ ] Create research expedition. (no expeditions contract in migrations 0015-0018 — handoff)
- [ ] Define objective, leads and participants.
- [ ] Save permitted sources.
- [ ] Statuses: proposed, active, under review, completed, cancelled and archived.
- [ ] Publish result in Plaza or propose it to the Codex.
- [ ] Protect private sources and results.

## Internal roles

- [x] Create internal roles.
- [x] Assign internal role.
- [x] Remove internal role.
- [x] Basic internal permissions.

## Ranks

- [x] Create ranks.
- [x] Edit ranks.
- [x] Assign rank.
- [x] Show rank on profile.
- [x] Show rank next to name.

## Badges

- [x] Create badge.
- [x] Edit badge.
- [x] Assign badge.
- [x] Remove badge.
- [x] Show badges on profile.
- [x] Show issuer, date, reason and status.
- [x] Link public evidence or protected reference.
- [x] Define authorized issuers.
- [x] Revoke without deleting internal history.

## Friends and blocks

- [x] Send friend request.
- [x] Accept request.
- [x] Reject request.
- [x] Cancel request.
- [ ] Remove friend. (action exists; no RPC exposes an accepted friendship's id — handoff)
- [x] Block user.
- [x] Unblock user.
- [x] Respect blocks in interactions.

## Security

- [x] Leader only manages their own clan/casa.
- [x] Admin can intervene.
- [x] Blocked user cannot harass with requests.
- [x] Ranks/badges do not grant permissions without explicit rule.
- [x] Casa responsibility does not grant ownership of the Codex.
- [x] Private badge evidence is not exposed.

## Done when

- [x] Users have visible identity.
- [x] Clans/casas work.
- [x] Friends/blocks work.
- [x] Admin can control social structure.

## Handoffs (read surfaces the 0016-0018 contract does not provide)

1. `list_badges()` — a badge catalog RPC (badge definitions) for the admin list/award/edit flow.
2. A clan pending-request listing RPC (leader's queue) so `review_clan_request` can be reached.
3. `list_friends` exposing the accepted `friendship_id` (or a pair-based remove RPC) so "remove friend" can be wired.
4. Slug editing for clans (`admin_update_clan` has no `p_slug`).
5. Clan areas of responsibility and clan↔Codex topic relations.
6. The expeditions tables/status RPCs (or an explicit decision to defer expeditions).
