# Phase 2 — Today current truth

Worktree: ../hourglass-app-today-current-truth  
Branch: continuum/today-current-truth  
Base: e7c793e07da0e07c63c18058ae54ea5be682a01d  
No commit, push, deployment, schema change, model-default change, voice work, or durable reminders/Watching persistence.

## 1. Files changed

- app/executive-dashboard/concierge/ask-actions.ts
- app/executive-dashboard/concierge/components/ask-concierge-shell.tsx
- app/executive-dashboard/concierge/components/gmail-operating-freshness.tsx
- app/executive-dashboard/concierge/cos-operating-loop-actions.ts
- app/executive-dashboard/concierge/today-read-model-actions.ts
- lib/continuum/chief-of-staff/operating-loop/briefing-copy.ts
- lib/continuum/chief-of-staff/operating-loop/briefing-packet.ts
- lib/continuum/chief-of-staff/operating-loop/briefing-synthesis.ts
- lib/continuum/chief-of-staff/operating-loop/collect.ts
- lib/continuum/chief-of-staff/operating-loop/compose.ts
- lib/continuum/chief-of-staff/operating-loop/cos-briefing-v1.ts
- lib/continuum/chief-of-staff/operating-loop/disposition.test.ts
- lib/continuum/chief-of-staff/operating-loop/docket.test.ts
- lib/continuum/chief-of-staff/operating-loop/load.ts
- lib/continuum/chief-of-staff/operating-loop/moderator.ts
- lib/continuum/chief-of-staff/operating-loop/today-docket-boundary.ts
- lib/continuum/chief-of-staff/operating-loop/today-snapshot-store.test.ts
- lib/continuum/chief-of-staff/operating-loop/types.ts
- lib/continuum/chief-of-staff/operating-loop/work-loop-state.ts
- lib/continuum/chief-of-staff/operating-loop/current-truth-adversarial.test.ts
- lib/continuum/chief-of-staff/operating-loop/today-recompute-clock.test.ts
- lib/continuum/chief-of-staff/operating-loop/today-recompute-clock.ts
- lib/continuum/concierge-sol/types.ts
- lib/continuum/source-events/classify.ts
- lib/continuum/source-events/gmail.ts
- lib/continuum/source-events/types.ts
- lib/continuum/source-events/operational-facts.ts
- lib/continuum/gmail/source-viewer-run.ts
- lib/continuum/gmail/source-viewer.test.ts
- lib/continuum/gmail/source-viewer.ts
- lib/continuum/gmail/today-thread-context.test.ts
- lib/continuum/gmail/today-thread-context.ts
- lib/continuum/today-snapshot-store.ts
- lib/continuum/today-snapshot.ts
- lib/continuum/today-source-watermark.ts
- lib/continuum/chief-of-staff/operating-loop/current-work.test.ts
- lib/continuum/chief-of-staff/operating-loop/current-work.ts
- lib/continuum/chief-of-staff/operating-loop/founder-corrections-load.test.ts
- lib/continuum/chief-of-staff/operating-loop/founder-corrections-load.ts
- lib/continuum/concierge-sol/founder-command-server.ts
- lib/continuum/concierge-sol/founder-command.test.ts
- lib/continuum/concierge-sol/founder-command.ts

This report is also new. Temporary validation files are not part of the implementation.

## 2. Authoritative projection

The source-event branch of reduceWorkLoop produces CurrentWorkProjection. It contains workstreamId, stage, dependency, ballHolder, activeObligations, historicalObligations, commitment, controllingSourceRefs, asOf, and provenance. Obligations retain their opening source, closing source, revision, actor, and active/satisfied/superseded status. Provenance records timestamp, original wording, source origin, whether the event applied, and the reason.

The projection travels with the briefing packet and survives final merging. The existing generic client/founder exchange reducer remains responsible for its established fulfillment rules and contributes its result to the projection; jewelry stage events use the explicit source transition rules.

## 3. Stage model

queued → design_requested / revision_requested → cad_review → approved → order_confirmed → in_production → ready → complete. waiting_external represents a concrete external blocker such as final CAD or pearl delivery. These are evidence-driven transitions, not a mandatory linear sequence.

Stage and actor are separate. Production can coexist with an active founder confirmation-discrepancy review. Confirmation alone never establishes production. Workshop receipt alone preserves the final-CAD dependency.

## 4. Supersession

Events use timestamp and stable source identity; deduplication and intermediate/final merging share deterministic ordering. Unknown timestamps do not establish newer truth. Multiple conflicting undated events remain unresolved. Phase 1 admission and quoted-history/acknowledgment protections remain in place.

Matching CAD/STL delivery satisfies the corresponding request and creates review. Identified wrong revisions, missing revision evidence for a revision-specific request, wrong CAD identifiers, and partial mismatched file types cannot close that request. Later revision requests replace the review cycle; approval and confirmation retire obsolete pre-order work. Production retires ordinary pre-production actions while retaining explicit confirmation-discrepancy review. Changed blockers replace earlier blockers. Delivery clears its promise. Terminal evidence closes prior obligations; old files do not reopen them. Explicit later service/new work or an explicit founder correction can reopen/correct terminal truth.

## 5. Dependency and responsibility

Dependencies retain operational meaning: revised/final CAD, CAD/STL review, pearl/stone delivery, client reply/finger size, order confirmation review, vendor production, or founder action. Actors are founder, client, vendor_shop, or unknown. Unknown external ownership is not assigned to the founder. Explicit shop or founder reply wording takes precedence over a generic mention of a reply.

## 6. Commitment normalization

NormalizedCommitment records deliverable, actor, source timestamp, original wording, date/window, precision, assumptions, and source reference. Tomorrow is relative to the source message in America/New_York. Business-day calculations use Monday–Friday; supplied wording can yield a numeric range. ISO and numeric month/day dates are supported. An omitted year uses the source year without automatic rollover. Missing/ambiguous anchors remain unresolved.

Approximately / +/- / should remain approximate. Ten +/- business days gets a nominal date and approximate precision; no unsupported numeric tolerance is invented. Delivery and replacement promises clear/supersede prior commitments. Existing advisory checkpoint presentation consumes these facts without creating durable reminders.

## 7. Presentation and merge

strongerSeed gives dated structured state priority over prose scoring. Recomposition unions source events and runs the reducer again. Structured terminal seeds survive long enough to suppress their stale predecessors. Projected packets use deterministic copy so generated prose cannot overwrite current stage or dependency.

Chips support YOUR MOVE, WAITING ON CLIENT, WAITING ON SHOP, IN PRODUCTION, READY, and WAITING. An active founder obligation takes display priority; the packet still retains production stage. Historical evidence remains inspectable without controlling the current action.

## 8. Queue consolidation

Final consolidation precedes visible-card selection and queued counting. All ranked canonical Jobs reach the final boundary, including those beyond the old top-five cutoff. Repeated source wrappers consolidate by supported identity. Exact project/CAD conflicts and distinct canonical Job IDs prevent merging independent work. A shared first name does not associate separate threads. Transitive merges also check conflicts.

Future-deferred unresolved Jobs are quiet even when their stored state is open. Matching source wrappers are also suppressed, without suppressing unrelated projectless work. The eight-independent-Job fixture yields three visible cards and five queued obligations.

## 9. Real-world fixture results

| Fixture | Result |
| --- | --- |
| A — Duane / C026350 / SP13530 | Confirmation remains order_confirmed; explicit production advances stage and suppresses obsolete CAD work. |
| B — Sarah, flooding/tomorrow | Revised CAD remains the dependency; source-anchored tomorrow is unchanged when the viewing date changes. |
| C — Tim/Jenn / RN08318 | Workshop receipt and final CAD survive; ten +/- business days retains approximate precision and source wording. |
| D — Nate, STL then pearl | Matching STL request is satisfied; pearl delivery becomes the single current blocker. |
| E — marketing | No operational projection/card is admitted. |
| F — repeated revisions | Latest review/request controls; old cycles close and a wrong revision cannot satisfy the latest request. |
| G — final merge | New production beats old founder-review prose, including separate old/new packet seeds and duplicate wrappers. |
| H — terminal | Prior work closes; stale files stay suppressed; explicit later service and explicit corrections are supported. |
| I — replay | Shuffling, duplicate wrappers, equal timestamps, and missing timestamps produce deterministic results. |

These are synthetic source fixtures exercising the reducer and final docket, not a claim that production mailbox records were modified or inspected live.

## 10. Astra adversarial checkpoint fixes

- Terminal and ready classification is clause-level and direct-negation aware. Quoted history remains excluded.
- Explicit resize, repair, service, or new-work language reopens delivered work while preserving its prior completion history.
- Obligations use stable source, thread, CAD/order/production, type, revision, and canonical Job identity. Project identity alone does not merge or supersede independent work.
- Snoozed, resolved, and cancelled Jobs suppress only the source obligation they identify. Other work on the Project remains eligible.
- Contradictory, corrective, uncertain, or multi-state founder commands return clarification and perform no authenticated writer load or canonical mutation.
- Structured current-work fields are authoritative. The only chronology exception is a client request independently proven historical by a later thread turn and a concrete waiting state.
- Each recomposition attempt captures a fresh logical clock shared by watermark and eligibility evaluation. Snapshots carry `validUntil`, and both warm and cold readers reject them at expiry.
- One bounded message can emit several source events. Operational clause selection prioritizes terminal, production, order, dependency, and commitment facts instead of retaining only the first six sentences.
- Commitment parsing preserves ambiguity, approximate markers, raw wording, source-date anchoring, ISO and numeric dates, and Monday–Friday business-day assumptions.
- Live Gmail enrichment creates one credential/access-token context per rebuild, coalesces duplicate exact-thread reads, caches extraction by stable message identity, uses bounded concurrency and a global deadline, and falls back to indexed/local evidence after failure.

## 11. Validation

- npm run test:continuum: **2,339 passed, 0 failed**, 413 suites.
- Focused TypeScript: **passed** for changed production modules and focused/new tests; repository-wide baseline diagnostics remain outside this change.
- ESLint: **passed** on all changed/new TypeScript and TSX files.
- git diff --check: **passed**.
- All fixture and command regressions described below are included in the full suite.

The full suite includes source events, current-action eligibility, docket boundaries, checkpoint/briefing, lifecycle suppression, association/evidence integrity, projectless work, and Quick Capture. The pre-change focused baseline was independently verified: 589/589 tests passed.

Repository-wide TypeScript has existing diagnostics. They were not repaired. The changed pre-existing snapshot-store test retains its existing incomplete-fixture cast diagnostic; focused production/new-test TypeScript excludes that known baseline fixture. No live Supabase mutation or authenticated browser end-to-end test was performed.

## 12. Ambiguities and limits

- Command interpretation deliberately uses a closed explicit grammar, not an unrestricted model write tool. Unsupported paraphrases remain conversation. Questions and recognized uncertainty/negation forms are rejected; this is not a general natural-language intent engine.
- A command must uniquely identify a project. Job commands additionally require a single unresolved Job. Multiple projects/Jobs require clarification; projectless command targeting is not added. Existing projectless UI/capture behavior remains intact.
- Current-card-context phrases such as “This is with the client” still require an explicit target. The optional context-targeting cleanup was not added because the present Ask action does not carry a single-card identity through the bounded command contract.
- A project with several unrelated deliverables still depends on supported upstream workstream association. The reducer refuses conflicting delivery identifiers; it does not invent links between unrelated orders.
- Missing source chronology, actor ambiguity, holidays, unnamed date tolerances, and unrecognized date wording remain unresolved or explicitly approximate.
- Foreground canonical polling detects expiry at the next check (about one minute) or page navigation/visibility change. It does not create background reminders.
- A canonical save followed by recomposition failure is reported as saved with a refresh failure, not as fully refreshed. The client still requests a reload. Changed source watermarks prevent reuse of the known stale snapshot.

## 13. Commit recommendation

**SAFE TO COMMIT for this scoped Phase 2 change: YES.** Required runtime regressions and scoped static checks pass. Existing repository-wide TypeScript diagnostics remain outside scope, and live authenticated rollout verification is still required before deployment. No commit has been created.

## 14. Before reminders / persisted Watching

Agree on holiday calendars, approximate-window semantics, and treatment of unresolved dates; give multi-deliverable and command clarification flows explicit identity semantics; then add idempotent durable scheduling keyed to source obligation/commitment identity with cancellation on delivery, correction, supersession, or snooze. Exercise the authenticated command-to-database-to-Today flow in a test deployment before rollout. None of that persistence is implemented here.

## Founder-command addendum audit

**Why acknowledgments did not act:** the normal Sol tool set has no write tools and returns writesCanonical: false. Today-card conversation was also routed to read-only briefing. Existing disposition actions could mutate Jobs, but route revalidation alone did not force an immediate canonical recomposition; changed-watermark navigation could serve last-known state. Open Jobs carrying a future deferral also needed consistent collection filtering.

**Real command path:** askConcierge recognizes an explicit typed proposal in conversation/Today context before read-only briefing. The authenticated server adapter loads canonical targets, validates uniqueness/action, and invokes existing ProjectJobWriter.mutateJob or ClientMemoryNoteWriter.addManualNote. Normal Sol conversation remains read-only. Capture mode is preserved. There is no raw SQL mutation or general model database-editing tool.

**Corrections:** versioned typed correction records are appended through the existing manual Source Note writer. Today loads kept, assigned, undeleted records with pagination, validates their shape against explicit wording, and converts them into founder_note events with timestamp/provenance. They enter the same reducer, supersede stale CAD truth, and may be superseded by later concrete evidence. Historical sources are not rewritten.

**Immediate snooze:** the canonical Job writer saves deferredUntil. The mutation path awaits Today recomposition and cache/snapshot publication, revalidates the route, and returns refreshToday so the client calls router.refresh. Existing disposition/complete actions use the same recomposition barrier. Note changes and elapsed deferrals participate in the canonical watermark. Canonical refresh detection remains independent of Gmail-check success.

**Ambiguity/failure:** two Ben projects or multiple unresolved Jobs produce clarification with no mutation. Writer failure reports failure without success wording. An authorized save followed by refresh failure is distinguished from a failed save.

**Addendum regressions:** founder production replaces stale CAD; client reply/finger size clears founder review without inventing a deadline; real in-memory canonical snooze suppresses visible/queued work while retaining stored history and restores eligibility at expiry; ambiguous targets and failed writers do not mutate/claim success; authenticated mutation and UI refresh wiring are checked. Loader tests cover pagination, deleted/unassigned notes, provenance, and read failures. Server/UI integration is structurally tested; live deployment validation remains a rollout follow-up.
