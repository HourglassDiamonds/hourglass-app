# Hourglass Agent OS V1

Practical operating system for a lean executive team — not a pile of prompt bots.

## Philosophy

Hourglass Agent OS turns **available, read-only business evidence** into a short founder agenda. It prefers honest measurement gaps over invented certainty. It never publishes, edits CRM, posts social, or changes production configuration.

V1 is deliberately small: five locked executives, two operational, three scaffolded. New capabilities should fold into these executives before new agents are created.

## Executive structure (locked order)

1. **Chief of Staff** — orchestrates, ranks, reconciles, produces the founder brief
2. **Business Intelligence** — trustworthy performance view, anomalies, measurement gaps
3. **Search Strategy** — scaffold (organic/local/GEO, GSC, guides, internal links, GBP search)
4. **Content** — scaffold (conversations, long-form, clips, cadence, brand standards)
5. **Opportunity** — scaffold (underpriced demand, partnerships, referrals, paid when evidenced)

Only Chief of Staff and Business Intelligence are **operational** in this pass.

## Permissions (read-only boundary)

Agent OS V1 **may**:

- inspect approved aggregate business data
- calculate changes and anomalies
- rank opportunities
- generate internal briefs
- identify missing/unreliable data
- recommend founder actions

Agent OS V1 **may not**:

- publish content, edit GBP, post via Buffer
- send customer messages or contact leads
- modify HubSpot, GA4, GSC, Supabase, website content
- run cleanup, change Vercel, rotate secrets, alter production config
- approve its own recommendations or make purchases
- write to external business systems

Write-capable connectors **cannot be registered** in V1. Proposed actions that imply external writes are blocked.

Do **not** reuse `/executive-dashboard` session auth for Agent OS on production (hard-404 posture stays intact). Prefer this local/server CLI.

## Evidence standards

Every factual recommendation carries evidence:

- source, source type, collection timestamp, reporting period
- metric/observation, prior comparison when available
- freshness, reliability, supporting reference, redaction status

No recommendation may claim certainty from unavailable or stale data. Missing data is an explicit output.

## Recommendation ranking

Transparent multi-factor model (see `lib/agent-os/ranking.ts` / `RANKING_LOGIC_SUMMARY`):

- expected business impact
- confidence
- urgency
- effort (penalty)
- reversibility
- strategic alignment
- dependency readiness
- data quality

Strong penalties for weak evidence, stale data, missing dependencies, out-of-authority items, and write-implied actions. Uncertainty is never hidden behind a single score — confidence and factor breakdown remain visible.

## Source-health model

For every expected source, runs report:

- configured / reachable / fresh / complete
- permission posture (read-only)
- last successful read
- errors
- effect on recommendation confidence
- retrieval state: `ok` | `empty` | `failed` | `not-configured` | `fixture`

Empty results and failed retrieval are different states.

### Current source posture (code-verified)

| Source | Status |
|--------|--------|
| GA4 Data API | Live adapter (readonly) when OAuth configured |
| Google Search Console | Live adapter (readonly) when configured; soft-fail otherwise |
| Weekly intelligence report | Read via existing helper when Supabase configured |
| HubSpot aggregates | Unavailable — no weekly read adapter |
| Buffer / social | Unavailable — do not fabricate |
| GBP | Unavailable — do not fabricate |

## Decision Journal schema

Typed in `lib/agent-os/decision-journal.ts`. Fields include decision ID, recommendation ID, executive, date proposed, evidence snapshot, confidence, founder decision/rationale, owner, target date, outcome status, measured outcome, review date, lesson learned.

**No production write persistence in V1.** `InMemoryDecisionJournal` is test/local-only and must not write during production execution.

## Run lifecycle

1. Load read-only adapters (fixture or live — live never falls back to fixtures)
2. Collect source-health
3. Invoke Business Intelligence
4. Invoke Chief of Staff (rank, dedupe, brief)
5. Optional synthesis provider (deterministic by default; no LLM installed)
6. Emit JSON + markdown artifacts under `tmp/agent-os/`

### Run-status contract (for future automation)

Structured runs use:

- `completed` — healthy finish
- `completed-with-warnings` — usable finish with non-fatal gaps/warnings
- `failed` — runner could not complete safely
- `blocked` — critical sources unavailable

Separately, `recommendationAvailability` distinguishes:

- `has-material-recommendations`
- `none-material` — healthy quiet period (safe “nothing to escalate”)
- `none-blocked-by-sources` — zero recommendations because measurement failed (not “all clear”)

Schedulers must not confuse `none-material` with `none-blocked-by-sources`.

## Founder approval model

- Recommendations that require spend, irreversible change, or policy judgment set `approvalRequired`
- Agent OS never self-approves
- Decision Journal records founder choice and later outcomes (schema only in V1)

## How to run the manual brief

```bash
npm run agent-os:brief
# equivalent:
npm run agent-os:brief -- --fixture

# live read-only only when env permits (GA4/GSC/weekly report):
npm run agent-os:brief:live
```

Outputs:

- structured JSON
- markdown founder brief (~2 minutes to read)

Artifacts write only to gitignored `tmp/agent-os/`. No public API. No unauthenticated route.

## Model / provider behavior

This repository has **no OpenAI / AI SDK product dependency**. V1 uses deterministic TypeScript rules, ranking, and templates. A future LLM synthesis provider can plug into `lib/agent-os/provider.ts` with structured output, validation, redacted context only, and deterministic fallback — without inventing evidence.

## Known measurement gaps

- No Buffer / social API → incomplete social attribution
- No GBP adapter → no local pack / review metrics
- No HubSpot weekly aggregate read → no consultation CRM funnel in Agent OS
- Assisted conversion paths still pending in executive dashboard snapshots
- CTA click samples can be small — percentage swings overstate urgency
- Revenue must never be inferred from traffic or Studio views

## Next implementation phases

1. Search Strategy operational (GSC-deep + guide authority recommendations)
2. Content operational once a verified social/content read adapter exists
3. Opportunity operational on underpriced query + partnership evidence
4. Decision Journal durable store (still founder-gated writes)
5. Optional authenticated internal preview (separate from production hard-404 dashboard)
6. Optional LLM brief polish behind the existing provider interface

## Protected systems (do not touch from Agent OS)

Public site, Concierge, Diamond Studio, Analyze Sparkle, Size Studio, Supabase key handling, retention/cleanup crons, founder-dashboard auth/hard-404, GA4/GSC/HubSpot configuration, Buffer, GBP, Privacy Policy, Vercel env, production data.
