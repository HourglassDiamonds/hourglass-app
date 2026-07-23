# Hourglass Agent OS V1

Practical operating system for a lean executive team — not a pile of prompt bots.

## Philosophy

Hourglass Agent OS turns **available, read-only business evidence** into a short founder agenda. It prefers honest measurement gaps over invented certainty. It never publishes, edits CRM, posts social, or changes production configuration.

V1 is deliberately small: five locked executives. **Operational now:** Chief of Staff, Business Intelligence, and Search Strategy. **Scaffolded:** Content and Opportunity. New capabilities should fold into these executives before new agents are created.

## Executive structure (locked order)

1. **Chief of Staff** — orchestrates, ranks, reconciles, produces the founder brief
2. **Business Intelligence** — trustworthy performance view, anomalies, measurement gaps
3. **Search Strategy** — operational (GSC + Diamond Guide authority, local/GEO readiness)
4. **Content** — scaffold (conversations, long-form, clips, cadence, brand standards)
5. **Opportunity** — scaffold (underpriced demand, partnerships, referrals, paid when evidenced)

## Search Strategy

### Mission

Maintain and compound Hourglass search authority across traditional search, local search, and AI-assisted discovery without chasing generic SEO activity.

### Live data sources

- **Google Search Console** (read-only) via `lib/integrations/gsc.ts` when OAuth + `GSC_SITE_URL` are configured
- **Repository guide-authority adapter** (`lib/agent-os/search/guide-authority.ts`) inspecting `app/diamond-guide/articles.ts`, hub metadata, category map, FAQ schema wiring, and tool/Concierge links
- **GA4** may inform BI landings; Search Strategy does not invent GSC from GA4

Missing GSC lowers confidence and blocks GSC-derived opportunities — repository analysis still runs. Missing GBP never blocks Search Strategy; local findings stay GSC + Charlotte guide registry only.

### Search opportunity taxonomy

Typed categories in `lib/agent-os/search/types.ts`:

- `high-impression-low-ctr`, `near-page-one`
- `declining-query`, `declining-page`, `rising-query`
- `query-page-mismatch`, `possible-cannibalization` (inference; does not overclaim)
- `content-gap`, `internal-link-gap`, `tool-handoff-gap`
- `local-intent-gap`, `geo-readiness-gap`, `schema-gap`, `metadata-gap`, `measurement-gap`

### Local-search logic

Uses GSC local-intent classification (Charlotte, Waxhaw, Fort Mill, South Charlotte, metro terms) plus repository Charlotte Guides inventory. Does **not** fabricate GBP pack/review metrics.

### GEO readiness logic

Scores answer-first openings, FAQ schema presence, tool interconnection, and related-link density. Labeled **readiness signals only** — never claimed AI-engine rankings or citations.

### Limits of inference

- No query×page Search Console matrix → mismatch/cannibalization stay cautious inferences
- Small samples reduce confidence
- Revenue never inferred from impressions
- “Publish more content” without evidence is rejected by design

### How Search Strategy feeds Chief of Staff

`runAgentOsBrief` invokes BI and Search Strategy, then Chief of Staff merges recommendations, deduplicates, ranks with the shared model, and prefixes Search titles with `[Search Strategy]` so the founder brief shows origin. Zero Search recommendations is a healthy outcome when evidence is thin.

### Next planned Content executive pass

Content becomes operational once a verified social/content read adapter exists (Buffer or equivalent). Until then Content remains scaffold-only.

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

**Executive-level status** (`executiveStatuses`) is independent of overall `runStatus`. Example: BI can be `blocked` while Search Strategy is `completed-with-warnings` with repository findings.

**Brief evidence quality** (`briefEvidenceQuality`):

- `full` — normal evidence coverage
- `partial-degraded` — usable findings present while critical analytics are down (not all-clear)
- `none-blocked` — blocked with nothing usable
- `failed` — fatal abort

**Delivery guidance** (`deliveryGuidance`) for a future sender (not wired in V1):

- `send-normal-brief`
- `send-degraded-partial-brief`
- `send-failure-alert`
- `send-nothing` (healthy quiet week)

Schedulers must not confuse `none-material` with `none-blocked-by-sources`. A run with valid Search findings must never be treated as “all clear,” and BI-source failure must not erase repository Search evidence from JSON.

### Brief surfacing vs full JSON

- `briefSurfacing.opportunitiesDetected` — Search opportunities found
- `briefSurfacing.recommendationsRanked` — active ranked recommendations retained in JSON
- `briefSurfacing.recommendationsSurfacedInBrief` — individually named Markdown priorities (1 highest-ROI + ≤4 additional)

Lower-ranked findings are summarized as deferred counts in Markdown; the full set stays in structured JSON.

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
- No GBP adapter → no local pack / review metrics (Search Strategy local findings use GSC + guide registry only)
- No HubSpot weekly aggregate read → no consultation CRM funnel in Agent OS
- Assisted conversion paths still pending in executive dashboard snapshots
- CTA click samples can be small — percentage swings overstate urgency
- Revenue must never be inferred from traffic, Studio views, or impressions
- Charlotte Guides articles exist without a mapped category hub (repository finding)

## Next implementation phases

1. Content operational once a verified social/content read adapter exists
2. Opportunity operational on underpriced query + partnership evidence
3. Decision Journal durable store (still founder-gated writes)
4. Optional authenticated internal preview (separate from production hard-404 dashboard)
5. Optional LLM brief polish behind the existing provider interface
6. Optional verified GBP read adapter (still read-only)

## Protected systems (do not touch from Agent OS)

Public site, Concierge, Diamond Studio, Analyze Sparkle, Size Studio, Supabase key handling, retention/cleanup crons, founder-dashboard auth/hard-404, GA4/GSC/HubSpot configuration, Buffer, GBP, Privacy Policy, Vercel env, production data.
