# Projectless work checkpoint

Branch: `continuum/projectless-work`.
Worktree: `C:/Users/justi/OneDrive/Desktop/hourglass-app-projectless-work`.
Base/HEAD: `397d12cb950e79de95ccf154583f944e7d91d3bf`.

Verdict after the two adversarial-review fixes: **SAFE TO COMMIT**.
No commit, push, migration deployment, or application deployment was performed.

The earlier implementation supports projectless Jobs, atomic Job/history writes,
Project-only Source Notes, and Quick Capture persistence. This follow-up changes
only operation identity, Project evidence boundaries, their adapter wiring, and
regression verification. Reminder, Watching, ranking, presentation, model routing,
and the separate Source Note revision privilege discrepancy are unchanged.

## Immutable operation identity

The same unapplied migration now adds one nullable JSONB `operation` column to
`continuum_project_job_mutations`. Every new RPC write stores a versioned snapshot
of the full original canonical input, comparison fields, typed prior row, action,
actor, and complete application request in the same transaction as Job/history.
JSONB structural equality compares the operation without a hash collision risk.
It preserves nulls, dates, text, provenance, associations, states, and field values.

Direct RPC calls without an application request compare every canonical field,
including Job identity and timestamps. Application calls also compare the exact
submitted request. Only server-allocated create IDs and server-generated mutation
clock fields are excluded from their canonical comparison; the winning values
remain in the persisted canonical snapshot. The create API has no caller-supplied
Job target. A changed supplied request target or any other request field conflicts.
No fuzzy title matching or lossy text normalization establishes mutation identity.

Both writer adapters look up the persisted original request before reporting a
retry as successful. This works even after later edits to the Job. Create checks
mutation identity before existing unresolved-subject deduplication and rechecks
when a concurrent create may have appeared. Mutations recheck history after the
canonical read, covering a winner committing between those reads. The database
rechecks the complete operation under its mutation-ID advisory transaction lock.
Conflicts return `invalid-input` / `idempotency-conflict`, leave the Job unchanged,
and append no history. Exact retries return the existing Job and no extra history.
The Human Intake in-memory adapter now supplies the same operation contract.

Historical history rows retain NULL snapshots. Their original intent cannot be
reconstructed reliably, so reusing those mutation IDs fails closed. New mutation
IDs for existing Jobs remain supported. This is a deliberate compatibility limit.
Operation snapshots add storage proportional to the request and two canonical rows.

## Evidence boundary

`relatedToJob()` rejects a candidate with an explicit Project when it differs from
the Job's Project, including when the Job is projectless, before token matching.
Same-Project behavior and existing unscoped evidence matching remain supported.
Reconciliation and anomaly detection share this guard. Founder-attention Job
suppression already checks explicit Project equality; no new association rule or
fuzzy cross-Project exception was added. Terminal/current-action suites passed.

## Validation

- Focused Job, Quick Capture, evidence/reconciliation, and Today suites: 528 passed.
  The additional history/read-race test subsequently passed in the final full suite.
- `npm run test:continuum`: **2,287 passed, 0 failed**, 405 suites.
- `npx tsc -p tsconfig.projectless.json --noEmit`: passed, including the new tests
  and Human Intake adapter.
- ESLint on all files changed by this fix: passed.
- `git diff --check`: passed.
- Native PostgreSQL transactional/idempotency test: passed, with clean shutdown.
  It validates forced history rollback, all canonical create-field conflicts,
  state-mutation payload/prior conflicts, no duplicate history, restricted FKs,
  denied browser-role execution, and genuinely concurrent PostgreSQL sessions.
  Four concurrent scenarios cover identical/conflicting retries for both strict
  direct RPC and application requests with different generated IDs/timestamps.
  The observer verifies the second backend is blocked on the first transaction
  before committing; no sleep determines the ordering or expected result.

The SQL test creates a fresh loopback-only local cluster with a synthetic schema;
it does not prove deployed PostgREST/schema-cache behavior or modify Supabase.
Test dependencies were installed under the temporary directory, outside the repo;
no application package manifest or lockfile changed.

For the local database test, install `embedded-postgres@18.4.0-beta.17` outside the
repository and set `EMBEDDED_POSTGRES_MODULE` to its `dist/index.js` file URL.
On Windows set `POSTGRES_CTL` to the bundled
`@embedded-postgres/windows-x64/native/bin/pg_ctl.exe` for graceful shutdown.
Run `node --test scripts/continuum-projectless-postgres.test.mjs`.

## Migration and rollout

The migration remains
`supabase/migrations/20260929113152_projectless_founder_work.sql`.
Besides the original nullable Project columns and transactional function, it now
adds the operation snapshot and extends the RPC with optional `p_request jsonb`.
SECURITY INVOKER, empty search_path, fully qualified SQL, existing table RLS,
FK/check/index behavior, and service-role-only EXECUTE remain intact.
The original five-argument function was never deployed; there is no deployed
function overload to remove. No historical UNAPPLIED scripts are replayed.

Apply this migration before the application. Old application instances can still
write NULL operation snapshots and retain their old split-write behavior, so drain
Job writes during rollout, apply the migration, retire old instances, deploy and
smoke-test, then resume writes. Preview and Production deployment require separate
authorization and were not performed here.

## Files changed by this follow-up

1. `lib/continuum/client-memory/project-jobs/operation.ts` (new)
2. `lib/continuum/client-memory/project-jobs/operation.test.ts` (new)
3. `lib/continuum/client-memory/project-jobs/create.ts`
4. `lib/continuum/client-memory/project-jobs/create.test.ts`
5. `lib/continuum/client-memory/project-jobs/mutate.ts`
6. `lib/continuum/client-memory/project-jobs/mutate.test.ts`
7. `lib/continuum/client-memory/project-jobs/store.ts`
8. `lib/continuum/client-memory/project-jobs/supabase-writer.ts`
9. `lib/continuum/client-memory/project-jobs/writer.ts`
10. `lib/continuum/client-memory/project-jobs/atomic-writer.test.ts`
11. `lib/continuum/chief-of-staff/operating-loop/evidence.ts`
12. `lib/continuum/chief-of-staff/operating-loop/projectless-evidence.test.ts` (new)
13. `lib/continuum/human-intake/review/memory.ts`
14. `supabase/migrations/20260929113152_projectless_founder_work.sql`
15. `scripts/continuum-projectless-postgres.test.mjs`
16. `tsconfig.projectless.json`
17. `docs/continuum-projectless-work.md`
