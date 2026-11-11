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

## Maintained-environment migration mapping

Read-only history inspection on November 10, 2026 found two maintained
Supabase projects. Continuum Preview records `20260916094016` founder sessions,
`20261104201449` Concierge persistence, and `20261106151236` project evidence
associations. Production records none of those versions. Neither environment
records the former repository-only Concierge version `20261104145814`.

The checked-in migration set therefore uses the Preview versions as the
canonical identities. The former `20261104145814` file is not retained as an
executable migration, preventing future tooling from trying to replay the
Concierge base against Preview. Production history must not be repaired until
the corresponding schema transaction has committed and been verified.

## Rehearsal 1 — trusted-thread uniqueness and migration history

### Current Production baseline

- `public.continuum_project_evidence_associations` exists with 12 columns,
  its Project foreign key, RLS enabled, zero policies, and zero rows.
- It has the primary-key index and the per-Project identity unique index.
- It is missing
  `continuum_project_evidence_associations_trusted_source_uq`.
- No corresponding migration is present in
  `supabase_migrations.schema_migrations`.

The tracked historical migration is
`supabase/migrations/20261106151236_continuum_project_evidence_associations_schema.sql`.
Its LF-normalized SHA-256 is
`A1F6E9380A6F0305F2337940A181CBE57907D6570F27F22E55349398D8BEEDAA`.
Its comment-free, whitespace-normalized executable SQL SHA-256 is
`8FC849F3AEDA42C8F0C03D5C2DF0C89DAC75246CC2C7E25D333334F661A6F766`.
Its executable statements match
`lib/supabase/continuum-project-evidence-associations-schema.sql`; only
release-state and rollback comments differ.

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

The exact historical migration is idempotent against the verified Production
shape. On the existing table it must only have these effective changes:

1. Create the missing partial unique index on
   `(source_type, source_identity) where status = 'trusted'`.
2. Revoke all table privileges from PUBLIC, `anon`, `authenticated`, and
   `service_role`.
3. Grant only SELECT, INSERT, UPDATE to `service_role`.
4. Preserve the existing table identity, rows, constraints, comments, and RLS;
   `CREATE TABLE IF NOT EXISTS` must not recreate it.

Validate with `pg_indexes`, `pg_constraint`, `pg_class.relrowsecurity`,
`pg_policies`, `information_schema.role_table_grants`, and `has_table_privilege`.
`service_role` must lack DELETE, TRUNCATE, REFERENCES, TRIGGER, and MAINTAIN;
`anon` and `authenticated` must have no table privileges. Roll back
unconditionally and recheck that the new index and migration-history row are
absent.

For persistent application, use the checked-in historical Preview migration
`20261106151236`. It is a real tracked migration, not a manual history insert.
The approved migration runner records it only after successful execution.

### Rollback behavior

The pre-existing table must never be dropped. A failed transaction rolls back
automatically. Before association writes, a separately reviewed forward
correction may remove only the new trusted-source index and restore the prior
ACL. After trusted rows exist, retain the table and decisions; disable the
consuming application path and roll forward rather than deleting evidence.

## Rehearsal 2 — durable founder sessions

Source:
`lib/supabase/continuum-founder-sessions-schema.sql`.
Windows checkout SHA-256:
`632EE3BC32F3C46833F7B98DF49EBC1222225993322DC1C09572B4AB6212857A`.
Git-blob SHA-256:
`3218B01757044489F2E9CD44855DC9E28B3853961ED4911DA2AC76F2DE2FE595`.

Tracked migrations:

- `20260916094016_add_continuum_founder_sessions.sql` preserves the already
  recorded Preview base migration, including its historical `GRANT ALL`.
- `20261110203600_continuum_founder_sessions_acl_hardening.sql` immediately
  revokes inherited/direct grants and grants only SELECT, INSERT, UPDATE, and
  DELETE to `service_role`.

The historical migration's LF-normalized SHA-256 is
`CBA50BFB5AF35562E1C3A8D75B0200BBB30F3A0739CD27C694AA0E2D86E1663B`;
its comment-free executable SQL matches the library source at SHA-256
`6329FFCF4067F42548D41000F4D185ADC5A05D93CE8CDC4FC08FC178048F282D`.
The ACL migration's LF-normalized SHA-256 is
`66CF80D6A33FA80FEE1AACFE1146130DAD29B8EAFF8A0059A32DF13B356C0C0B`.

Fresh installs execute both in order. Preview and any other environment that
already records `20260916094016` execute only the additive ACL hardening.

### Preconditions and schema change

1. Confirm `public.continuum_founder_sessions` and both named indexes are
   absent and no migration-history row claims them.
2. Capture existing executive-dashboard authentication behavior and active
   session baselines without recording cookie values.
3. In one rollback-only transaction, create the five-column table, primary
   key, expiration index, and partial active-founder index.
4. Enable RLS with zero policies. Revoke PUBLIC/anon/authenticated. Grant
   `service_role` SELECT for lookup, INSERT for creation, UPDATE for revocation,
   and DELETE for expired-session cleanup. Deny TRUNCATE, REFERENCES, TRIGGER,
   and MAINTAIN.
5. Verify no password, passkey secret, OAuth token, raw IP, or raw browser
   header column exists.

Verification queries use `information_schema.columns`, `pg_indexes`,
`pg_policies`, `pg_class.relrowsecurity`, direct/effective privilege checks,
and a transaction-local insert/read/revoke/delete fixture that is rolled back.
The executable rollback-only contract is
`supabase/tests/continuum_founder_sessions_acl_hardening.sql`, LF-normalized
SHA-256
`0EDEB12E30B9D91BE7B026B5BC35F84E86EE537C9742F8CEB5BDD1AAA2ED8BF7`.

### Rollback behavior

The rehearsal always rolls back. A persistent migration may be dropped only
before it carries sessions. After use, roll back application code and preserve
the revocation ledger; use an additive corrective migration if needed.

## Rehearsal 3 — Concierge persistence

Source:
`supabase/migrations/20261104201449_continuum_concierge_funnel_persistence.sql`.
Git-blob SHA-256:
`16921151FF3E412E4059B7A8FA57CDFF57BEDAC00D9EA3C4B4266E126FB2DA9A`.

ACL follow-up:
`supabase/migrations/20261110194159_continuum_concierge_ack_outbox_acl.sql`,
SHA-256
`4F499F20817822163D6478AD896C4B8F0859F014FA96997E036F31182EE1A479`.

Fresh-install release artifact:
`supabase/release/20261110_continuum_concierge_fresh_install.sql`, SHA-256
`2B21179EB227C9B4540AA40BAEA1BF495C281D72BDBB3BC1DF0FB2272141CCF2`.
It strips only the two tracked files' outer transaction envelopes and executes
their exact bodies under one BEGIN/COMMIT. It is outside the automatic
migrations directory and must not be auto-replayed.

### Preconditions and exact schema change

1. Confirm the outbox and both RPC signatures are absent.
2. Reconfirm the current `continuum_website_intakes` signature and the 21
   Candidate columns referenced by the RPC.
3. Confirm zero live sending integration is wired and the Preview synthetic
   flags are not present in Production.
4. Rehearse the exact fresh-install artifact in one transaction. It creates the
   27-column private acknowledgement outbox, two secondary partial indexes,
   forced RLS with zero
   policies, and two SECURITY INVOKER functions with empty search paths:
   `continuum_accept_concierge_funnel_v1` and
   `continuum_transition_concierge_ack_v1`.
5. Verify only SELECT, INSERT, UPDATE on the table and EXECUTE on the two RPCs
   are effective for `service_role`; PUBLIC, `anon`, and `authenticated` must
   have no table or function privilege.
6. Exercise only transaction-local non-synthetic fixtures. Prove replay
   idempotency, conflict failure, ambiguous identity retention, no canonical
   Project creation, and no transport invocation. Roll back unconditionally.

Index verification must expect eleven `pg_indexes` rows for the outbox: one
primary-key backing index, eight indexes backing the declared UNIQUE
constraints, and exactly two explicitly created partial secondary indexes.
The explicit indexes must be named
`continuum_concierge_ack_outbox_founder_idx` on `(created_at, intake_id)` with
the four-state founder-review predicate and
`continuum_concierge_ack_outbox_reconciliation_idx` on
`(updated_at, outbox_id)` with the `reconciliation_required = true`
predicate. The other nine indexes must each be owned by their corresponding
primary-key or UNIQUE constraint. A check expecting three total indexes is
incorrect because PostgreSQL creates backing indexes for UNIQUE constraints.

### Concierge schema/history coordination

After the single schema transaction commits and its definitions, ACLs, zero
row count, and lack of outbound activity are verified, record migration
versions `20261104201449` and `20261110194159` as applied using separately
approved supported migration-history tooling. Never record or replay
`20261104145814`.

If schema commit succeeds but either history operation fails or only one
version is recorded:

1. Stop; do not rerun the schema artifact or promote application code.
2. Verify the table, all eleven indexes (including exactly two non-constraint
   partial indexes), forced RLS, both RPC definitions,
   function ownership/search paths, exact ACLs, and zero outbox rows.
3. Compare those definitions to the pinned artifact and capture the current
   migration-history list.
4. Obtain repair-only approval, then mark only the missing canonical version or
   versions applied with supported `supabase migration repair --status applied`
   tooling.
5. Re-list history and repeat schema/ACL verification before promotion.

Do not edit `supabase_migrations.schema_migrations` directly and do not repair
history before schema verification.

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
