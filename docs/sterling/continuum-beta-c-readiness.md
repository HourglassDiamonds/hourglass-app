# Continuum Beta C rebuild and publication readiness

Date: 2026-11-03 (America/New_York)

## Verified Preview failure

The Preview failure is not a canonical Project/Job read failure. Hosted request logs show 21 Jobs, 17 Projects, and 13 Candidates loaded before live enrichment. The required live set contains three indexed threads, with zero missing indexed threads and zero missing live-message threads. All three stop before a provider fetch with `token-kek-missing`; the deployment has no `CONTINUUM_GMAIL_*` configuration.

The exact current blocker is therefore missing Preview token custody (`CONTINUUM_GMAIL_TOKEN_KEK`). Gmail authorization validity cannot be tested until a dedicated Preview key can decrypt the stored Preview token. OAuth client configuration is also absent and is the next known configuration requirement. This is not evidence of an expired grant, missing thread, or Gmail provider response because no provider call occurs.

The durable connection row says `connected`, but `last_sync_at` is null. The last completed checkpoints are from September 12. The six indexed messages/six threads include later fixture-era rows and are not proof of live Gmail correctness.

## Canonical rebuild behavior

Today now treats live Gmail completeness as a Sterling gate rather than a prerequisite for canonical reconstruction. Exact indexed evidence remains available, successful live threads are retained during partial enrichment, and canonical Projects and Jobs compose when Gmail is unavailable. The persisted read model records `complete`, `partial`, `unavailable`, or `not-required` correspondence coverage and the UI warns when correspondence is incomplete.

Unexpected canonical load/composition failures, a required set that moves without being attempted, and snapshot publication failures retain their existing visible failure behavior. Founder decisions remain canonical inputs and are not rewritten by this change.

## Read-only readiness preflight

The founder-authenticated, verified-Preview-only route `/executive-dashboard/concierge/sterling-today/readiness` reports aggregate state only:

- Gmail connection/configuration status and the first safe authorization blocker.
- Last successful checkpoint time, checkpoint age, and indexed message/thread coverage.
- Opaque Project/Job, founder-correction/Candidate-review, and full Today source watermarks.
- Today read-model compatibility, currentness, rebuild time, and correspondence coverage.
- Sterling validation readiness, publisher flag, latest publication status, and expiration.
- Exact safe blocker codes.

It does not contact Gmail, decrypt or return a credential, expose message content/IDs, run a model, create a proposal, mutate canonical data, or publish.

## Compatible freshness policy

Three clocks must remain distinct:

1. **Canonical record freshness.** Project/Job and founder-decision freshness is change-driven. The deterministic source watermark changes only when covered canonical evidence (or an explicit time boundary such as snooze expiry) changes. It is not extended by a publisher run.
2. **Gmail evidence freshness.** For the intended daily operating cadence, a completed checkpoint should be no older than 36 hours, with full required-thread coverage and no checkpoint/provider error. The 12-hour grace tolerates a late daily run; it never makes missing or partial correspondence complete. A founder-triggered publication must still ingest and verify current evidence immediately before assembly.
3. **Sterling publication freshness.** The installed constraint requires `expires_at <= published_at + 30 minutes`. Keep the current 15-minute TTL for initial activation. After separate review it may increase, but never beyond 30 minutes without a migration and policy review. Daily schedules cannot make Sterling continuously current: after expiration the reader must show canonical fallback until a later successful publication.

A missed schedule, stale Gmail checkpoint, changed source watermark, failed validation, malformed/expired publication, or unavailable provider always selects labeled canonical fallback. No run may extend an existing publication or re-label old evidence as fresh.

## Requirements before activation

- Create dedicated Preview Gmail OAuth credentials and callback configuration; do not copy Production credentials.
- Establish a Preview token-encryption key and re-authorize the intended Preview mailbox so the stored refresh token is encrypted for that key.
- Confirm the OAuth user type/publishing state avoids seven-day test-token expiry, or explicitly accept that limitation for Preview.
- Run a fresh metadata ingestion and verify the checkpoint, History API cursor, required-thread coverage, and source watermark.
- Rebuild Today and require complete live correspondence for Sterling validation.
- Review the preflight output, keep publisher/schedules off, then separately approve activation and its maximum 30-minute publication TTL.
