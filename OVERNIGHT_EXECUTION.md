# Continuum overnight execution manifest

Baseline commit (Phase 1B, accepted): `e29c383f6b201c7bee9d9d2ffeafbd7a0db676b7`  
Branch: `continuum/founder-operating-ux-v1`  
origin/main MUST remain: `65aea302ac845c592f5859dbd057ef3452d59573`

## Locked architectural rules

- Continuum is one canonical system.
- Founder destinations remain exactly: Today, Projects, Clients, Repairs, Concierge.
- Today remains one Chief of Staff queue. Do not redesign accepted Phase 1A/1B UX.
- UP NEXT: max 3; live client/work first; Master Sprint fills unused capacity only.
- Do not recreate Concierge Brief, Top 5, Recommended, or competing task queues.
- Person is identity. Client is a role. CandidateStore fail-closed.
- Generated Morning Brief / operating mail is never Open Email authority.
- NEVER merge to main, deploy production, commit `.env*`, `tmp/`, or localhost credentials.
- NEVER weaken auth/security. No production OAuth/credential changes.
- Prefer reuse of Gmail incremental + intake scan + CandidateStore + operating-loop compose.

## External blockers already known

- Google `users.watch` / Pub/Sub push is not scaffolded. Enabling it requires Cloud Pub/Sub, domain verification, and production OAuth/Cloud configuration. Do not invent credentials overnight.
- Durable cron does not take effect in production until a founder-approved deploy (this overnight sprint does not deploy).
- `CONTINUUM_GMAIL_INCREMENTAL_SYNC_ENABLED` remains the kill switch. Default off.

## Ordered work lanes

| Lane | Status | Checkpoint |
|------|--------|------------|
| 1 Near-real-time Gmail pipeline | DONE | `00eebd5` feat: add near-real-time gmail intake |
| 2 Email-driven Project / Action hydration | DONE | 08078f6 |
| 3 Retain supporting Gmail provenance | DONE | ffd2272 |
| 4 Historical Gmail reconstruction foundation | DONE | 5f5c414 |
| 5 Master Sprint → Today unused capacity | DONE | `1c62cac` feat: hydrate master sprint docket slots |
| 6 Operating QA / regression | DONE | `ca791b2` test: add founder operating overnight regression |

## Lane 1 — Near-real-time Gmail pipeline

Status: DONE

### What changed

Reuse existing incremental History API sync + new-project intake scan as one freshness cycle.

- Secret-protected durable poll every 2 minutes (`CRON_SECRET`, kill-switched).
- Silent founder-session refresh on Today (no new chrome, no Phase 1A/1B redesign).
- New mail is indexed, then candidates are ingested idempotently into CandidateStore.
- Operating loop continues to compose Today from canonical candidate/job state.
- Incremental UI remains founder-session / kill-switched and is not a public mailbox crawler.

### Files changed

- `lib/continuum/gmail/freshness-cycle.ts`
- `lib/continuum/gmail/freshness-cycle.test.ts`
- `lib/continuum/gmail/freshness-run.ts`
- `lib/continuum/gmail/index-freshness.ts`
- `lib/continuum/gmail/index-freshness.test.ts`
- `lib/continuum/gmail/indexed-thread-evidence.ts`
- `lib/continuum/gmail/indexed-thread-evidence.test.ts`
- `lib/continuum/gmail/intake-scan.ts`
- `lib/continuum/gmail/env.ts`
- `lib/continuum/gmail/security.test.ts`
- `app/api/cron/continuum-gmail-freshness/route.ts`
- `app/executive-dashboard/concierge/gmail-freshness-actions.ts`
- `app/executive-dashboard/concierge/components/gmail-operating-freshness.tsx`
- `app/executive-dashboard/concierge/page.tsx`
- `vercel.json`
- `OVERNIGHT_EXECUTION.md`

### Tests run

- Targeted Gmail freshness / intake / incremental / security tests: pass
- `npx eslint` on Lane 1 files: pass
- `npm run test:continuum`: 1658 pass, 0 fail
- `npm run build`: pass (includes `/api/cron/continuum-gmail-freshness`)

### Architectural decisions

- Reuse `runGmailIncrementalChunk` + `runGmailNewProjectIntakeScan`. No second ingest system.
- Auth remains founder session OR `CRON_SECRET` (`secretProtectedOk`). Same kill switch.
- Cron route stays thin and PII-free so existing Gmail security source contracts stay intact.
- After cursor initialization, the same cycle immediately drains History API (bounded to 3 chunks).
- Intake retries for 5 minutes after newest indexed activity so a failed body fetch is not stuck behind the 60s incremental skip window.
- Google push/watch deferred as an external OAuth/Cloud blocker.

### Blockers

- True seconds-level push requires Google watch/Pub/Sub + founder-approved Cloud/OAuth config.
- Production freshness requires: kill switch on, Gmail connected, candidate storage activated, and a deploy that registers the new Vercel cron.

### Next lane

Lane 3 — retain supporting Gmail provenance for generated Morning Brief items.

## Lane 2 — Email-driven Project / Action hydration

Status: DONE

### What changed

Extend existing Gmail candidate extractors so high-value client/vendor mail proposes review candidates instead of depending on manual Add Action.

- Explicit new design requests can propose a new Project candidate.
- CAD feedback, change requests, production questions, shop blockers, and delivery/payment issues become Open Job candidates.
- Known exact-thread Projects receive the attached action. Ambiguous identity stays unattached for Confirm Project.
- `createJob` remains false. No People/Projects/Open Jobs are minted automatically.

### Files changed

- `lib/continuum/gmail/candidates/parse.ts`
- `lib/continuum/gmail/candidates/propose.ts`
- `lib/continuum/gmail/candidates/new-project.ts`
- `lib/continuum/gmail/candidates/indexed-dry-run.ts`
- `lib/continuum/gmail/candidates.test.ts`
- `lib/continuum/gmail/candidates/new-project.test.ts`
- `OVERNIGHT_EXECUTION.md`

### Tests run

- Targeted Gmail candidate / new-project / intake / security tests: pass
- `npx eslint` on Lane 2 files: pass
- `npm run test:continuum`: 1662 pass, 0 fail
- `npm run build`: pass

### Architectural decisions

- Reuse CandidateStore + founder review. Do not auto-create jobs from extraction.
- Attach actions only when exactly one Project is identified.
- Weak repair/status/approval language still does not mint a new Project.

### Blockers

None.

### Next lane

Lane 4 — historical Gmail reconstruction foundation.

## Lane 3 — Retain supporting Gmail provenance

Status: DONE

### What changed

Generated Morning Brief candidates keep their Brief `sourceRef` as synthesized evidence and now retain observed real Gmail `supportingSourceRefs` from ingested threads that restate the same work.

- Open Email uses those real Gmail sourceRefs, never the Brief thread.
- Brief-only items still fail closed.
- Ambiguous restatements that match two different Projects stay unattached.
- Generated operating mail no longer supersedes real Gmail lineage.
- Supporting refs persist on `evidence_basis` JSON with no SQL migration.

### Files changed

- `lib/continuum/candidates/types.ts`
- `lib/continuum/candidates/rows.ts`
- `lib/continuum/candidates/store.ts`
- `lib/continuum/candidates/present.ts`
- `lib/continuum/candidates/durable.test.ts`
- `lib/continuum/gmail/candidates/supporting-source.ts`
- `lib/continuum/gmail/candidates/supporting-source.test.ts`
- `lib/continuum/gmail/candidates/ingest.ts`
- `lib/continuum/gmail/candidates/propose.ts`
- `lib/continuum/gmail/candidates/tag-stored-generated.ts`
- `lib/continuum/gmail/candidates/tag-stored-generated.test.ts`
- `lib/continuum/gmail/candidates.test.ts`
- `lib/continuum/chief-of-staff/operating-loop/evidence.ts`
- `lib/continuum/chief-of-staff/operating-loop/moderator.ts`
- `lib/continuum/chief-of-staff/operating-loop/open-email-live-regression.test.ts`
- `OVERNIGHT_EXECUTION.md`

### Tests run

- Targeted provenance / Open Email / ingest / durable tests: pass
- `npx eslint` on Lane 3 files: pass
- `npm run test:continuum`: 1670 pass, 0 fail
- `npm run build`: pass

### Architectural decisions

- Do not guess supporting threads. Copy only observed real Gmail `gc1` sourceRefs that share the same work fingerprint.
- Keep generated Brief `sourceRef` in place. Add supporting refs instead of replacing it.
- Read-time tagging backfills supporting refs for already-stored Brief candidates.
- JSON `evidence_basis` extension only. No schema migration.

### Blockers

None.

### Next lane

Lane 5 — Master Sprint → Today unused capacity.

## Lane 4 — Historical Gmail reconstruction foundation

Status: DONE

### What changed

Bounded, resumable reconstruction over already-indexed Gmail threads. Proves the framework on a sample of at most 50 messages per direction and 5 threads per chunk.

- Idempotent Candidate ingest. No People/Projects minted.
- Opaque `gr1` cursor. Safe interrupt/restart.
- Persists cursor on `gmail-historical.historyId` only after index backfill is completed. Does not add a SQL job key.
- No cron. No whole-mailbox migration. No public API.

### Files changed

- `lib/continuum/gmail/historical-reconstruction.ts`
- `lib/continuum/gmail/historical-reconstruction.test.ts`
- `lib/continuum/gmail/historical-reconstruction-run.ts`
- `lib/continuum/gmail/security.test.ts`
- `OVERNIGHT_EXECUTION.md`

### Tests run

- Targeted historical reconstruction / Gmail security tests: pass
- `npx eslint` on Lane 4 files: pass
- `npm run test:continuum`: 1677 pass, 0 fail
- `npm run build`: pass

### Architectural decisions

- Reuse indexed metadata + existing evidence fetch + CandidateStore. No second CRM.
- Sample is newest-N per direction, then oldest-thread-first within that sample. Full oldest-first mailbox walk needs a dedicated index query later.
- Do not store the cursor in `pageToken` (that would regress historical backfill completion).

### Blockers

- Whole-mailbox oldest-first reconstruction is not enabled overnight.
- No founder UI/action yet. Live runner exists (`historical-reconstruction-run.ts`) but is not wired to cron or Today chrome.
- Cursor persistence requires a completed `gmail-historical` index checkpoint.

### Next lane

Lane 5 — Master Sprint → Today unused capacity.

## Lane 5 — Master Sprint → Today unused capacity

Status: DONE

### What changed

Approved Master Sprint items now fill unused UP NEXT slots after live client/work. Client work always preempts. Extra sprint items stay off the queue and do not inflate `+N queued`.

- Empty live work uses founder copy: `Client work is clear. Continuing with the sprint.`
- Completing a sprint item persists through Agent OS recommendation lifecycle.
- The next eligible sprint item replenishes when a slot opens.
- No separate Sprint dashboard. No invented sprint work.

### Files changed

- `lib/continuum/chief-of-staff/operating-loop/types.ts`
- `lib/continuum/chief-of-staff/operating-loop/master-sprint.ts`
- `lib/continuum/chief-of-staff/operating-loop/master-sprint.test.ts`
- `lib/continuum/chief-of-staff/operating-loop/docket.ts`
- `lib/continuum/chief-of-staff/operating-loop/docket.test.ts`
- `lib/continuum/chief-of-staff/operating-loop/compose.ts`
- `lib/continuum/chief-of-staff/operating-loop/load.ts`
- `lib/continuum/chief-of-staff/operating-loop/founder-actions.ts`
- `lib/continuum/chief-of-staff/operating-loop/founder-actions.test.ts`
- `lib/continuum/chief-of-staff/operating-loop/disposition.ts`
- `lib/continuum/chief-of-staff/operating-loop/disposition.test.ts`
- `lib/continuum/chief-of-staff/operating-loop/security.test.ts`
- `app/executive-dashboard/concierge/cos-operating-loop-actions.ts`
- `OVERNIGHT_EXECUTION.md`

### Tests run

- Targeted docket / master-sprint / founder-actions / disposition / security tests: 35 pass, 0 fail
- `npx eslint` on Lane 5 files: pass
- `npm run test:continuum`: 1683 pass, 0 fail
- `npm run build`: pass (Next TypeScript included)

### Architectural decisions

- Canonical source remains `CURRENT_OPERATING_BACKLOG`. Adapter is `selectMasterSprintCapacityItems` using existing `founderFocusEligible`.
- Load hydrates terminal lifecycle from durable Agent OS persistence when live/durable; otherwise fail closed to the static backlog.
- Sprint completion writes only through `markRecommendationTerminal` (`operating-backlog:<itemId>`), not a second task store.
- Current static backlog has no active founder-now items, so production Today will not show sprint until something is promoted. Tests inject eligible items.
- Sprint Complete / Disregard only. No snooze path overnight.

### Blockers

- Sprint completion persistence requires configured live Agent OS durable persistence. Unconfigured production fails closed (`unsupported-mutation` / unavailable).
- No founder-now items currently on the static sprint, so unused-capacity fill is proven in tests and waits on promotion in production.

### Next lane

Lane 6 — operating QA / regression.

## Lane 6 — Operating QA / regression

Status: DONE

### What changed

Encoded the founder operating regression as a durable harness. No Phase 1A/1B UX redesign.

Verified by existing + new tests:

- Today: max 3 UP NEXT, rolling replenishment, wrapping actions, Confirm Person, snooze, complete/disregard, +N queued, Watching, Evidence, Open Project, Open Email fail-closed for generated Brief
- Projects / Clients / Repairs / Concierge destination wiring intact
- Mobile nav: exactly five `grid-cols-5` tabs, overflow-x-hidden, no sixth destination
- Master Sprint unused-capacity fill stays on the same Today queue

Live authenticated browser QA was not run: no founder session and no running local server. Static render + source contracts cover the checklist.

### Files changed

- `lib/continuum/operating-shell/overnight-qa.test.ts`
- `lib/continuum/operating-shell/ui.test.ts`
- `OVERNIGHT_EXECUTION.md`

### Tests run

- Targeted operating-shell / docket / founder-actions / Open Email / Projects / PWA tests: 67 pass, 0 fail
- `npx eslint` on Lane 6 files: pass
- `npm run test:continuum`: 1688 pass, 0 fail
- `npm run build`: pass

### Architectural decisions

- QA is regression-only. Do not restyle accepted Phase 1A/1B chrome.
- Live session QA remains a founder-side check after deploy.

### Blockers

- Authenticated 390px device pass still needs a founder session on a running app.
- Production Gmail freshness still needs kill switch + deploy.
- Historical reconstruction still needs a founder-approved bounded run.

### Next lane

Queue complete. Do not merge to main. Do not deploy. Resume from this manifest.

## Morning handoff

- Baseline: Phase 1B `e29c383`. origin/main remains `65aea302ac845c592f5859dbd057ef3452d59573`.
- Branch: `continuum/founder-operating-ux-v1`
- Lanes 1–6 DONE.
- Checkpoints: `00eebd5` `08078f6` `ffd2272` `5f5c414` `1c62cac` `ca791b2`.
- Recommended next: founder review of the feature branch, then approve kill-switch/cron deploy and any persistence/OAuth work. Never merge overnight.
