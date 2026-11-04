# Continuum Concierge P0.5 persistence acceptance

Status: implemented and verified locally on 2026-11-04. The migration is an unapplied artifact. No shared Preview or Production database, Vercel configuration, OAuth credential, Gmail transport, Calendar provider, HubSpot route, or live customer communication was changed.

## Contract and compatibility

`continuum_website_intakes` remains the authority for submission replay, source, identity resolution, existing `person_id`, and ambiguity. `continuum_accept_concierge_funnel_v1` locks that row and rejects a missing intake, submission-hash mismatch, synthetic intake, wrong website source, recipient mismatch, identity/confidence mismatch, or canonical/automatic Candidate mutation.

The additive persistence path is:

1. Existing `continuum_ingest_website_inquiry` accepts and resolves the website inquiry.
2. The server computes a stable acceptance hash and invokes `continuum_accept_concierge_funnel_v1` with the authoritative intake ID/hash, noncanonical Candidate proposal, approved-or-pending acknowledgment, and consent/suppression snapshot.
3. One transaction inserts the existing `continuum_candidates` proposal and one private `continuum_concierge_ack_outbox` row. Exact replays return the existing identities; changed acceptance payloads fail with `idempotency-conflict`.
4. Sterling Today reads pending Candidate proposals through the server-only adapter. The isolated Concierge projection and persisted row both use the source label `Website Concierge`; no Beta Recovery presentation/publisher file is changed.
5. Outbox changes use a locked database state machine. `delivery_unknown` and `failed` are terminal, reconciliation-required states; neither can be blindly reclaimed.

The migration depends on the authoritative website-intake migration and the existing Candidate schema. It does not replace or alter the intake RPC, its canonical projectless Job, identity tables, shared Candidate contract, Sterling publisher, or HubSpot outcome fields. The current HubSpot call remains a separate post-intake compatibility path until its owner authorizes removal; this branch neither invokes nor disables it.

The read-only Beta Recovery comparison used its current `3c25ab0` worktree. Its website intake and Candidate contracts remain compatible, while its shared evidence presenter still maps every `human-intake` Candidate to `Human Intake`. Beta Recovery also has active, unrelated Gmail manual-preview edits. None of those files or changes were touched. This branch resolves the website label only in the isolated Concierge projection/persistence adapter; a later Beta-owned integration may consume that persisted label without changing the Candidate source-system enum.

## Local acceptance evidence

- Disposable PostgreSQL 18.4, loopback only: `node --test scripts/continuum-concierge-postgres.test.mjs` — 1/1 passed.
- Concierge fixture/integration/adapter tests: 19/19 passed.
- Focused TypeScript: `tsc -p tsconfig.concierge-funnel.json --noEmit` — passed.
- Focused ESLint: Concierge TypeScript and PostgreSQL harness — zero errors (the SQL file is intentionally outside ESLint configuration and produced one ignored-file warning).

The real PostgreSQL test proves:

- two concurrent service-role sessions converge on exactly one Candidate and one outbox row;
- exact replay returns `already-present`, while a changed acceptance hash is rejected;
- a matched intake retains its existing Person ID;
- an ambiguous intake retains `person_id = null`, `needs_review`, and an ambiguous pending Candidate;
- Candidate subject/review state and the founder-facing `Website Concierge` label survive a real database stop/start;
- ready → sending → delivery_unknown persists attempt/reconciliation state and rejects a second claim;
- no row reaches `sent`, and the harness contains no provider transport;
- anon/authenticated table reads and RPC calls fail, while service-role execution succeeds.

The repository-wide TypeScript command still fails on pre-existing, out-of-scope baselines. Representative families are Diamond Intelligence metadata/capability test drift, Calendar fixture `calendar_id` omissions, Candidate paging literal types, missing `pngjs`/`vitest` declarations, duplicated test object keys, and `ProcessEnv.NODE_ENV` fixture typing. The focused Concierge TypeScript configuration is clean and introduces none of those failures.

## Database security audit

- The outbox enables and forces RLS and intentionally has no policies.
- PUBLIC, `anon`, and `authenticated` receive no table privileges and no RPC execution. Only `service_role` receives table select/insert/update and RPC execute; delete is not granted.
- Both RPCs are `SECURITY INVOKER`, have `search_path = ''`, schema-qualify private objects, and are owned by the migration owner (`postgres` in local acceptance). There is no `SECURITY DEFINER` function or view.
- The functions live in the Data-API-exposed `public` schema for compatibility, but exposure alone is not treated as authorization: local catalog checks prove PUBLIC/anon/authenticated cannot execute or read.
- The adapter is behind a `server-only` entrypoint and obtains only `getSupabaseAdmin()`. It contains no `NEXT_PUBLIC_*` credential path and is not exported from the public Concierge barrel.
- Email address and acknowledgment copy are private operational data. They remain in the service-role-only ledger; the raw public submission token is not persisted, only its SHA-256 identity hash.
- Unknown delivery never becomes a receipt. `sent` requires a provider message ID; `delivery_unknown` requires reconciliation and forbids a provider message ID.

## Rollback

Before Preview application, take a schema/data snapshot and record the migration checksum. A rollback first stops the unpublished Concierge caller, then drops the two new RPC signatures and the outbox table in one transaction. Candidate rows should be retained by default because they are harmless noncanonical proposals and may have received founder review. If explicit data removal is approved, capture the outbox Candidate IDs before dropping the table and delete only rows whose IDs were captured, `source_system = 'human-intake'`, `source_ref like 'website-intake:%'`, `parser_version = 'concierge-funnel-preview-v1'`, and `review_status = 'pending'`. Never delete reviewed Candidates or touch the authoritative intake/Person/Job rows.

Because this is additive and the application caller is not activated, rollback before activation is simply dropping the new functions/table. Existing website intake behavior continues unchanged either way.

## Remaining Preview blockers and minimum authorization gate

1. Confirm that both prerequisite schemas (`continuum_website_intakes` and `continuum_candidates`) are present at compatible versions in shared Preview.
2. Obtain an explicit Preview-only database migration authorization from the founder/infrastructure owner. The approval should name the exact commit and migration file, allow only the additive transaction, require a backup/checksum, and forbid Production.
3. Apply with a database owner capable of creating the service-role grants, then rerun the catalog security checks and disposable acceptance assertions against Preview fixtures only.
4. Separately authorize the Beta-owned intake call site to invoke the server-only adapter after successful intake. Keep fake transport enforced and do not alter the Sterling publisher, Vercel variables, HubSpot routing, Gmail, Calendar, or follow-up automation.

The smallest safe next gate is therefore: **one explicit Preview-only approval to apply the reviewed additive migration at the exact accepted commit, after prerequisite verification and backup, with fake transport and all live provider paths still disabled.** P1 provider activation is not part of this gate.
