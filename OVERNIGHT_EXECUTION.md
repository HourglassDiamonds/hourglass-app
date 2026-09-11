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
| 1 Near-real-time Gmail pipeline | DONE | pending commit |
| 2 Email-driven Project / Action hydration | TODO | |
| 3 Retain supporting Gmail provenance | TODO | |
| 4 Historical Gmail reconstruction foundation | TODO | |
| 5 Master Sprint → Today unused capacity | TODO | |
| 6 Operating QA / regression | TODO | |

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

Lane 2 — email-driven Project / Action hydration, using the existing Candidate / Moderator / Founder Review architecture. Do not invent a parallel CRM.
