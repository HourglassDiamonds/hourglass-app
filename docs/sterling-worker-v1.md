# Sterling / Dot Worker V1

Sterling is a grounded read-and-propose decision-support layer over Continuum. It ranks founder work, scans for missing or inconsistent state, reviews Quick Capture proposals, and persists review-required recommendations in a dedicated approval ledger. Continuum remains the system of record: only existing canonical writers may change business state.

## Reconciled V1 contract

The original proposal envelope contained a deterministic proposal ID, proposal type, affected entity, human-readable current and proposed states, reason, evidence references, downstream effect, review-required status, and writer-support flag. Supported types are job update, priority change, due date, waiting state, duplicate merge, stale resolution, new projectless Job, and follow-up.

Canonical Job changes already flow through `ProjectJobWriter`. Its Supabase implementation calls the atomic `continuum_write_project_job` function, which writes the Job and immutable mutation history together and uses a caller mutation UUID for idempotency. Before this phase, the Concierge UI stopped at an advisory proposal details panel; no founder decision or execution linkage survived the response.

The missing durable facts were the original proposal, current-state fingerprint, model/run provenance, founder decision, edits, deferral, execution lifecycle, canonical mutation ID, failure state, and supersession chain.

## Proposal ledger

Migration `20261003010000_sterling_proposal_ledger.sql` creates `public.continuum_sterling_proposals`. It is additive and intentionally unapplied. The table stores:

- Immutable original proposal, evidence references, reasoning, confidence, and affected canonical identity.
- Current-state snapshot, SHA-256 fingerprint, entity version, and source watermark.
- Provider, model, configuration, run ID, workflow, contract version, and prompt version.
- Founder decision, timestamp, optional note, edit payload, and defer time.
- Execution state, executed payload, canonical mutation ID, error category, and timestamps.
- Optional replacement and supersession links.

The lifecycle is:

```text
proposed ─┬─> approved ───────────┐
          ├─> edited_and_approved ├─> executing ─> executed
          ├─> rejected            │                └> failed ─> executing (retry)
          ├─> deferred ───────────┘
          └─> superseded
```

Deferred proposals can later be approved, edited and approved, rejected, deferred again with the same decision, or superseded. Rejected, executed, and superseded proposals are terminal. Unsupported proposal types remain approved with `blocked_unsupported` execution state; they are never treated as executed.

## Repository and execution boundary

The repository supports create, get, active listing, entity history, recent decisions, approval, edit-and-approval, rejection, deferral, execution claiming, success/failure linkage, unsupported execution, and supersession. Both in-memory and Supabase implementations use compare-and-set transitions. Proposal creation is idempotent; reuse of a proposal ID with different immutable content fails closed.

Approval execution follows this path:

```text
Founder Server Action
  -> authenticated Sterling repository
  -> durable decision
  -> current canonical fingerprint check
  -> atomic execution claim
  -> existing ProjectJobWriter
  -> canonical Job + mutation history
  -> ledger mutation linkage
```

The proposal UUID is also the canonical writer mutation UUID. Double-clicks and concurrent approvals can therefore race safely without producing duplicate Job mutations. An interrupted `executing` or `failed` proposal can retry the same canonical mutation idempotently.

For Job updates, Sterling also passes the proposal's expected `updatedAt` version into the existing writer. The writer checks it after loading the current Job, and the database function still performs its full prior-row compare. A mismatch, deletion, or concurrent canonical change blocks execution and supersedes the proposal as stale.

The only executable V1 actions are waiting-state Job updates and founder-confirmed projectless Job creation from Quick Capture. Duplicate merges, follow-up sends, and ambiguous corrections remain approval-recorded but execution-blocked until a canonical writer exists.

## Founder UI

Persisted proposals show recommendation, evidence, current and proposed state, confidence, freshness behavior, expected effect, and canonical identity. The founder can approve, edit and approve, reject with an optional note, or defer until later today, tomorrow, or a custom time. Founder edits are stored separately from the immutable original and the final executed payload.

If the migration is not active, Concierge still returns grounded advisory results but hides executable controls and says why. It never falls back to ephemeral approval state.

## Preference signals

Recent ledger decisions produce inspectable advisory signals after at least three decisions of the same proposal type. V1 reports approval/rejection/defer counts and highlights repeated edits or deferrals. A single decision never becomes a rule. Sterling may add a matching, evidence-counted ledger explanation to a proposal, but does not invent preference narratives or train opaque embeddings.

## Security and privacy

- RLS is enabled and `public`, `anon`, and `authenticated` receive no raw-table privileges.
- The application's signed founder session is checked before a server-only service-role repository is constructed.
- Client components call authenticated Server Actions and never access Supabase directly.
- Ledger evidence is bounded to references; telemetry does not contain private message bodies.
- The migration grants only select, insert, and update to `service_role`; there is no delete path.

## Verification

```text
npm run test:continuum:sterling
npm run test:continuum:sterling-ledger
npm run continuum:sterling-eval
```

The extended evaluation contains 35 scenarios: the original 26 grounding and no-write cases plus stale, edited, rejected, deferred, duplicate-approval, writer-failure, preference-context, conflicting-history, and no-history ledger cases.
