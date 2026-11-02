# Sterling founder-controlled Preview acceptance

Status: plan only. No shared Preview fixture rows are authorized by this document.

## Synthetic fixture boundary

If separately approved, create one synthetic namespace whose visible titles begin with
`[STERLING ACCEPTANCE — DELETE AFTER REVIEW]`. Generate new UUIDs at execution time and
record every created identifier in a cleanup manifest. Do not reuse a real Person, Project,
Job, Candidate, Gmail source reference, invoice, payment, or correspondence row.

The proposed fixture set is:

| Case | Synthetic canonical starting state | Transactional proposal | Founder-visible result |
| --- | --- | --- | --- |
| CAD/Design waiting on vendor | Synthetic client + Custom project + open synthetic Job | lifecycle → `cad_design`; Job waiting-on → `vendor` | Stage and responsibility remain independent |
| In Production | Synthetic client + Custom project in CAD/Design | lifecycle → `production` | One lifecycle event and matching receipt |
| Completed/resolved | Synthetic client + active project + open obligation | lifecycle → `completed`; resolve exact Job | Atomic completion and resolution |
| Cancelled/superseded | Synthetic client + open synthetic Job | cancel exact Job | History retained; obligation no longer active |
| Exact-source suppression | Synthetic Gmail Candidate with a non-real reserved source ref and deterministic synthetic email hash | suppress exact Candidate/source/hash | Insert-only suppression history |
| Ambiguous identity | Two synthetic clients with no exact target binding | intentionally invalid proposal | No reviewable proposal and no mutation |
| Stale approval | Valid synthetic proposal followed by an authorized fixture-only version bump | approve old record version | Visible stale-version failure; no partial write |
| Duplicate replay | Exact successful approval request repeated | same proposal, decision, and server payload | `already-present`; no duplicate history |

Before fixture creation, capture zero/expected counts for the manifest IDs. After founder
review, verify receipts and history, then remove only manifest-owned synthetic records using
a separately reviewed cleanup transaction. Fixture cleanup must never match by title prefix
alone.

## Founder acceptance sequence

1. Sign in through the existing durable Preview founder session.
2. Open the exact proposal and compare client, Project, Job, versions, evidence handles,
   current state, and proposed state.
3. Reject one proposal and verify canonical state and history counts are unchanged.
4. Approve each authorized positive case and compare canonical state with its execution receipt.
5. Refresh the page and verify the durable result remains visible.
6. Replay the exact approval and require `already-present` with unchanged history counts.
7. Submit stale and conflicting requests and require visible safe failures.

Fixture automation and application tests do not substitute for this founder review.

## Today publisher read gate (separate authorization)

Keep `CONTINUUM_STERLING_TODAY_PUBLISHER_ENABLED` off. A later Preview-only gate should:

1. create a validated durable publication from authorized synthetic inputs;
2. read the active publication through the existing publisher repository;
3. project each work unit exactly once, with only founder-owned actions in Up Next;
4. retain the legacy Today model as the immediate fallback when the flag is off, the
   publication is absent/expired, or validation is not accepted;
5. verify refresh, supersession, revocation, and rollback without canonical data deletion.

No current durable publication and no database installation alone proves this display path.
Live Gmail semantic acceptance remains a separate provider gate.
