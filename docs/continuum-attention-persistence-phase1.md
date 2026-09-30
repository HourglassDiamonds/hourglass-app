# Continuum attention persistence — Phase 1

This branch adds persistence contracts for `action`, `reminder`, and `watching` Jobs. It does not enable Reminder/Watching creation, change Today presentation, wire Quick Capture, or deploy schema.

## Deployment order (mandatory)

1. Deploy and verify `20260929113152_projectless_founder_work.sql`. Both Job/history `project_id` columns must be nullable, mutation `operation` must exist, and `continuum_write_project_job` must exist.
2. Deploy and verify `20260930010000_attention_persistence.sql`.
3. Deploy attention-aware readers and writers.
4. Complete and deploy the Today/Capture Phase 2 presentation and capture paths.
5. Only then replace the Phase 1 fail-closed creation capability with verified deployment readiness.

The attention migration checks step 1 and aborts if it is missing. Do not replay historical `UNAPPLIED` scripts. Apply reviewed migrations explicitly in order.

## Contract boundaries

`kind` remains what work is. `state` remains lifecycle. `waitingOnActor` remains dependency ownership. `dueAt` remains a real deadline. `deferredUntil` remains a founder snooze override. Attention mode and its instants control only when attention becomes eligible.

Metadata is a closed, versioned, 8 KiB-bounded interpretation record. It stores timing provenance, exact optional identity references, and at most eight bounded assumptions. It never stores message bodies or an event log.

Time passage is evaluated at read time with an injected clock and causes no database write. Missing evidence on a Watch yields “Check whether…”, never an assertion that a party has not replied. A precise target may be retired only by authoritative matching satisfaction or supersession; it is never silently rebound to a newer revision.
