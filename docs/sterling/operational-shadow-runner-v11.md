# Sterling v11 bounded operational shadow runner

## Release boundary

This packet starts at `c70d122a2fb6cf05d5b77ae8368c1b5c1bda9132`. The runner is a founder-authenticated Server Action at:

`/executive-dashboard/concierge/sterling-today/operational-review`

It calls the existing `assembleSterlingTodayShadow()`, `executeSterlingTodaySemantic()`, and `compareOperationalBoard()` implementations. It does not call the normal Today loader, publisher, recomputation, incremental Gmail sync, history sync, or canonical approval executor.

The server owns the exact 23-thread November 11 allowlist. The browser supplies no thread, mailbox, model, project, destination, or scope value.

## Runtime and persistence contract

- Next.js Node runtime, `maxDuration = 300` seconds.
- Exact Gmail batch budget: 23 threads, with an 80-second total retrieval deadline.
- Existing foreground model deadline: 180 seconds.
- Existing six-minute `continuum_sterling_today_run_leases` lease prevents concurrent execution.
- A separately authorized `CONTINUUM_STERLING_OPERATIONAL_SHADOW_EXECUTION_ID` is incorporated into the deterministic lease digest. A terminal row with that digest blocks a duplicate submission. A new execution requires a new explicit ID and authorization.
- The sanitized result returns synchronously. The founder UI keeps that sanitized object in browser `sessionStorage` and offers an explicit JSON download. Refresh never invokes Gmail or the model automatically.
- The only database write is the existing metadata-only lease claim/finalization. There are no Gmail index, attachment, checkpoint, proposal, association, Candidate, Person, Project, Job, Today snapshot, publication, or outbound writes.
- The Gmail access token and decrypted refresh token exist only in function memory. The existing token-custody path does not persist a rotated refresh token; it fails closed with `refresh-token-rotated`. Therefore this run requires no token-refresh persistence authorization.

## Evidence behavior

The ordinary source viewer remains indexed-message-only. This runner explicitly requests the complete contents of each already allowlisted exact thread. The ephemeral working set includes newly observed message IDs from those threads, but it does not index them.

The result records, per thread:

- exact thread ID;
- all observed message IDs;
- retrieval timestamp;
- latest indexed and live timestamps;
- unindexed and newer-unindexed message IDs;
- body-incomplete message IDs;
- provider or scope failure category.

No message body, snippet, quote-stripped excerpt, email address, OAuth token, model prompt, or raw model response is returned to the browser result. Consequential work units backed by incomplete messages remain visibly evidence-limited. Unresolved identities remain bound to exact source threads; the comparator never resolves a person by name.

The founder-reviewed comparison keeps sequential Zane facts separate: workshop delivery, receipt by Justin, inspection, video, invoice, final payment, and client handoff. The October 27 payment is not treated as final settlement. The expected current operational row is one founder-held quality-control/handoff sequence, not several immediately actionable Jobs.

## Model disclosure

The existing provider is the OpenAI Responses API at `/v1/responses`, using the repository-pinned foreground model `gpt-5.6-sol`. No new provider is introduced. The request has `store: false`.

The transmitted structured working set is minimized to the 23-thread review frontier plus required canonical context: exact evidence/thread/message identifiers, chronology, direction, subject, quote-stripped current-message operational text, extraction classification, attachment filenames/metadata, email hashes rather than mailbox credentials, canonical Person/Project/Job identity and state, founder directives, prior Today references, and validation metadata. OAuth credentials and full raw MIME messages are never included.

The application does not persist or log the prompt, correspondence, or raw response. `store: false` disables Responses application-state storage, but it does not by itself prove that the OpenAI API project has Modified Abuse Monitoring or Zero Data Retention. Before execution, the operator must verify the existing OpenAI project data-control setting. Under standard API controls, abuse-monitoring logs may retain customer content for up to 30 days; API content is not used for training unless the organization explicitly opts in.

## Exact deployment target and configuration

Deploy the reviewed commit as one deployment-protected **Preview** in the existing Vercel project `prj_bo3WR8iqDpL6gJTGUZCzwqBfqAqV` (`hourglass-app`) used by the accepted durable-founder/read-only Continuum staging path. It must be a branch-pinned Preview deployment: never target Production, promote it, or change an alias. The deployment gate must record and pin that exact Vercel project ID and the resulting commit SHA in the existing staging identity variables; the runner independently requires `isVerifiedContinuumProductionStagingRuntime()`.

Required server-only configuration:

- existing Production-staging identity pins: `CONTINUUM_PRODUCTION_STAGING_ENABLED=true`, exact `CONTINUUM_PRODUCTION_STAGING_PROJECT_ID`, exact `CONTINUUM_PRODUCTION_STAGING_COMMIT_SHA`;
- `CONTINUUM_ENV=production`, `VERCEL_ENV=preview`, canonical Production `SUPABASE_URL`, service-role credential, and `CONTINUUM_PRODUCTION_SUPABASE_PROJECT_REF=bnafadfgrrriblppeubp`;
- existing durable founder session/signing and database rate-limit configuration;
- existing Gmail encrypted-token custody values (`CONTINUUM_GMAIL_TOKEN_KEK`, OAuth client ID/secret/redirect URI, founder mailbox and internal-address configuration);
- existing OpenAI API credential and the repository-pinned model;
- `CONTINUUM_STERLING_OPERATIONAL_SHADOW_ENABLED=true` only for the authorized deployment;
- a new non-secret, one-use `CONTINUUM_STERLING_OPERATIONAL_SHADOW_EXECUTION_ID`;
- `CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED=false`, `CONTINUUM_TODAY_MANUAL_RECOMPUTE_ENABLED=false`, `CONTINUUM_GMAIL_RECURRING_SYNC_ENABLED=false`, `CONTINUUM_GMAIL_MANUAL_REFRESH_ENABLED=false`, and `CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED=false`; the runner also fails closed if any of those controls is enabled;
- OAuth reconnect, Concierge submission, client mutations, and outbound controls remain off under the existing staging restriction matrix.

The Gmail/OAuth/KEK and OpenAI values must be assigned through Vercel's encrypted server-only environment configuration by the responsible credential operator or copied from the approved credential vault directly into Vercel. They must never be pulled into this worktree, a shell transcript, build argument, `NEXT_PUBLIC_*` value, or local file. Deployment must be created only after configuration is complete, and Vercel-owned `VERCEL_PROJECT_ID`, `VERCEL_GIT_COMMIT_SHA`, and `VERCEL_ENV` must never be spoofed.

## Execution and teardown

1. Verify the pushed SHA, protected Preview target, Vercel-owned identity, Production database project ref, publisher/recompute flags off, and exact founder mailbox hash.
2. Verify the OpenAI project retention/data-control posture and confirm the founder is present.
3. Sign in through the durable founder login and open the operational-review URL.
4. Click once. Do not refresh while the request is running. A second submission is rejected by the lease.
5. Download the sanitized JSON. Confirm all 23 outcomes, newer-message visibility, body-completeness limitations, generated board, actual comparator categories, unresolved identity mappings, and proposed founder-review changes.
6. Disable the one-use execution flag or remove the branch-scoped deployment after evidence capture. Keep publisher and recompute off. No database business cleanup is needed; the lease receipt is intentionally retained.

## Copy-ready authorization

> I authorize one deployment-protected Vercel Preview of the reviewed Sterling operational-shadow commit to Vercel project `prj_bo3WR8iqDpL6gJTGUZCzwqBfqAqV` (`hourglass-app`), pinned to `codex/continuum-controlled-release`, with genuine Vercel project/commit identity and the existing durable founder-session restrictions. This is not a Production deployment: do not promote it or change an alias. Configure the existing Production Supabase, encrypted Gmail token-custody, and OpenAI credentials only through the approved branch-scoped, server-side Vercel secret workflow; do not copy secrets locally or expose them. Enable `CONTINUUM_STERLING_OPERATIONAL_SHADOW_ENABLED` with one newly approved execution ID for exactly one founder-triggered run of the fixed 23-thread November 11 scope, while keeping all Gmail sync, Today recomputation, and Sterling publication controls explicitly off. The run may read Production canonical/index records, refresh an ephemeral Gmail access token without persisting token rotation, retrieve the complete allowlisted Gmail threads, send the minimized bounded working set to the existing OpenAI Responses API with `store:false`, run the existing assembler/model/validator/comparator, and write only the existing Sterling lease metadata. No Gmail index/checkpoint/attachment write, proposal/association/Candidate/canonical/Job/Today/publication write, OAuth reconnect, scheduler change, alias change, outbound activity, or Production deployment is authorized. Preserve the sanitized result, then disable/remove the one-use runner configuration. Stop on identity mismatch, rotated refresh token, incomplete required evidence, timeout, lease conflict, or any attempted write outside the lease.
