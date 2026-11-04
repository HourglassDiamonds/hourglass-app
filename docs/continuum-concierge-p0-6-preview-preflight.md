# Continuum Concierge P0.6 — Preview integration preflight

Preflight date: 2026-11-04. Target inspected read-only: Supabase project `hrmpzplffuhhvbtxxhnt` (`Continuum Preview`), PostgreSQL 17.6. No shared database object, record, credential, deployment, provider, HubSpot route, or Sterling publisher was changed.

## Decision

**GO for one controlled schema-only Preview migration after the authorization gate below. NO-GO for application activation in the same change.** The additive schema is compatible with current Preview and existing records. Website-to-persistence wiring remains a separately reviewed application change, and live delivery remains prohibited.

Migration: `supabase/migrations/20261104145814_continuum_concierge_funnel_persistence.sql`

SHA-256: `16921151ff3e412e4059b7a8fa57cdff57bedac00d9ea3c4b4266e126fb2da9a`

## Shared Preview compatibility evidence

- Required migration history is present: projectless founder work, Attention persistence, website inquiry intake, Today snapshots, transactional Candidate approval/versioning, and shared Preview ACL hardening.
- `public.continuum_website_intakes` exists with the expected UUID primary key, unique 64-hex submission hash, source/identity/synthetic checks, Person/Job/review foreign keys, source/review/person indexes, RLS, and service-role-only access.
- Preview contains five existing website intakes. All have the expected `hourglassdiamonds.com/concierge` source, valid `new` identity state, no Person/Job FK orphans, and `acknowledgement_state = not_expected`.
- `public.continuum_candidates` exists with the expected 64-hex identity, `human-intake` source allowance, open-job type, noncanonical/automatic-apply checks, source/review indexes, RLS, and service-role-only access. All 13 existing Candidates are noncanonical Gmail records; there are no pre-existing website Candidates.
- Current Preview adds `record_version bigint not null default 1`, a positive-version check, and a before-update version trigger. The Concierge insert intentionally omits that column and receives version 1; exact replay ignores mutable review/version fields. Disposable acceptance verifies this behavior.
- Existing RPC signatures match the adapter dependency: `continuum_ingest_website_inquiry(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,text,jsonb)`, `continuum_record_website_intake_hubspot(uuid,text,text,text,text)`, and `continuum_write_project_job(jsonb,uuid,text,text,jsonb,jsonb)`. They are PostgreSQL-owned, `SECURITY INVOKER`, empty-search-path, and executable only by `service_role`.
- Neither Concierge RPC nor the outbox table currently exists, so the migration has no name/signature collision.
- New outbox foreign keys are covered by their unique indexes. The two operational partial indexes match founder-review/reconciliation reads.
- The RPC now refuses any intake whose authoritative `acknowledgement_state` is not `pending`. Therefore the five current `not_expected` rows cannot be silently backfilled into ready acknowledgments.

## Beta Recovery compatibility

The exact requested Beta Recovery commit `b7ec996d3047805f98aeb14bfd264e9f87a16acb` was compared read-only. Its intake RPC adapter, Candidate identity/source contract, Candidate row mapper, Candidate store, and Today loader remain compatible. The active Beta worktree later advanced to `72f4ad2`, but there is no diff between those commits in the Candidate attention, proposed-action, or source-label functions used by this preflight.

A P0.5 Candidate evaluated through that current Beta logic enters Sterling Today’s `decision` lane with score 108 and founder ownership. It is not an immediately approvable `proposedAction`, because the website source reference is not a stored Human Intake artifact and there is no canonical Project target; that is the desired no-silent-canonical-write boundary. Beta still renders the shared source label as `Human Intake`; `Website Concierge` remains available only in the isolated Concierge projection/outbox until a separately authorized presentation-only integration.

## Security result

- Proposed outbox: RLS enabled and forced, zero policies, PUBLIC/anon/authenticated table privileges revoked, only select/insert/update granted to `service_role`, no delete grant.
- Proposed RPCs: `SECURITY INVOKER`, `search_path = ''`, explicit PUBLIC/anon/authenticated execute revocation, service-role-only execute, no view, trigger, extension, or `SECURITY DEFINER` behavior.
- Current Preview roles confirm anon/authenticated do not bypass RLS; `service_role` does. Current prerequisite tables and RPCs deny anon/authenticated access.
- The `public` schema may be Data-API exposed, but explicit privileges remain the authorization boundary; current Supabase behavior no longer guarantees automatic exposure of new tables. The migration does not rely on either default.
- The persistence factory is behind `import "server-only"`, uses the existing admin client, is absent from the public Concierge barrel, and contains no client/publishable service-role path.
- Supabase’s security advisor has one unrelated existing warning: mutable search path on `continuum_repair_quotes_protect_issued`. It does not involve Concierge. The expected service-only “RLS enabled, no policy” notices are informational.
- Performance advisors report existing unrelated FK/index findings and the already-existing duplicate Candidate primary/identity index. The Concierge migration adds no uncovered FK.

## Exact affected objects

Created only:

- Table `public.continuum_concierge_ack_outbox`, including its primary key, eight unique constraints/indexes, two restrictive foreign keys, column/domain checks, delivery/attempt/follow-up checks, comments, RLS, and forced RLS.
- Partial indexes `continuum_concierge_ack_outbox_founder_idx` and `continuum_concierge_ack_outbox_reconciliation_idx`.
- RPC `public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb)`.
- RPC `public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean)`.
- Explicit table/function ACLs and comments for those new objects.

No existing table, function, index, policy, trigger, record, extension, or role is altered. Existing intake and Candidate tables are referenced only by restrictive foreign keys and runtime validation.

## Backup, restore, and rollback

Immediately before the controlled migration, create a schema-only public-schema backup with the pinned CLI and retain its checksum:

```powershell
supabase db dump --project-ref hrmpzplffuhhvbtxxhnt --schema public --keep-comments --file continuum-preview-public-before-concierge.sql
Get-FileHash -Algorithm SHA256 continuum-preview-public-before-concierge.sql
```

Do not place the database password or backup in Git. Validate restore into a disposable local Supabase/PostgreSQL instance that has the standard Supabase roles:

```powershell
psql $env:CONTINUUM_RESTORE_TEST_URL -v ON_ERROR_STOP=1 -f continuum-preview-public-before-concierge.sql
```

Then run the same catalog checks for prerequisite tables, RPC signatures, ACLs, RLS, constraints, and indexes. A schema-only backup does not protect application rows; existing data is protected here because the migration is additive and performs no data mutation. Normal Preview backup/PITR coverage must still be confirmed at the authorization gate.

Rollback is a follow-on controlled Preview migration, after disabling the not-yet-activated caller:

```sql
begin;
revoke all on function public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb)
  from public, anon, authenticated, service_role;
drop function public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean);
drop function public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb);
drop table public.continuum_concierge_ack_outbox;
commit;
```

Rollback deliberately retains noncanonical Candidate rows so reviewed founder work is never destroyed. Before any post-activation rollback, export outbox IDs and Candidate IDs for reconciliation. Existing website intake, Person, projectless Job, Candidate versioning, Today snapshot, HubSpot, Gmail, and Calendar objects remain untouched.

## Smallest application integration after schema approval

One separately reviewed server-only call is needed immediately after a successful `ingestWebsiteInquiryServer` result and before the existing HubSpot branch:

1. Map the authoritative intake result to `IdentityResolution`; never recreate or override its Person.
2. Build the existing P0 record with the normalized inquiry, `emailVerification: unverified` until a real verifier exists, service acknowledgment consent only, and follow-up/text consent not granted.
3. Change `acknowledgementExpected` from `false` to `true` only with explicit founder approval of that service acknowledgment contract. The hardened RPC otherwise rejects persistence, and existing five `not_expected` rows are not backfilled.
4. Call `createSupabaseConciergeFunnelStore().accept(record)`. Do not call `dispatchAcknowledgement`; the row remains durable and unsent.
5. Existing Beta Candidate loading makes the pending open-job Candidate visible in Sterling Today’s decision lane. No Sterling publisher change is required for visibility; a later presentation-only change is required for the `Website Concierge` label.
6. Leave the existing HubSpot behavior unchanged until its separately authorized retirement.

## Authorization gate

Required authorization text should name the exact review commit and checksum and permit only: **apply this single additive migration to Continuum Preview project `hrmpzplffuhhvbtxxhnt`, after schema-only backup/checksum and Preview backup/PITR confirmation; run post-migration catalog/security smoke checks; do not activate any application caller, transport, provider, Vercel change, HubSpot change, or Production migration.**

Application wiring requires a second authorization after the schema-only migration is verified.
