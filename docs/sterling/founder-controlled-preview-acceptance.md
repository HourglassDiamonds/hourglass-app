# Sterling founder-controlled Preview acceptance

Status: preflight only. No shared Preview fixture rows are authorized by this document.

The executable source of fixture identifiers and version expectations is
`lib/continuum/today-sterling/founder-acceptance-fixture-manifest.ts`. Importing it performs no
I/O. Its target is only Supabase project `hrmpzplffuhhvbtxxhnt` and its visible title prefix is
`[STERLING ACCEPTANCE — SYNTHETIC V1]`.

## Live schema constraint check

Read-only inspection of Continuum Preview on 2026-11-02 confirmed:

- `custom_new_jewelry` lifecycle stages are `discovery`, `design`, `cad`, `client_approval`,
  `production`, `quality_control`, `ready_for_delivery`, and `completed`.
- `cad_design` is not canonical. It is retained only as the `CAD / Design` presentation group.
- Job responsibility is one of `founder`, `hourglass`, `client`, `vendor`, or `unknown`.
- Job state is one of `open`, `snoozed`, `resolved`, or `cancelled`; fixture Jobs use supported
  kinds and the existing `continuum_write_project_job` writer.
- Exact-source suppression requires a `gmail` Candidate whose type/payload is
  `person_association`, exactly one matching `source_ref`, a 64-character lowercase email hash,
  and a positive Candidate `record_version`. Other Candidate types fail closed.
- Proposal rows begin at record version 1. The durable founder decision moves a successful
  approval to version 2, and successful execution moves it to version 3. A post-decision
  execution failure remains durable at version 2 with `execution_status = pending`.

No fixture value relies on a name match, a real Gmail identifier, or a real client row.

## Exact manifest

Every Person has role `client`, source `human-intake`, no email/phone/address, and an exact
display name of `[STERLING ACCEPTANCE — SYNTHETIC V1] <case id> Person`. Every Project has kind
`custom_new_jewelry`, visibility `internal-only`, source `human-intake`, and title
`[STERLING ACCEPTANCE — SYNTHETIC V1] <case id> Project`. Each listed relationship is the only
active `client-project` binding for that Project and is oriented Person → Project.

| Case | Exact identities and starting state | Founder action | Exact expected canonical and audit result |
| --- | --- | --- | --- |
| CAD/Design waiting on vendor | Person `fa110001-0000-4000-8000-000000000001`; Project `fa120001-0000-4000-8000-000000000001`; relationship `fa130001-0000-4000-8000-000000000001`; lifecycle `discovery` at `2026-11-02T14:01:00.000Z`; Job `fa140001-0000-4000-8000-000000000001` open/waiting `hourglass` at `14:02Z` | Reject control proposal `fa160001-0000-4000-8000-000000000002`, then approve `fa160001-0000-4000-8000-000000000001` | Rejection becomes proposal v2 with no canonical/history change. Approval becomes v3; lifecycle is `design` (presented under CAD / Design), Job waits on `vendor`; one lifecycle event and one Job mutation use the two exact operation IDs. |
| In Production | Person `fa110002-0000-4000-8000-000000000001`; Project `fa120002-0000-4000-8000-000000000001`; relationship `fa130002-0000-4000-8000-000000000001`; lifecycle `cad` at `14:11Z` | Approve proposal `fa160002-0000-4000-8000-000000000001` | Proposal v3; lifecycle `production`; exactly one lifecycle event for operation `fa170002-0000-4000-8000-000000000001`. |
| Completed/resolved | Person `fa110003-0000-4000-8000-000000000001`; Project `fa120003-0000-4000-8000-000000000001`; relationship `fa130003-0000-4000-8000-000000000001`; lifecycle `production` at `14:21Z`; Job `fa140003-0000-4000-8000-000000000001` open/waiting `hourglass` at `14:22Z` | Approve proposal `fa160003-0000-4000-8000-000000000001` | Proposal v3; lifecycle `completed`; Job `resolved`, `resolved_at = executedAt`; one lifecycle event and one Job mutation; both operations share one atomic receipt. |
| Cancelled/superseded | Person `fa110004-0000-4000-8000-000000000001`; Project `fa120004-0000-4000-8000-000000000001`; relationship `fa130004-0000-4000-8000-000000000001`; lifecycle `design`; Job `fa140004-0000-4000-8000-000000000001` open/waiting `client` at `14:32Z` | Approve proposal `fa160004-0000-4000-8000-000000000001` | Proposal v3; exact Job is `cancelled`, `cancelled_at = executedAt`; lifecycle is unchanged; exactly one Job mutation preserves the superseded obligation history. |
| Exact-source suppression | Candidate `b666af76a33fa67cd10e31c3589b63a940ca9cdb7460e826656b91bb61634464`; source `fixture-gmail://sterling-founder-acceptance/v1/case-05/message-0001`; email hash `9e9ea8d8ae454184165124b0089fffc014462f1508bbbd45cbcf8d305661ac89`; initial v1/active/pending | Approve suppression `fa160005-0000-4000-8000-000000000001`, verify refresh, then approve compensating restore `fa160005-0000-4000-8000-000000000002` | Suppression produces Candidate v2/discarded and one insert-only event. Restore is bound to the first proposal, produces Candidate v3 with the original review state/target, and appends a second event. No Person is fabricated. |
| Ambiguous identity | Project `fa120006-0000-4000-8000-000000000001` is linked only to Person `fa110006-0000-4000-8000-000000000001`; Person `fa110006-0000-4000-8000-000000000002` is deliberately unlinked | Attempt to prepare reserved proposal `fa160006-0000-4000-8000-000000000001` for the unlinked Person | Adapter returns `cross-client-collision` before ledger insertion. The reserved proposal and operation IDs remain absent; no founder Approve control is rendered and no canonical/history row changes. |
| Stale approval | Person `fa110007-0000-4000-8000-000000000001`; Project `fa120007-0000-4000-8000-000000000001`; Job `fa140007-0000-4000-8000-000000000001`; proposal expects Job `updated_at = 15:02Z`; fixture-only writer mutation `fa150007-0000-4000-8000-000000000002` advances it to `15:03Z` | Approve proposal `fa160007-0000-4000-8000-000000000001` | Founder decision is durable at proposal v2/pending; execution reports `stale-job-version`; no proposal operation, Job, lifecycle, or operation-history write occurs. The UI explicitly reports durable approval with pending execution rather than a generic rejection. |
| Duplicate replay | Person `fa110008-0000-4000-8000-000000000001`; Project `fa120008-0000-4000-8000-000000000001`; lifecycle `cad` at `15:11Z` | Approve `fa160008-0000-4000-8000-000000000001`, then submit the exact same decision/payload again | First call produces proposal v3, lifecycle `production`, one lifecycle event and one receipt. Exact replay returns `already-present`; proposal version, receipt, lifecycle event count, and state are unchanged. A different decision/payload returns `approval-idempotency-conflict`. |

All proposal evidence uses reserved `fixture://sterling-founder-acceptance/v1/...` references. The
suppression source uses `fixture-gmail://...`; it is deliberately not a Gmail thread/message ID and
contains no correspondence. Proposal metadata must say `synthetic fixture — no model inference`.

## Idempotent creation procedure (requires separate authorization)

1. Reconfirm the target project ref, Preview runtime, publisher flag OFF, migration receipts, and
   exact manifest source hash.
2. Compute server-side before fingerprints for existing, non-manifest rows in entities, people,
   projects, relationships, lifecycle states/events, Jobs/mutations, Candidates/suppression events,
   and proposals. Each fingerprint is `(row count, SHA-256 of ordered primary identity plus record
   version/updated_at/state fields)` and excludes only the exact manifest ID set—not a name prefix.
3. Require every manifest ID to be absent. If all expected manifest rows already exist, accept only
   an exact manifest fingerprint and return `already-present`. A partial fixture or any differing
   field fails closed; it is never patched in place.
4. In one fixture-creation transaction, insert exact synthetic entity/profile/relationship/lifecycle
   rows and create Jobs through `continuum_write_project_job` using the reserved creation mutation
   IDs. Insert the standalone Candidate with record version 1 and the exact synthetic source/hash.
5. Create proposals through `SupabaseSterlingCanonicalApprovalRepository.create`; do not insert
   approved payloads or founder decisions. Prepare the ambiguous case only through the adapter and
   require failure before repository creation.
6. After the stale proposal is durable, perform its single authorized synthetic Job version bump
   through the existing Job writer and verify the exact new timestamp/mutation ID.
7. Recompute non-manifest fingerprints. They must exactly match step 2. Then compute a separate
   manifest fingerprint for founder review.

The future fixture command must require an explicit manifest hash and a one-use authorization value;
there is intentionally no runnable shared-Preview writer in this preflight commit.

## Cleanup and audit integrity

Executed proposal receipts, lifecycle events, Job mutations, and suppression events are durable audit
history. Deleting them would either violate restrictive foreign keys/least-privilege ACLs or destroy
the evidence this acceptance is intended to prove. Therefore a broad or cascading cleanup is not
safe and is not proposed.

The independently reviewable cleanup is compensating and manifest-exact:

1. Restore the Candidate only through the founder-approved compensation proposal already reserved in
   case 05; never delete suppression events.
2. Verify no manifest Project/Job remains actionable. Any still-open synthetic Job must be resolved or
   cancelled only through a separately reviewed canonical proposal with new reserved IDs.
3. End only the exact manifest relationship IDs if a reviewed relationship writer is available. Do
   not direct-update or invent a cleanup writer.
4. Retain internal-only synthetic profiles, terminal canonical rows, proposals, receipts, and audit
   history. Verify them by exact ID and label them as retained acceptance evidence.
5. Recompute the non-manifest fingerprints; every value must equal the pre-fixture fingerprint.

If permanent, clearly isolated audit rows are unacceptable in shared Preview, founder-personal
acceptance must use a dedicated isolated acceptance database instead. It is not safe to promise
physical deletion after completed transactional history exists.

## Founder approval security verification

- The Server Action rechecks a verified Preview runtime and the durable internal founder session on
  every request; rendering the page is not authorization.
- Browser input is limited to proposal ID, expected ledger version, action, and note. Plain approval
  reloads the original proposal payload server-side and ignores any browser replacement payload.
- Database RPCs enforce the proposal and canonical record versions, exact client/Project/Job binding,
  immutable approved payload, atomic mutation, and idempotency.
- Page load and proposal navigation are read-only. No mutation runs from render or `useEffect`.
- Exact executed replay returns the existing receipt; conflicting replay is visibly rejected.
- Receipts and decisions are read from the durable ledger after refresh.
- When decision recording succeeds but execution fails, the repository returns
  `approvalRecorded: true`; the UI reports `approved-pending-execution` and leaves the v2 approved
  decision visible without claiming success or losing it.

## Founder acceptance sequence

1. Sign in through the existing Preview founder session and confirm the publisher remains OFF.
2. Compare each exact Person/Project/Job/Candidate ID, current state, expected version, evidence handle,
   and proposed state in the review screen.
3. Reject case 01's control proposal; refresh; verify proposal v2 and unchanged canonical/history
   fingerprints.
4. Approve cases 01–05 and 08 in order. After each, compare canonical state, event/mutation count, and
   receipt, then refresh and confirm persistence. For case 05, approve restore only after suppression
   persistence is observed.
5. Verify case 06 never reaches the durable ledger and cannot be approved.
6. Approve case 07 and require the explicit durable-approved/pending-execution stale failure with no
   proposal-operation history.
7. Replay case 08 exactly and require `already-present`; then attempt the controlled conflicting replay
   and require visible rejection with unchanged fingerprints.
8. Capture final manifest and non-manifest fingerprints. Automated fixture tests do not substitute for
   this founder review.

## Deferred gates

Keep `CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED` off. There is still no durable Sterling Today
publication proving the actual Today read path. Live Gmail semantic acceptance also remains separate;
these synthetic source handles are not live-provider evidence.
