# Hourglass Agent OS V1

Practical operating system for a lean executive team — not a pile of prompt bots.

## Philosophy

Hourglass Agent OS turns **available, read-only business evidence** into a short founder agenda. It prefers honest measurement gaps over invented certainty. It never publishes, edits CRM, posts social, or changes production configuration.

V1 is deliberately small: five locked executives. **Operational now:** Chief of Staff, Business Intelligence, Search Strategy, Content, and Opportunity. New capabilities should fold into these executives before new agents are created.

## Executive structure (locked order)

1. **Chief of Staff** — orchestrates, ranks, reconciles, produces the founder brief
2. **Business Intelligence** — trustworthy performance view, anomalies, measurement gaps
3. **Search Strategy** — operational (GSC + Diamond Guide authority, local/GEO readiness)
4. **Content** — operational (founder conversations, repurposing, sequencing, brand-fit)
5. **Opportunity** — operational (underused demand, partnership/referral research, paid/remarketing readiness)

## Opportunity Executive

### Mission

Continuously identify low-cost, high-ROI growth opportunities that align with Hourglass positioning and can compound authority, qualified demand, referrals, and trust without distracting the business with generic marketing activity.

Core question: which underused move has credible evidence, fits the brand, costs relatively little, and could materially improve qualified discovery or trust? Favor a small number of strong opportunities over a long speculative list.

### Owned domains

Underpriced/underused organic demand, paid-search readiness, local partnerships, referrals, bridal/wedding ecosystem, community visibility, podcast/newsletter/earned-media research, strategic content distribution, competitor positioning leverage (internal only), remarketing readiness, audience reuse, channel-fit, relationship-driven growth, founder-network leverage, low-cost experiments, and opportunities surfaced by Search/Content/BI that lack an owner.

### Evidence sources

- BI recommendations/evidence (Studio/CTA, measurement gaps, journeys)
- Search Strategy opportunities (high-intent demand, local intent, positions 4–15) — Opportunity adds packaging/distribution leverage; Search retains technical SEO
- Content opportunities (founder themes, handoffs) — Opportunity adds media/partner distribution research; Content retains production
- Bounded repository strategy (`lib/agent-os/opportunity/strategy.ts`) — routes, partner categories, positioning claims, themes

No web browsing. No scraping. No outbound connectors. Specific external businesses/outlets are never named as confirmed targets without a verified adapter.

### Opportunity taxonomy

Typed in `lib/agent-os/opportunity/types.ts` (underpriced-organic-demand, paid-search-readiness, remarketing-readiness, local-partnership-opportunity, referral-opportunity, bridal-ecosystem-opportunity, podcast/newsletter/earned-media, content/tool/guide distribution, competitor-positioning-gap, conversion-leverage-opportunity, measurement-gap, opportunity-already-covered, etc.).

### Qualification rules

Prefer buyer demand evidence, brand fit, high-intent audience, low/moderate cost, contained scope, measurable signal, compounding trust, existing guide/tool/Concierge connection, founder expertise, regional relevance, limited downside, clear next step, and not already covered.

Penalize vague awareness, generic “network more / run ads,” expensive experiments, unverified audience claims, weak conversion paths, trends disconnected from Hourglass, high founder burden, active-sprint duplicates, and strategies needing unavailable social/GBP metrics.

### Readiness states

`ready-to-evaluate` | `ready-for-founder-decision` | `research-required` | `measurement-blocked` | `not-ready` | `already-covered` | `defer` | `rejected`

Examples: GSC high-intent demand + landing path → ready-to-evaluate; partner category without verified targets → research-required; remarketing without audience/consent evidence → measurement-blocked; Content already owns production → already-covered.

### Confidence vs attractiveness vs actionability

Opportunity separates four signals:

- **evidenceConfidence** — certainty about the diagnostic claim (e.g. “audience evidence is missing”)
- **strategicAttractiveness** — how attractive the move would be if ready
- **actionability** — readiness to act (measurement-blocked / research-required stay low)
- **recommendation priority** — shared ranking uses attractiveness × actionability; high diagnostic confidence alone never raises blocked-item priority

`measurement-blocked` / `already-covered` / generic `research-required` normally stay in structured JSON and deferred summaries — not named founder-brief slots.

### Underused-demand logic

Uses Search evidence (positions 4–15, high impressions/weak CTR, local intent) to recommend packaging, distribution, partner story, or Concierge connection — not technical SEO. Without paid-cost evidence, language stays “underused demand / existing leverage,” never “cheap CPC.”

### Paid-search readiness

Requires verified high-intent demand, relevant destination, Concierge/conversion path thinking, and founder approval. Missing CPC → cost class `unknown`; no CPC/lead/ROI estimates. Readiness assessment only — never launches ads.

### Remarketing readiness

Requires verified audience size, consent/privacy alignment, and audience config. Without evidence → `measurement-blocked`; do not recommend implementation or claim audience availability.

### Local partnership / referral logic

Category-level only (wedding planners, photographers, venues, advisors, etc.): trust transfer, audience moment, Hourglass asset, mutual value, research required, brand risks. No specific partner named as available.

### Media / community research

Category or research-brief angles from founder themes (podcast, newsletter, local media). No fabricated outlets, acceptance, or audience size.

### Competitor-positioning limits

Internal positioning leverage only (no inventory pressure, warmth not inspection, GG-led guidance, tech serving humanity). Never claim named competitors lack capabilities without verified evidence.

### Cross-executive synthesis & already-covered

Opportunity consumes BI/Search/Content signals and must add distinct leverage. Exact duplicates, same objective, active-plan items, or better-owned work are suppressed as `already-covered` / deferred.

### Stable IDs

`opportunity:<source>:<type>:<subject>:<readiness>` — deterministic, no PII/contacts/secrets/timestamps.

### External-data limitations

GBP, Buffer, HubSpot aggregates, CPC, remarketing audiences, and verified partner/outlet lists are unavailable in V1. Gaps are explicit; internal synthesis still runs.

### How Opportunity feeds Chief of Staff

Invoked after BI + Search + Content; titles prefixed `[Opportunity]`; deduped/ranked with the shared model; research-required and speculative ideas generally rank below verified operational issues; brief still caps at 5 named priorities; full set remains in JSON.

### Next planned BI Conversion & Measurement expansion

Deepen BI conversion-path and measurement diagnostics (assisted conversions, destination quality, attribution completeness) so Opportunity paid/remarketing readiness can graduate from gates to evidence-backed evaluation when adapters exist.

## Content Executive

### Mission

Develop a coherent founder-led content system that compounds Hourglass authority, expresses the brand clearly, supports search demand, and moves qualified prospects toward trust and conversation without chasing generic social trends.

### Owned domains

Founder conversations, long-form video, short-form clips, carousels, captions, editorial themes, sequencing, repurposing, content→guide/tool/Concierge handoffs, audience questions, message coverage/saturation, brand voice, production backlog, distribution recommendations, and content performance **only when verified**.

### Repository content inventory

`lib/agent-os/content/inventory.ts` inspects:

- `lib/conversations/episodes.ts` (typed conversation registry)
- Static message territories + planned conversation pipeline in `lib/agent-os/content/themes.ts`

Deployment-safe: static imports only — no filesystem walks, no marketing-sprint directory scans, no transcript dumps in recommendations.

**Material vs publication truth:** inventory separates `materialState` (source material exists / planned / incomplete) from `publicationState` (`verified-published` | `verified-scheduled` | `verified-unpublished` | `unknown`). Without a verified publication ledger or Buffer/social adapter, publication state stays **`unknown`**. Registry `draft` labels are material metadata only — never proof of operational unpublished status. Inventory completeness is typically **`partial`**.

Narrative/planning sequence (`recommendedNarrativeSequence`) is allowed from themes; **verified publishing sequence** requires verified publication state.

### Data sources

- Repository inventory (always)
- Search Strategy opportunities (communication translation — not technical SEO ownership)
- BI recommendations (trust/messaging signals — not measurement ownership)
- Buffer/social **only if configured** (currently unavailable; measurement gap is explicit)

### Content opportunity taxonomy

Typed in `lib/agent-os/content/types.ts` (founder-conversation-topic, repurposing-gap, handoffs, saturation/duplicate risks, search-demand-content, local-authority-content, content-measurement-gap, etc.).

### Founder-conversation logic

Recommends next conversation at **map** level: audience question, core idea, supporting areas, ownable lines, related guide/tool, clip territories, carousel only when sequencing helps. Does not emit finished scripts or publish.

### Repurposing / sequence / brand-fit

- Repurposing chooses formats that fit the idea (not every channel)
- Sequence respects draft→published parent/child relationships
- Brand-fit rejects clickbait, pressure, commodity framing, buyer elitism

### Ownership boundaries

| Executive | Owns |
|-----------|------|
| Search Strategy | Technical SEO (CTR, schema, positions, guide-authority link audits) |
| Content | Communication & production (conversation maps, clips, carousels, handoff storytelling) |
| BI | Measurement diagnosis (tracking, CTA funnel health) |

### Limits without social data

Missing Buffer lowers confidence for channel-specific claims and never fabricates reach/watch time. Repository + Search + BI content recommendations still run.

### How Content feeds Chief of Staff

Invoked with BI + Search; titles prefixed `[Content]`; deduped/ranked with shared model; brief still caps at 5 named priorities; full set remains in JSON.

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

`runAgentOsBrief` invokes BI, Search Strategy, Content, and Opportunity, then Chief of Staff merges recommendations, deduplicates, ranks with the shared model, and prefixes executive titles (`[Search Strategy]`, `[Content]`, `[Opportunity]`) so the founder brief shows origin. Zero recommendations from an executive is a healthy outcome when evidence is thin.

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
3. Invoke Business Intelligence, Search Strategy, Content, then Opportunity
4. Invoke Chief of Staff (rank, dedupe, brief across all five executives)
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

- `briefSurfacing.opportunitiesDetected` — Search + Content + Opportunity opportunities found
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

1. BI Conversion & Measurement expansion (assisted conversions, destination quality, attribution completeness)
2. Decision Journal durable store (still founder-gated writes)
3. Optional authenticated internal preview (separate from production hard-404 dashboard)
4. Optional LLM brief polish behind the existing provider interface
5. Optional verified GBP / Buffer / HubSpot-aggregate read adapters (still read-only)
6. Optional verified paid-cost or remarketing-audience adapters so Opportunity readiness can advance beyond gates

## Protected systems (do not touch from Agent OS)

Public site, Concierge, Diamond Studio, Analyze Sparkle, Size Studio, Supabase key handling, retention/cleanup crons, founder-dashboard auth/hard-404, GA4/GSC/HubSpot configuration, Buffer, GBP, Privacy Policy, Vercel env, production data.
