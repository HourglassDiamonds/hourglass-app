# Sterling canonical approval transaction — migration design (unapplied)

Status: exact migration and application adapter prepared for review. The migration is intentionally unapplied; founder approval is still required before any shared Preview database application.

## Why a migration is required

The proposal ledger records founder decisions durably, and the canonical Job writer is versioned and idempotent. The lifecycle writer is idempotent but has no expected-version argument. A founder correction can also require a lifecycle transition and Job resolution/cancellation together. Calling the existing writers sequentially could leave partial canonical truth.

## Additive design

1. Extend `continuum_sterling_proposals.proposal_type` to admit `canonical_change_set` and `source_suppression`.
2. Add service-role-only decision, execution, and bounded Preview-publication RPCs. Public wrappers are security-invoker functions; implementation functions live in a private schema, use a fixed empty search path, and are not executable by browser roles.
3. Bind a proposal to explicit row versions before it is shown for approval: monotonic proposal and Candidate `record_version`, exact lifecycle `updated_at` plus current stage/kind, and exact Job `updated_at` plus Project/Person/state.
4. A plain approval submits only proposal identity and expected ledger version through the server repository. The server reloads the immutable original payload. An edited approval must submit a complete payload that passes the same server contract, is stored as the founder-approved payload, and is fingerprinted in the database. The executor accepts no caller payload.
5. In one database transaction it:
   - locks the proposal row and requires `approved` or `edited_and_approved`;
   - rejects a stale ledger version;
   - validates every exact Project/Job/Candidate identifier and expected record version;
   - locks target rows in deterministic identifier order;
   - rejects Person/Project mismatches and any attempted identity reassignment;
   - invokes the existing lifecycle and Job history logic with operation-specific deterministic mutation IDs;
   - applies exact Candidate/source suppression only when candidate ID, retained source refs, and verified email hash all match;
   - marks the ledger row executed only after every canonical operation succeeds.
6. Any exception rolls back canonical rows, history rows, suppression audit rows, and ledger execution state together.
7. Replaying an executed proposal returns `already-present`; a different payload under the same proposal ID raises an idempotency conflict.

## Founder approval/API boundary

- The approval repository is server-only and is constructed only after an independently signed founder session is verified. Possession of the Supabase service credential is not treated as founder authorization.
- `approved` always uses the database-loaded original proposal; browser-supplied replacements are ignored.
- `edited_and_approved` requires an entire validated payload with the same proposal ID and proposal kind. The exact edited payload and fingerprint become immutable decision history.
- Execution is a second RPC using the decision RPC's returned `record_version`. Concurrent or stale approvals fail closed.
- Existing legacy proposal types remain readable by the legacy ledger UI but are excluded from the new canonical executor.

## Preview Today publication

Page rendering never invokes the semantic model. An explicit server workflow obtains the existing durable semantic lease, runs v6, requires `PASS`, accepted validation, and every mutation to be reviewable, then publishes an immutable snapshot for 15 minutes (database maximum: 30 minutes). The page reads only an active, unexpired, fingerprinted publication. Missing schema, missing publication, expired publication, invalid validation, or any non-Preview isolation signal falls back to the legacy publisher.

Activation additionally requires Vercel Preview runtime, `CONTINUUM_ENV=preview`, the configured Preview Supabase project reference, and the Preview-only publisher flag. The flag remains off and no browser control invokes publication in this gate.

## Rollback

Rollback is compensating, never destructive. Lifecycle/holder/source disposition can be restored by a new founder-approved change set. A resolved or cancelled Job is terminal history and is not reopened; correction creates a new founder-approved Job through the existing canonical writer. Disabling the application feature flags immediately returns Today to the legacy publisher without deleting schema or history.

## Security and verification

- Revoke the RPC from `public`, `anon`, and `authenticated`; grant only `service_role`.
- Do not expose a browser write path.
- The executable disposable-Postgres regression covers approval requirement, stale versions, idempotent replay, cross-client rejection, exact-source suppression/compensation, browser-role denial, legacy compatibility, and rollback after an injected later-operation failure.
- Static TypeScript migration tests enforce the intended ACL, fixed search path, locking, version checks, canonical writer reuse, and bounded publication design.
- The SQL regression and Supabase security/performance advisors must run against an isolated database after migration review and before shared Preview application. They cannot validate an unapplied migration against the existing remote schema.
