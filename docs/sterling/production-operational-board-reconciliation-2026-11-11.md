# Production operational-board reconciliation — 2026-11-11

This is a read-only audit and proposed-change packet. It does not authorize Gmail retrieval, proposal approval, canonical mutation, Today recomputation, or snapshot publication.

## Snapshot diagnosis

Production contains one `founder_today_v1` snapshot. It is not absent: it is a `continuum-today-read-model-v9` row composed at `2026-11-09T15:17:18.959Z` and updated at `2026-11-09T15:18:28.931Z`. The accepted reader requires exact `continuum-today-read-model-v11` compatibility, so rejecting the row is correct. The read-only staging message currently collapses this distinction to “no compatible snapshot.”

The row is also stale. Its source watermark predates the current Candidate, Gmail-message, and attachment indexes, and v9 lacks the v11 project-evidence-association watermark. It must not be coerced into v11 or republished without recomposition from current sources.

The rejected v9 projection contains three active rows and fifteen watching rows. Material discrepancies include:

- Natalie/C027055 is a founder action without a resolved canonical identity.
- Zane appears twice with conflicting ownership and no bound Project in either row.
- Nate P. is still projected as CAD rather than the founder-confirmed production stage.
- J. Pennock, Dylan, F. Grant, Tim/Jenn, Duane, and Madi remain visible despite founder-confirmed completion or decline.
- Morgan, James's returning commission, Rachel's current incoming thread, and the exact Nivoda return are absent.

## Current operating path and stop point

1. Recurring Gmail ingestion enters through `app/api/cron/continuum-gmail-freshness/route.ts`; a founder-triggered bounded chunk enters through the Sterling readiness Server Action.
2. Indexed Gmail metadata and interpreted Candidates are assembled by `assembleSterlingTodayShadow()` and `buildSterlingTodayWorkingSet()`.
3. Exact source/Project associations, founder directives, canonical lifecycle/Jobs, and correspondence are passed to Sterling semantic interpretation.
4. Founder-reviewed canonical proposals are approved through the canonical approval repository and the transactional database executor.
5. `refreshTodayAfterFounderMutation()` invokes the canonical Today loader, which can rebuild, reconcile conditional holds, and persist a new snapshot.
6. Pre-model suppression, founder-authority application, terminal lifecycle/Job state, and final projection prevent superseded work from returning.

Production currently stops before a trustworthy board can be published:

- Gmail indexes continue to advance, but `continuum_project_evidence_associations` has zero durable bindings.
- The only persisted snapshot is v9 and predates current evidence; the v11 reader correctly excludes it.
- Manual Gmail refresh, Today recomputation, Sterling semantic execution, and Sterling publication remain separately disabled in the accepted staged source.
- The code for proposal review, atomic application, recomposition, and suppression exists. The blocker is current evidence binding plus explicit operational authorization, not a missing mutation engine.
- Running the current shadow assembler would invoke live Gmail retrieval by default. That was not done in this read-only, no-Gmail-call audit.

## Identity-bound obligation audit

“Founder decision” below means the accepted October 30 correction unless a newer dated item is called out. Indexed Gmail evidence is metadata or Candidate-derived text; it is not represented as a freshly retrieved message body.

| Work | Verified state and evidence | Canonical state | Gap and proposed reviewable action | Ball holder / completion | Conflict or stop condition |
| --- | --- | --- | --- | --- | --- |
| Morgan Jines | Person `9ff1ea75-4d5b-44d0-b2a0-c39ec15b54fd`; Project `6c47edeb-33f8-4aa7-bb38-53bbe023fcc3`. Vendor thread `1a1c7b0bd23738ca` received Nov 10; client thread `1a15fb0c9b520621`; payment receipt Nov 7. Founder decision: CAD/Design, waiting on shop. | `discovery`; open generic clarification Job `a92280a3-4041-4072-af8e-79e068ca2a0e`, waiting unknown. | Review exact thread bindings; propose lifecycle `discovery -> cad`; resolve/supersede the generic Job; create or update one vendor/shop obligation only if current message content confirms it. | Vendor/shop; complete on reviewed vendor deliverable or a newer founder decision. | Nov 6 Candidate says “check back with both of the morganites Monday”; determine whether this is a distinct founder follow-up before removing it. |
| Zane Kennedy | Person `0a405703-0f30-4b1e-9a7a-4d0e001fb101`; Project `12359010-1e95-4296-aa44-a7de7e70aa11`. Exact scope threads `1a1212396a8ac111`, `1a13660ae3fdb7ac`, `1a13cc2c1f3d5951`; latest identified CAD/order C026732 Oct 28; payment receipt Oct 27. Founder decision: In Production. | `discovery`; open generic clarification Job `e8e8c50e-c010-4c09-b6dc-5926ecc98a8b`, waiting unknown. | Bind reviewed sources; propose `discovery -> production`; resolve the generic Job. Do not create a replacement Job without a current obligation. | Vendor/shop/watch; complete on production completion or newer evidence. | v9 shows two Zane rows, one client-owned and one shop-owned; both are unbound projections and must collapse to one Project. |
| J. Pennock | Person `a3a83570-3d3f-498f-bee4-3000fcde23b9`; Project `273b9a50-a51a-4379-b656-835b3c96cbeb`; thread `19fd370bc47c5e1f`; payment receipt Oct 21. Founder decision: delivered/completed, distinct from JP. | `production`; no open Jobs. | Review exact identity, then propose lifecycle `production -> completed`. Preserve the separate unresolved JP identity. | None after approval; complete when the lifecycle event and receipt agree. | Mixed Tim/Jenn context in surrounding evidence requires exact source selection; never merge with JP. |
| Natalie / Jewelers Mutual | Claim thread `1a1c73a560b06ed3` received Nov 10 and founder replied Nov 11. C027055 thread `1a1a324788df8460` has inbound and outbound Nov 11. | No exact Person/Project identity resolved. | Create an identity/relationship review proposal only. Keep the work ambiguous until the claim, client, and C027055 relationship is positively bound. | Unknown pending source review. | The v9 founder-action row is a false `YOUR MOVE` until identity and the unsatisfied obligation are proven. No Candidate excerpt supplies content. |
| Sarah Leishman | Person `ec712796-90cf-48ce-bba9-bf943a934109`; Project `18e9ef2b-5b22-453e-8be8-e54dab0d86b1`; C026143 vendor threads `1a0881b53067a9e6` and `1a1c7b0f7f034115`, the latter indexed Nov 10 with RN08577. Founder decision: CAD/Design. | `cad`; prior founder Job `f97d6437-3650-470a-9a3e-7a4f96a90001` resolved. | Retain CAD. Review the newest exact message before deciding whether there is a founder review action or a shop wait. Do not resurrect the resolved September Job. | Ambiguous until the Nov 10 content is reviewed. | The accepted semantic contract expected MOD 9 and founder review; metadata alone cannot establish whether newer correspondence superseded that duty. |
| Hyrum | No Person, Project, Candidate, note, or indexed subject match found, including fuzzy identity search. | None resolved. | No proposal. Record as missing evidence for founder identification rather than guessing. | Unknown. | Founder must provide an exact email/thread, Project, or other durable identifier. |
| Jackie | Exact accepted thread `1a1474ed83440aa0`, 11 messages through Oct 29; latest indexed direction is outbound “Re: HGD - Checking in.” | No exact Person/Project resolved. | Preserve the fulfilled label commitment as history; do not create a founder-open label action. Submit identity review only if continued work is intended. | None for the satisfied label obligation. | Older 2025 Jackie/C017823 threads are separate until positively linked. |
| Nivoda | Vendor-return threads `1a1358382fec2179`, `1a14fbe75312902e`, and `1a1401d44710a95b`; exact identifiers LG819625099, request 413451, return NIV-2609-13392551-2; last indexed update Oct 22. | Vendor contact; no client Project identity required. | Keep one exact-source return work unit. Review whether return/credit/receipt is complete; close only the satisfied leg. Suppress generic invoice/footer Candidates. | Vendor/shop unless a specific founder shipping action remains; completion requires exact return or credit evidence. | Current indexed metadata cannot prove final receipt/credit. Generic “please do not hesitate” Candidates are not obligations. |
| James Bowron | Person `3c845863-81c3-4391-9346-1dd18091c0af`; returning-client thread `192ba533c7869445` through Nov 6; Candidate evidence describes a new commission/design and client payment commitment; invoice 1243 receipt Nov 6. | No exact Project resolved. | Propose `associate_existing_person` for founder review, then create a Project/Job only after the returning identity and current commission are positively bound. | Client if payment is still outstanding; otherwise next owner derives from the newest reviewed message. | Payment receipt may supersede the Candidate commitment. Do not carry the older “I’ll get that paid” action forward without reconciliation. |
| Rachel | Current C027143 thread `1a1c7447c4492182`; founder outbound Nov 11 20:37 UTC and newer inbound Nov 11 22:14 UTC. | Rachel Knox exists, but an older note warns that surname matching was uncertain; no exact Project binding. | Treat as a new incoming obligation requiring identity and message-content review. Do not attach by first name. | Potentially founder, but unverified until current content is reviewed. | No Candidate excerpt is available. |
| Nate P. | Exact C026176/RN08419 threads `1a09120d797337d9`, `1a121c53e4587a98`, and `1a1a6cc69999c55b`, with indexed vendor activity through Nov 4. Founder decision: In Production. | A Project appears in v9 as `41281e54-0639-4183-82d5-17028b313681`, but no exact Person/Project identity was independently resolved in the canonical name audit; `Nate Bryan` is not sufficient. | Review the Project and source binding; then propose lifecycle `cad -> production` if the exact identity matches. | Vendor/shop/watch after transition. | No name-only association. The v9 CAD row is stale, but mutation must wait for positive binding. |

## Shadow-board comparison

The only persisted board is the rejected v9 snapshot; no v11 semantic run was executed because the current assembler performs live Gmail retrieval. Comparing v9 to the manual audit yields:

- **Missed material obligations:** Morgan; James's current commission/identity review; Rachel's Nov 11 incoming turn; the exact Nivoda return review. Hyrum is an evidence gap, not a board obligation.
- **False `YOUR MOVE`:** Natalie/C027055 is presented as founder-owned without an exact canonical identity or verified unsatisfied duty. Sarah is not classified as false yet; the Nov 10 content must be reviewed.
- **Incorrect ownership/state:** Zane is duplicated with conflicting client/shop ownership and stale lifecycle; Nate remains CAD despite the founder production decision.
- **Unresolved stale work:** generic clarification Jobs for Morgan and Zane; v9 rows for J. Pennock, Dylan, F. Grant, Tim/Jenn, Duane, and Madi. Each historical record remains preserved; only its active-board projection should retire after the corresponding canonical/founder authority is applied.
- **Correctly absent or fail-closed:** Jackie label follow-up is not re-opened; Hyrum remains unresolved; JP remains distinct from J. Pennock.

`operational-board-comparison.ts` is an acceptance comparator, not a reasoning engine. It requires exact work-unit identity and source references, compares an existing shadow result with a founder-reviewed audit, and reports missed material work, false founder alerts, ownership/lifecycle conflicts, stale open Jobs, terminal actions that reappear, and duplicate work units. It is deterministic and performs no reads or writes.

## Smallest next acceptance step

Authorize one bounded, founder-attended **read-only evidence review and v11 shadow recomposition** against Production indexes: enable no publisher and no canonical mutation; retrieve only the explicitly listed thread IDs under the existing founder/manual Gmail control; write only resumable Gmail indexing/checkpoint data already authorized for that bounded refresh; require founder review of every proposed source association; then run Sterling v6 in shadow mode and compare it with this audit using the checked-in comparator. Publication, proposal approval, and all client/Project/Job mutations remain separate gates.
