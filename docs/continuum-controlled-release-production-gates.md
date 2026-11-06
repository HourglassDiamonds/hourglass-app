# Continuum controlled release — Production gates

Prepared November 6, 2026. This document is a read-only release plan. It does
not authorize a Production migration, environment change, client mutation,
staging deployment, alias change, Gmail send, recurring runner, or publisher.

## Immutable release baseline

- Current Production rollback deployment: `dpl_6pMkehMdkpaRZNV3ubgrbRWhUDsp`.
- Public aliases to recheck immediately before staging:
  `www.hourglassdiamonds.com` and `hourglassdiamonds.com`.
- Verified source-tree baseline: `4e5d039d29fc5be9bab28afa5256b893c6ba6cbd`.
- Production Supabase project: `bnafadfgrrriblppeubp`.
- Preview records and Preview UUIDs must never be inserted into Production.
- Sterling publisher, recurring Gmail sync, outbound acknowledgement transport,
  automatic booking, marketing, and lifecycle automation remain off.

## Rehearsal 1 — trusted-thread uniqueness and migration history

### Current Production baseline

- `public.continuum_project_evidence_associations` exists with 12 columns,
  its Project foreign key, RLS enabled, zero policies, and zero rows.
- It has the primary-key index and the per-Project identity unique index.
- It is missing
  `continuum_project_evidence_associations_trusted_source_uq`.
- No corresponding migration is present in
  `supabase_migrations.schema_migrations`.

The full source schema is
`lib/supabase/continuum-project-evidence-associations-schema.sql`.
Windows checkout SHA-256:
`A02DD4B332F8C34144894B67FC4F452A24FCFFF610C3F060EE3F2763FE66FDBA`.
Git-blob SHA-256:
`37FE9F4EE31E47DB20F6F45227AC7471BAE42A838F8F39A24A47FBCD7623AA43`.

### Preconditions

1. Reconfirm the table, 12-column signature, foreign key, constraints, RLS,
   policies, indexes, ACLs, and row count.
2. Require zero conflicting trusted ownership rows:
   group by `(source_type, source_identity)` where `status = 'trusted'` and
   reject any count greater than one.
3. Capture Morgan, Zane, Pennock, Gmail checkpoint, Today snapshot, and schema
   baselines. Confirm backup/PITR availability.

### Rollback-only execution plan

Use one session and one explicit transaction with local
`lock_timeout = '2s'`, `statement_timeout = '10s'`,
`idle_in_transaction_session_timeout = '10s'`, and
`transaction_timeout = '20s'`.

The reconciliation migration must only:

1. Create the missing partial unique index on
   `(source_type, source_identity) where status = 'trusted'`.
2. Revoke all table privileges from PUBLIC, `anon`, `authenticated`, and
   `service_role`.
3. Grant only SELECT, INSERT, UPDATE to `service_role`.
4. Preserve existing rows and constraints; do not recreate the table.

Validate with `pg_indexes`, `pg_constraint`, `pg_class.relrowsecurity`,
`pg_policies`, `information_schema.role_table_grants`, and `has_table_privilege`.
`service_role` must lack DELETE, TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN;
`anon` and `authenticated` must have no table privileges. Roll back
unconditionally and recheck that the new index and migration-history row are
absent.

For persistent application, use one new tracked reconciliation migration.
Do not manually forge the old Preview migration identifier. The new migration
must be recorded exactly once by the approved migration runner.

### Rollback behavior

Before association writes, rollback is `drop index` plus application rollback.
After trusted rows exist, retain the table and decisions; disable the consuming
application path and roll forward rather than deleting evidence.

## Rehearsal 2 — durable founder sessions

Source:
`lib/supabase/continuum-founder-sessions-schema.sql`.
Windows checkout SHA-256:
`632EE3BC32F3C46833F7B98DF49EBC1222225993322DC1C09572B4AB6212857A`.
Git-blob SHA-256:
`3218B01757044489F2E9CD44855DC9E28B3853961ED4911DA2AC76F2DE2FE595`.

### Preconditions and schema change

1. Confirm `public.continuum_founder_sessions` and both named indexes are
   absent and no migration-history row claims them.
2. Capture existing executive-dashboard authentication behavior and active
   session baselines without recording cookie values.
3. In one rollback-only transaction, create the five-column table, primary
   key, expiration index, and partial active-founder index.
4. Enable RLS with zero policies. Revoke PUBLIC/anon/authenticated. Grant the
   service role the table operations required for persist, lookup, revoke, and
   expiry cleanup.
5. Verify no password, passkey secret, OAuth token, raw IP, or raw browser
   header column exists.

Verification queries use `information_schema.columns`, `pg_indexes`,
`pg_policies`, `pg_class.relrowsecurity`, direct/effective privilege checks,
and a transaction-local insert/read/revoke/delete fixture that is rolled back.

### Rollback behavior

The rehearsal always rolls back. A persistent migration may be dropped only
before it carries sessions. After use, roll back application code and preserve
the revocation ledger; use an additive corrective migration if needed.

## Rehearsal 3 — Concierge persistence

Source:
`supabase/migrations/20261104145814_continuum_concierge_funnel_persistence.sql`.
Git-blob SHA-256:
`16921151FF3E412E4059B7A8FA57CDFF57BEDAC00D9EA3C4B4266E126FB2DA9A`.

### Preconditions and exact schema change

1. Confirm the outbox and both RPC signatures are absent.
2. Reconfirm the current `continuum_website_intakes` signature and the 21
   Candidate columns referenced by the RPC.
3. Confirm zero live sending integration is wired and the Preview synthetic
   flags are not present in Production.
4. Rehearse the exact migration in one transaction. It creates the 27-column
   private acknowledgement outbox, two partial indexes, forced RLS with zero
   policies, and two SECURITY INVOKER functions with empty search paths:
   `continuum_accept_concierge_funnel_v1` and
   `continuum_transition_concierge_ack_v1`.
5. Verify only SELECT, INSERT, UPDATE on the table and EXECUTE on the two RPCs
   are effective for `service_role`; PUBLIC, `anon`, and `authenticated` must
   have no table or function privilege.
6. Exercise only transaction-local non-synthetic fixtures. Prove replay
   idempotency, conflict failure, ambiguous identity retention, no canonical
   Project creation, and no transport invocation. Roll back unconditionally.

### Rollback behavior

Before live rows, the persistent migration can be reversed by dropping the two
functions, indexes, and table. After founder review records exist, disable the
application entry point and retain the outbox; use a corrective migration
rather than deleting the audit trail.

## Production OAuth and manual-operation checklist

1. Confirm the Production OAuth client, exact Production callback URI,
   Internal audience, `gmail.readonly` scope, Production-only encryption key,
   intended mailbox, and non-Preview refresh token. Inspect metadata only.
2. Run the existing zero-write provider connection check after founder sign-in.
3. Require a new successful Production checkpoint after authorization before
   declaring correspondence ready.
4. Confirm `CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED=false`. The deployed cron
   route runs every two minutes; never turn this flag on for a manual refresh.
5. Enable the founder one-chunk control only after exact Production runtime,
   database, authentication, and lease checks pass. One click equals one page;
   provider, checkpoint, auth, or lease errors stop the operation.
6. Recompute Today only after a completed checkpoint. Keep publication off and
   unresolved/untrusted associations excluded.

## Production client-review checklist

These are existing Production identities. They are not the accepted Preview
UUIDs and must be re-read immediately before any later approved mutation.

### Morgan Jines

- Person `9ff1ea75-4d5b-44d0-b2a0-c39ec15b54fd`
- Relationship `f2aa0be1-3e4b-4abe-a359-1d85f1de4894`
- Project `6c47edeb-33f8-4aa7-bb38-53bbe023fcc3`
- Current Production state: `Morgan Jines — Engagement Ring`, discovery
- Existing open Job `a92280a3-4041-4072-af8e-79e068ca2a0e`

Founder review must determine whether the existing Project is the same real
marquise engagement, rename/update it idempotently if so, move it to Design,
replace or resolve the generic clarification Job without losing history, and
create only the two confirmed incomplete founder actions. The trusted thread
must be confirmed against the Production Gmail index before association.

### Zane Kennedy

- Person `0a405703-0f30-4b1e-9a7a-4d0e001fb101`
- Relationship `b43adb80-ca5a-419c-b804-7e7c1a50285d`
- Project `12359010-1e95-4296-aa44-a7de7e70aa11`
- Current Production state: `Zane Kennedy — Wedding Band`, discovery
- Existing open Job `e8e8c50e-c010-4c09-b6dc-5926ecc98a8b`

Founder review must reconfirm the exact Production thread, transition the
existing Project to Production, and resolve the generic clarification Job only
through the supported completion/cancellation semantics. Do not create a reply,
phone-call, or production Job.

### John Pennock

- Person `a3a83570-3d3f-498f-bee4-3000fcde23b9`
- Relationship `62a63943-5548-4505-99ff-e0707124c108`
- Project `273b9a50-a51a-4379-b656-835b3c96cbeb`
- Current Production state: `J.Pennock`, production, zero Jobs

Founder review must preserve separation from JP and mixed Tim/Jenn evidence,
confirm the direct-client Production thread, and transition the existing
Project to Completed. Do not create shipping, delivery, or production work.
C025519 and RN08286 remain vendor identifiers, not Continuum Project numbers.

For all three clients: capture before/after row versions, require idempotency,
preserve source identifiers and history, perform two stable Today rebuilds,
and verify no Preview Person, Project, relationship, Job, or association ID
appears in Production.
