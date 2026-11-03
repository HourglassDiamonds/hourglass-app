# Continuum beta recovery audit

Audit date: November 3, 2026 (America/New_York)

Scope: read-only inspection of the Continuum codebase, the shared Preview Supabase project, and Vercel Preview configuration. No client record, lifecycle, job, candidate, Gmail index, proposal, publication, or Production state was changed during this audit.

## Executive finding

The Sterling lifecycle branch contains the core reasoning, validation, approval, and projection machinery, but the shared Preview environment is not operating as a live Sterling system. The latest target-branch deployment is healthy, yet Preview has neither the Sterling publisher flags nor the Gmail and continuity configuration required to run a validated publication. The durable publication table is empty, no Sterling reconciliation cron is configured, and the persisted Today snapshot is an obsolete v1 test snapshot. Today therefore needs to identify its canonical fallback honestly; it must not imply that Sterling is live.

Beta A is the narrow safe recovery slice: preserve the existing canonical Today fallback, make that fallback visible, and show run-level provenance only when a fresh validation-passed Sterling publication actually exists. This branch implements that slice without changing shared Preview data or enabling Sterling.

## Verified system map

| Surface | Implemented in code | Operational evidence | Recovery status |
| --- | --- | --- | --- |
| Canonical Projects and Jobs | Yes | Shared Preview contains lifecycle and job rows, including acceptance fixtures | Available, but audit data is predominantly synthetic |
| Today read model | Yes | One persisted `founder_today_v1` snapshot from September 23; current code expects a newer model | Current deployment should rebuild, but successful current persistence is not evidenced |
| Sterling evidence assembly and reasoning | Yes | Test coverage and shadow/runtime code are present | Not proven live in Preview |
| Durable Sterling publication | Yes | `continuum_sterling_today_publications` exists with zero rows | No current publication |
| Sterling-to-Today projection | Yes | Projection tests enforce at most three founder actions and separate vendor/client work | Ready behind default-off gate |
| Canonical approval adapter | Yes | Transactional approval migrations are present; five older synthetic proposal records exist | Machinery present; founder-browser acceptance remains blocked |
| Gmail evidence index | Yes | A connection and indexed messages exist, but observed evidence is old or fixture-based | Not trustworthy as current business correspondence |
| Sterling scheduler | No verified cadence | No full/light Sterling reconciliation cron appears in `vercel.json`; no scheduler execution was found | Missing for Beta C/D |
| Preview deployment | Yes | Target branch deployment was READY at audit time | Application reachable; Sterling disabled/unavailable by configuration |
| Production | Out of scope | Not inspected or changed beyond environment-key inventory needed to prevent accidental Preview assumptions | Unchanged |

## Environment and provenance findings

- Vercel project: `hourglass-app`.
- Audited target revision: remote `codex/sterling-today-lifecycle-recovery` at `6b2b8d9`.
- A local-only follow-on commit contained disposable isolated-acceptance fixture tooling. It was deliberately excluded from this recovery branch.
- Recovery branch: `codex/continuum-beta-recovery`, created from the verified remote target revision.
- Preview has the base Continuum and Supabase settings, but no verified Sterling publisher enablement, durable lease enablement, continuity HMAC key, or Preview Gmail OAuth/token configuration.
- The publication TTL in the current implementation is fifteen minutes. This is useful for fail-closed freshness, but it also means the requested 6:00 AM and 4:00 PM full runs plus 9:30 AM, 12:30 PM, and 2:30 PM light runs cannot support an all-day Sterling claim without an explicit freshness policy.

## Truth-set reconciliation

These rows describe what was observed in the shared Preview acceptance data. They are evidence for recovery behavior, not authorization to mutate client records.

| Subject | Canonical or candidate state | Sterling-safe interpretation | Intended Today behavior | Discrepancy / recovery action |
| --- | --- | --- | --- | --- |
| Daniel Iles | Person-association candidate was explicitly discarded; related open-job candidate was discarded | Suppressed junk, not a client or work item | Do not surface | Behavior is consistent; preserve discard suppression |
| Morgan | Project stage `cad`; open job waits on vendor | Vendor-owned active work | Watching / vendor lane, not founder Up Next | Projection test already enforces non-founder ownership |
| Zane | Project stage `production`; open job waits on vendor | Vendor-owned active work | Watching / vendor lane | Preserve canonical ownership and stage |
| Dylan | Project completed; job resolved | Closed work | Exclude from active Today | Projection test already excludes `no_attention` work |
| J. Pennock | Canonical project completed; job resolved | Closed canonical identity | Exclude from active Today | Keep separate from the JP candidate unless a reviewed identity action proves a merge |
| Madi | Title says declined, but lifecycle remains `design`; job is cancelled | Conflicting canonical signals | Do not silently present as healthy active work | Requires an explicit reviewed canonical correction, not a reasoning-layer mutation |
| Audrey | Not present in Preview canonical, candidate, or Gmail evidence; appears only in acceptance scope | Missing evidence | Do not invent or display | Load authoritative evidence before any acceptance claim |
| JP | Separate pending person-association candidate | Unresolved identity candidate | Keep separate and reviewable | Never auto-merge with J. Pennock |

## Exact blockers

1. There is no fresh validated Sterling publication in shared Preview.
2. Preview configuration does not enable the Sterling publisher and does not expose a live Gmail provider path for Sterling reconciliation.
3. No requested Sterling schedule is configured or evidenced.
4. The available Gmail index is stale/test-oriented, so it cannot support claims about current client correspondence.
5. Founder-browser acceptance is blocked in the isolated environment because the durable abuse-rate-limit helpers must be provisioned through a safety-approved database workflow. Shared Preview already has the relevant helpers; this is not permission to alter shared Preview or Production.
6. Audrey has no source evidence in the inspected Preview system.

## Ranked repairs

1. **Beta A — truthful Today source status (implemented here).** Show canonical fallback whenever Sterling is disabled, missing, invalid, expired, or unreadable. Show Sterling only with validation result, run ID, source watermark, publication time, and expiration.
2. **Beta B — isolated founder acceptance.** Provision only the reviewed, idempotent abuse-rate-limit schema in an isolated environment after explicit platform safety approval; verify function signatures, grants, RLS posture, fail-closed behavior, and hashed identifiers. Do not retry provisioning against shared Preview and do not weaken rate limits.
3. **Beta C — evidence freshness.** Establish a Preview-only Gmail provider path or a founder-approved fixture contract, then prove index watermark, ingestion time, and reconciliation completeness without mutating canonical records.
4. **Beta D — scheduler and publication proof.** Add the requested full/light cadence only after approval of the effective publication freshness policy. Capture scheduler invocation, run validation, publication row, and rendered Today provenance.
5. **Beta E — reviewed canonical corrections.** Resolve Madi and any other real discrepancies through the existing proposal/approval transaction path. Keep JP/J. Pennock separate and preserve Daniel suppression. Audrey requires evidence before action.

## Beta A acceptance contract

- Default-off in Production and Preview unless explicitly configured.
- Any missing, expired, malformed, validation-failed, or unreadable publication falls back to canonical Today.
- Fallback UI says that Sterling is off or unavailable; it does not claim Sterling reasoning.
- An active Sterling display includes `PASS`, run ID, source watermark, published time, and expiry.
- Gmail freshness remains a separate signal and is not presented as proof of Sterling freshness.
- No model call and no canonical mutation occurs in the publication read path.

## Required approvals before later phases

- Platform safety approval for isolated durable abuse-limit provisioning.
- Approval to add Preview-only secrets or OAuth credentials for live Gmail access.
- Approval for scheduler changes and the publication TTL/freshness policy.
- Founder review for canonical client-state corrections.
- Separate explicit approval for any Production change or deployment.

## Verification limits

The audit verified repository behavior, database state, environment-key presence, and deployment readiness. It did not authenticate as the founder in the deployed dashboard, send Gmail, execute a model run, create a publication, alter client records, or deploy to Production. Those omissions are intentional safety boundaries, not successful acceptance evidence.
