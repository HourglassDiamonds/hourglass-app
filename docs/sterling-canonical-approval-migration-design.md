# Sterling canonical approval transaction — migration design (unapplied)

Status: founder approval required before creating or applying a migration.

## Why a migration is required

The proposal ledger records founder decisions durably, and the canonical Job writer is versioned and idempotent. The lifecycle writer is idempotent but has no expected-version argument. A founder correction can also require a lifecycle transition and Job resolution/cancellation together. Calling the existing writers sequentially could leave partial canonical truth.

## Additive design

1. Extend `continuum_sterling_proposals.proposal_type` to admit `canonical_change_set` and `source_suppression`.
2. Add a service-role-only `continuum_sterling_execute_approved_change_set` RPC.
3. The RPC accepts only `proposal_id`, `expected_ledger_updated_at`, and `actor`. It reads operations and evidence from the immutable proposal payload; callers cannot substitute a new payload at approval time.
4. In one database transaction it:
   - locks the proposal row and requires `approved` or `edited_and_approved`;
   - rejects a stale ledger version;
   - validates every exact Project/Job/Candidate identifier and expected record version;
   - locks target rows in deterministic identifier order;
   - rejects Person/Project mismatches and any attempted identity reassignment;
   - invokes the existing lifecycle and Job history logic with operation-specific deterministic mutation IDs;
   - applies exact Candidate/source suppression only when candidate ID, retained source refs, and verified email hash all match;
   - marks the ledger row executed only after every canonical operation succeeds.
5. Any exception rolls back canonical rows, history rows, and ledger execution state together.
6. Replaying an executed proposal returns `already-present`; a different payload under the same proposal ID raises an idempotency conflict.

## Rollback

Rollback is compensating, never destructive: a new founder-approved change set restores the prior lifecycle, Job state/holder, or source disposition while preserving both histories. The migration itself is additive; disabling the application feature flags immediately returns Today to the legacy publisher.

## Security and verification

- Revoke the RPC from `public`, `anon`, and `authenticated`; grant only `service_role`.
- Do not expose a browser write path.
- Add pgTAP/Postgres tests for approval requirement, stale versions, idempotent replay, cross-client rejection, exact-source suppression, and transaction rollback after an injected second-operation failure.
- Run Supabase security/performance advisors before committing the generated migration.
