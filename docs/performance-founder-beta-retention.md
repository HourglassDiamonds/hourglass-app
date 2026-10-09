# Performance founder-beta data retention

Scope: founder-submitted Performance meal/activity text, images, interpretations, corrections, and accepted entries only.

## Policy

- Original meal, nutrition-label, and activity images receive a 90-day expiration timestamp when accepted.
- The founder can delete a source image earlier from the accepted entry. Deleting the source does not delete the approved structured entry.
- Approved structured meal/activity entries remain in canonical Performance state until an explicit structured-entry deletion workflow is invoked.
- The immutable audit ledger retains only mutation identity, entry identity, source type, time, idempotency key, and a SHA-256 integrity hash.
- Raw text, full proposals, accepted-value snapshots, and correction values live in the separate evidence table with a 90-day minimization timestamp.
- Source paths remain private server metadata. The app never creates public or signed URLs.

## Deletion integrity

User-requested source deletion:

1. authenticates the founder session;
2. verifies that the requested entry belongs to the founder state;
3. verifies the object path is inside the founder's hashed storage prefix;
4. removes the object through the Storage API;
5. atomically clears the canonical source reference, records a `delete_source` audit event, and marks matching evidence deleted using expected-revision protection.

If the atomic state update conflicts after object removal, the response is `409` and the client refreshes canonical state. The private object is already gone, so the failure cannot create an exposed or orphaned file.

## Scheduled cleanup status

No destructive scheduler is enabled in founder-beta. Expiration timestamps are recorded now, but automatic 90-day deletion must remain disabled until a staging reconciler has demonstrated all of the following:

- it removes objects through the Storage API, never by deleting `storage.objects` rows;
- it clears canonical source references with expected-revision protection;
- it marks evidence deletion without mutating the immutable audit ledger;
- retries are idempotent;
- failures are reported for manual reconciliation.

Sensitive evidence minimization must similarly be verified in staging before scheduling. The immutable audit hash can remain after sensitive values are nulled.

## Operational deletion

Deleting an approved structured entry is intentionally separate from deleting its source evidence. It requires an explicit founder action and must first delete any attached source through the workflow above. No cascade or timed job deletes approved structured entries.
