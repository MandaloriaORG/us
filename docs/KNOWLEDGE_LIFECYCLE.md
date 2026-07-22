# Knowledge Lifecycle

## Purpose

Mandaloria's distinctive function is transforming valuable conversations into free, reviewed, and lasting knowledge.

Main flow:

```text
Question or conversation
        -> knowledge proposal
        -> source and contribution selection
        -> collaborative draft
        -> review
        -> Codex article
        -> new questions and improvements
```

The article does not replace or delete the conversation. It preserves its provenance through links to permitted sources and recognizes those who contributed.

## Permitted Origins

A proposal can originate from:

- a Plaza post;
- one or more comments;
- a reply thread;
- selected Holochat messages;
- an internal House/Circle conversation if its permissions allow publishing it;
- a manual proposal with external references.

Private content can never be turned into public content without reviewing permissions and obtaining the required consent.

## Actors

Member:

- proposes distilling a conversation;
- explains why it deserves to be preserved;
- suggests sources and contributors;
- follows the proposal status;
- participates in the linked debate.

Archivist:

- reviews the proposal;
- validates that the sources can be used;
- selects or corrects contributors;
- creates or assigns the draft;
- requests changes;
- sends the article for publication.

Council or authorized publisher:

- resolves privacy or attribution conflicts;
- approves sensitive changes;
- publishes, rejects, archives, or reopens proposals;
- reverts a publication if it contains improper information.

## Proposal Statuses

Canonical statuses:

```text
proposed -> triaged -> drafting -> in_review -> accepted -> published
       \-> rejected
       \-> withdrawn
published -> superseded
```

Rules:

- each transition has a defined actor and permission;
- every transition records date, responsible party, and optional or mandatory reason depending on the action;
- `rejected` and `withdrawn` are reversible by an authorized actor;
- `published` points to the created article and version;
- `superseded` preserves history and points to the replacing proposal;
- proposals are not published directly: a reviewed version of the article is published.

## Provenance and Recognition

Each associated source must store:

- type and identifier of the source content;
- fragment or conceptual range used, without duplicating private content;
- who added it;
- visibility status at the time of review;
- consent when necessary;
- relationship to the article or proposal.

Each recognized contribution must store:

- recognized member;
- contribution type: question, explanation, evidence, synthesis, review, or edit;
- source demonstrating the contribution;
- who confirmed the recognition;
- status: proposed, confirmed, rejected, or withdrawn.

Recognition does not automatically grant reputation, rank, role, or badge. Each system applies its own explicit rules.

## Privacy

- [ ] Verify visibility of each source when opening the proposal.
- [ ] Re-verify visibility before publishing.
- [ ] Do not copy private messages by default.
- [ ] Request consent to attribute content originating in a private space.
- [ ] Allow anonymous attribution when appropriate.
- [ ] Allow withdrawing an attribution without destroying the internal audit history.
- [ ] Hide source links that the reader does not have permission to open.
- [ ] Indicate that a restricted source exists without revealing its content, only if safe.
- [ ] Block indexing of drafts, reviews, and private sources.
- [ ] Log any privacy or attribution change in the audit log.

## User Experience

- [ ] `Propose for the Codex` action on eligible content.
- [ ] Form with reason, initial sources, and optional related article.
- [ ] Avoid duplicate proposals by showing existing candidacies.
- [ ] Proposal page with status, responsible parties, sources, and activity.
- [ ] Allow following a proposal.
- [ ] Notify important changes to proponent and contributors.
- [ ] Editor allows importing permitted citations as working notes.
- [ ] Published article shows provenance and confirmed contributors.
- [ ] Article links its main discussion.
- [ ] Source conversation shows the resulting article.
- [ ] Allow proposing an improvement to an existing article.
- [ ] Loading, empty, error, and access denied states.

## Moderation and Edge Cases

- [ ] Source deleted before review.
- [ ] Source placed in quarantine during review.
- [ ] Author banned after contributing.
- [ ] Two proposals attempt to create the same article.
- [ ] Two articles compete for the same topic.
- [ ] Contributor disputes their attribution.
- [ ] Member requests not to appear publicly.
- [ ] Private conversation loses or changes permissions.
- [ ] Published article accidentally reveals private information.
- [ ] Coordinated proposal to obtain reputation or badges.
- [ ] Archivist has a conflict of interest.
- [ ] House content cannot be published without internal authorization.

Sensitive decisions must be reversible and logged.

## Conceptual Data

- `knowledge_proposals`;
- `knowledge_proposal_sources`;
- `knowledge_proposal_contributors`;
- `knowledge_proposal_events`;
- `library_articles`;
- `library_article_versions`;
- `library_discussions`;
- `notifications`;
- `audit_logs`.

## Minimum Permissions

- `knowledge.propose`;
- `knowledge.view_proposal`;
- `knowledge.triage`;
- `knowledge.assign`;
- `knowledge.edit_draft`;
- `knowledge.review`;
- `knowledge.manage_sources`;
- `knowledge.manage_attribution`;
- `knowledge.publish`;
- `knowledge.reject`;
- `knowledge.reopen`.

All are evaluated based on member, action, resource, and context. RLS re-checks access to proposals, sources, and drafts.

## Definition of Done

- [ ] An eligible conversation can generate a proposal.
- [ ] An Archivist can turn it into a draft without copying prohibited data.
- [ ] Sources and contributions are traceable.
- [ ] The process has valid statuses and transitions.
- [ ] A reviewed version can be published in the Codex.
- [ ] Conversation and article are linked in both directions.
- [ ] Private permissions remain private in UI, API, search, and links.
- [ ] Rejection, withdrawal, reopening, and attribution removal work.
- [ ] Sensitive actions have audit logging.
- [ ] Tests exist for permissions, privacy, duplicates, and concurrency.
