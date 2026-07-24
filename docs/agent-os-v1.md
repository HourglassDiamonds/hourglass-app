# Hourglass Agent OS V1

Practical operating system for a lean executive team — not a pile of prompt bots.

## Philosophy

Hourglass Agent OS turns **available, read-only business evidence** into a short founder agenda. It prefers honest measurement gaps over invented certainty. It never publishes, edits CRM, posts social, or changes production configuration.

V1 is deliberately small: five locked executives. **Operational now:** Chief of Staff, Business Intelligence, Search Strategy, Content, and Opportunity. New capabilities should fold into these executives before new agents are created.

## Executive structure (locked order)

1. **Chief of Staff** — orchestrates, ranks, reconciles, produces the founder brief
2. **Business Intelligence** — trustworthy performance view, anomalies, measurement gaps
3. **Search Strategy** — operational (GSC + Diamond Guide authority + Local Authority / GBP intelligence)
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

### BI measurement handoff

Opportunity consumes `BusinessIntelligenceOutput.opportunityHandoff` for paid-search / remarketing / conversion-leverage gates. When authoritative conversion measurement is missing or unverified, paid-search readiness becomes `measurement-blocked` and references BI prerequisite IDs — it does **not** duplicate BI repair recommendations or launch ads.

## Business Intelligence — Conversion & Measurement

### Mission

Answer: can Hourglass trust its current measurement, where are qualified prospects progressing or dropping out, and which conversion or tracking issue deserves attention first?

BI owns measurement diagnosis, metric reliability, anomaly detection, conversion analysis, attribution quality, destination quality, event-health monitoring, and readiness evidence for Opportunity. It does **not** change GA4/GTM/HubSpot, add events, or launch ads.

### Expected vs observed instrumentation

| Layer | Proves | Does not prove |
|-------|--------|----------------|
| **Expected** (`lib/agent-os/bi/expected-events.ts`) | Repository intends an event (call site, constant, docs) | That the event fires in production |
| **Observed** (GA4 weekly adapter / fixture overlay) | An event name has volume in a comparable period | User intent, revenue, or CRM qualification |
| **Verified operational conversion** | Source definitively supports the action (e.g. `generate_lead` after Concierge soft-accept) | CTA click ≠ lead; tool pageview ≠ completion |

Missing observed activity with unread metrics → `unknown`, not automatic “broken tracking.”

### Funnel definitions

Typed in `lib/agent-os/bi/funnels.ts`:

- General consultation (landing → CTA → Concierge start → submit → `generate_lead`)
- Diamond Studio / Size Studio (entry → engagement → CTA → Concierge)
- See It On Your Hand / Analyze Sparkle (repository routes; unsupported stages marked as measurement gaps)
- Content-to-conversion (conversation → related resource → Concierge)

Unsupported stages are gaps — never invented as observed facts.

### Measurement-health taxonomy

Typed in `lib/agent-os/bi/types.ts` (`MEASUREMENT_HEALTH_TYPES`): expected-event-not-observed, observed-event-not-documented, funnel-stage-unmeasured, tool-entry-completion-gap, tool-to-concierge-gap, concierge-start-submit-gap, destination-quality-gap, attribution-gap, source-medium-anomaly, measurement-regression, sample-size-limitation, measurement-healthy, verification-required, etc.

### Decision-effect / severity model

- **decision-blocking** — cannot responsibly evaluate conversion, paid, remarketing, or major channel performance
- **decision-degrading** — analysis possible but confidence materially lower
- **monitor** — low-impact / low-volume / non-critical (usually suppressed from founder brief)

Not every missing event is decision-blocking. Low-value dead events (e.g. `home_clicked`) stay monitor.

### Conversion-integrity rules

Prefer: absent/unknown core conversion, entry vs completion indistinguishability, Concierge start/submit inseparability, unmeasured destination paths, unreliable attribution, abrupt event regressions, Opportunity readiness blocked by measurement.

Penalize: tiny samples, short windows, speculative stages, unavailable live sources, vanity metrics.

Drop-off language requires comparable periods, sufficient sample, same source, and no known instrumentation mismatch. Prefer “progression gap” / “verification required” — never “users hate this page” or revenue claims.

### Attribution, regression, destination quality

- Attribution: channel groups always; source/medium fragmentation only with repeated high-volume variants (fixture) or explicit live gap when source/medium is not pulled
- Regression: stable event, comparable prior period, minimum prior sample, cautious “possible” label
- Destination: existing landing + Concierge/tool path + measurement posture; missing destination ≠ missing tracking

### Opportunity-readiness handoff

`OpportunityMeasurementHandoff` reports conversion verification, destination measurability, attribution usability, paid-search prerequisite missing, remarketing audience/consent unavailable, and BI finding IDs. When Concierge conversion findings cluster, prerequisites point at the single root recommendation ID `business-intelligence:measurement:concierge-conversion-root:concierge`. BI never recommends launching ads. Opportunity retains readiness states in JSON and must not duplicate founder-facing “fix tracking” recommendations.

### Authoritative reporting conversion

Repository instrumentation may list **candidates** (`generate_lead`, `concierge_form_submitted`) plus diagnostic events (`concierge_form_started`, `consultation_cta_clicked`). BI recommends designating **one** verified reporting conversion for Concierge success — not deleting or replacing events, and not assuming a single candidate is already the only correct production key event.

### Live-data limitations

Live mode derives observations only from the existing GA4 weekly adapter allowlist (`STUDIO_EVENTS`). Concierge `generate_lead` / form events are **unknown** until a later read-only adapter expansion — that is a verification requirement, not fabricated breakage. Live mode never uses fixture conversion overlays.

### Stable IDs

`business-intelligence:measurement:<type>:<subject>` — deterministic; no PII, sessions, uploads, secrets, or timestamps.

### Chief of Staff prioritization

Decision-blocking measurement findings can outrank downstream speculative work when evidence is strong. Low-value gaps stay deferred. Measurement findings soft-dedupe against legacy BI heuristics. Founder brief still caps at **5** named priorities; full findings remain in JSON.

## Client Journey & Conversion Analysis

### Mission

Identify how prospects discover Hourglass, which pages they enter, what they do next, where journeys stall or fragment, which behaviors are genuinely observable, which conversion signals remain unknown, and which founder actions are most likely to improve qualified conversations — without fabricating paths or conversion rates.

### BI vs Chief of Staff ownership

| Owner | Owns |
|-------|------|
| **Business Intelligence** | Source evidence, journey reconstruction, conversion-signal health, friction detection, measurement confidence, unknown-state handling, journey surface inventory, stable source gaps |
| **Chief of Staff** | Cross-executive synthesis, prioritization, founder-facing interpretation, action sequencing (measurement before optimization), decision framing, brief capping |

No sixth executive is created.

### Evidence hierarchy

1. **Observed analytics** — GA4 landings, allowlisted events, fixture path transitions when mode is fixture; never assumed.
2. **Repository-backed journey readiness** — routes, CTAs, tool links, trust/conversion destinations (`lib/agent-os/bi/journey/inventory.ts`). Proves intended structure only — not that users followed the path.
3. **Inferred journey hypotheses** — may combine landings + repo structure + GSC intent; always labeled `inferred`.
4. **Source gaps** — missing path, conversion, tool-completion, or source-to-lead measurement remain explicit unknowns.

### Observed vs inferred rules

- Repository link A→B = `repository-available`, **not** `observed transition`.
- Live GA4 weekly adapter does **not** expose path/next-page transitions → path movement is **unknown** in live mode (stable root gap).
- Fixture mode may include synthetic transitions for validation only.
- Never reconstruct fake paths from page-view totals alone.
- Never present inferred paths as observed user behavior.

### Conversion unknown-state behavior

- Form-submit / `generate_lead` outside the live allowlist → `unknown` (not zero conversions, not “low conversion rate”).
- Zero queried events ≠ zero real conversions without healthy verified measurement.
- Soft-dedupes against the Concierge conversion measurement root when that root already exists.

### Stable source gaps

| ID | Scope | Founder brief |
|----|--------|---------------|
| `business-intelligence:journey:source-gap:journey-path-measurement` | Path / next-page analytics | **Diagnostic only** — suppressed from founder ranking (internal analytics prerequisite; distinct from Concierge conversion root) |
| `business-intelligence:journey:source-gap:conversion-event-measurement` | Concierge submit / generate_lead | Soft-deduped under Concierge measurement root `business-intelligence:measurement:concierge-conversion-root:concierge` |
| `business-intelligence:journey:source-gap:tool-completion-measurement` | Studio suite completion | Diagnostic / suppressed |
| `business-intelligence:journey:source-gap:source-to-lead-attribution` | Channel→lead linkage | Diagnostic / suppressed; parent = Concierge conversion root |

Related symptoms consolidate under these roots — not one gap per route or event. Live briefs must not surface two measurement priorities for the same analytics deficiency.

### Founder-ranking safeguards

- Cap **≤5** named priorities; thin evidence may yield fewer.
- Internal Search/Content/Opportunity handoffs are not founder-rankable.
- Repository-only journey findings are capped; observed evidence outranks structural inference.
- Measurement prerequisites sequence before dependent journey optimization.
- No generic “improve conversion” without a defined action and supporting evidence.

### Fixture / live separation

- Fixture imports gated in `resolveJourneyObservations`; live refuses fixture overlays and fixture-mode bundles.
- Missing live sources → source gaps; no synthetic conversions or funnel rates.
- Path transitions exist in fixture only until a verified live path adapter exists.

### Explicit non-goals (journey pass)

No website/CTA/route changes, no GA4/GTM/event instrumentation, no schema edits, no email/CRM, no scraping, no fabricated analytics/funnel rates, no session replay/heatmaps/identity stitching, no deployments. Scheduling/persistence for Agent OS is documented in **Scheduling and persistence** below (email delivery still deferred).

### Module

`lib/agent-os/bi/journey/` — types, inventory, observe, findings, recommendations, ranking-policy, fixtures. Wired through `runBusinessIntelligence` → `journeyAudit` and Chief of Staff journey ranking gates.

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
| BI | Measurement diagnosis (tracking, conversion integrity, CTA funnel health, attribution quality) |

### Limits without social data

Missing Buffer lowers confidence for channel-specific claims and never fabricates reach/watch time. Repository + Search + BI content recommendations still run.

### How Content feeds Chief of Staff

Invoked with BI + Search; titles prefixed `[Content]`; deduped/ranked with shared model; brief still caps at 5 named priorities; full set remains in JSON.

## Search Strategy

### Mission

Maintain and compound Hourglass search authority across traditional search, local search, and AI-assisted discovery without chasing generic SEO activity.

### Local Authority / GBP mission

Answer: where is Hourglass gaining or missing local discovery authority across Charlotte, Waxhaw, Fort Mill, South Charlotte, and the surrounding engagement-ring market—and what should be verified or improved next?

Owned inside **Search Strategy** (not a sixth executive): local organic discovery, local-intent queries, GBP intelligence, location/entity consistency, local authority structure, local content coverage, local search/schema readiness, review/reputation measurement gaps, service-area clarity, and local guide/tool/Concierge handoffs.

### Source-of-truth separation

| Evidence class | Proves | Does not prove |
|----------------|--------|----------------|
| **Repository** (`search/local/entity-inventory.ts`, guides, schema, Concierge) | Site intent, NAP/schema readiness, hub/link structure | GBP acceptance, map-pack, review count, pack ranking |
| **Search Console** | Local-intent demand, query/page alignment, CTR/position | Map-pack ranking or GBP performance |
| **GBP observed** | Profile/completeness/engagement **only** via verified read adapter or trusted export | Anything when adapter is absent — use `unknown` |
| **External citations** | (none in V1) | No NAP/citation consistency claims without verified external data |

### Local entity inventory

Bounded static inventory of business name, founder credentials, locality/region, service areas, LocalBusiness/Organization schema, Concierge + Whispered Praise routes, Charlotte Guides routes, and local metadata signals. Each field carries presence, normalized value, source, consistency, confidence, sensitivity, and whether external verification is required. No secrets or customer PII.

### GBP intelligence model

Typed snapshot in `lib/agent-os/search/local/gbp.ts` with source states `observed` | `partially-observed` | `not-configured` | `unavailable` | `unknown`. Dimensions (category, hours, reviews, calls, directions, etc.) stay **unknown** without a verified adapter. Missing adapter ⇒ **unknown**, not “incomplete profile.”

### Geography model

Explicit geographies: Charlotte, Waxhaw, Fort Mill, South Charlotte, Charlotte metro / regional, national. Intent kinds: city-name, near-me, regional service, branded location, venue/neighborhood, local informational, local commercial. Charlotte vs South Charlotte and Charlotte + nationwide are treated as **complementary** unless a true contradiction appears.

### Local-intent classification & query-to-page alignment

Uses GSC when available. High-value conditions: non-branded local positions 4–15, high impressions/weak CTR, local query on mismatched/generic page, hub gaps, tool/Concierge handoffs. Small samples lower confidence or suppress findings. Does not infer physical-user location from query text alone. Does not auto-recommend a page for every city.

### Charlotte Guides hub logic

Assesses whether Charlotte Guides have a mapped hub, orphaned routes, guide→tool/Concierge links, and service-page relationships. Recommendations name source/destination routes — Agent OS does not create pages.

### Service-area consistency & schema readiness

Repository consistency across schema, metadata, Concierge, and guides. Distinguishes complementary geography from real contradiction. Schema findings use **readiness** language only — no Google eligibility claims. AggregateRating/Review schema is not recommended unless visible content and policy support it.

### Review / reputation & map-pack limits

Without verified GBP/review data: review count, rating, recency, and response coverage are **unknown**. Repository testimonials ≠ GBP reviews. Map-pack analysis is readiness-only (`map-pack-readiness-signal` / `map-pack-data-unavailable`) — never ranking or visibility claims.

### GBP root source gap

Stable ID: `search-strategy:gbp:measurement-gap:google-business-profile`. One root recommendation replaces repetitive unknown-dimension priorities. Supporting unknown dimensions remain in JSON with `suppressRecommendation`.

### Cross-executive ownership

| Executive | Owns |
|-----------|------|
| Search Strategy | Local diagnosis, query/page alignment, GBP intelligence, schema/entity readiness |
| Content | Local founder conversations / educational production |
| Opportunity | Partnerships, bridal ecosystem, distribution, paid-search evaluation |
| BI | Calls/directions/GBP-click measurement, attribution, conversion integrity |
| Chief of Staff | Synthesis, priority, conflict resolution, founder brief (≤5 named) |

### Stable IDs

`search-strategy:local:<type>:<geography>:<subject>`, `search-strategy:repository:<type>:<subject>`, `search-strategy:gbp:measurement-gap:google-business-profile` — no PII, secrets, location IDs, or timestamps.

### Live-data limitations

Live mode uses live GSC when configured; uses a verified GBP adapter only if one exists (none in V1). Never uses fixture GBP or fixture local-query overlays. Degrades honestly when GSC/GBP unavailable. Repository-backed local findings still run.

### How Search Strategy feeds Chief of Staff

`runAgentOsBrief` invokes BI, Search Strategy, Content, and Opportunity, then Chief of Staff merges recommendations, deduplicates, ranks with the shared model, and prefixes executive titles (`[Search Strategy]`, `[Content]`, `[Opportunity]`) so the founder brief shows origin. Zero recommendations from an executive is a healthy outcome when evidence is thin. Unverified GBP dimensions and static repository gaps normally stay deferred; high-confidence local demand may surface within the 5-priority cap.

### Live data sources

- **Google Search Console** (read-only) via `lib/integrations/gsc.ts` when OAuth + `GSC_SITE_URL` are configured
- **Repository guide-authority adapter** (`lib/agent-os/search/guide-authority.ts`) inspecting `app/diamond-guide/articles.ts`, hub metadata, category map, FAQ schema wiring, and tool/Concierge links
- **Local Authority module** (`lib/agent-os/search/local/`) — entity inventory, geography, GBP readiness, local findings
- **GA4** may inform BI landings; Search Strategy does not invent GSC from GA4

Missing GSC lowers confidence and blocks GSC-derived opportunities — repository analysis still runs. Missing GBP never blocks Search Strategy.

### Search opportunity taxonomy

Typed categories in `lib/agent-os/search/types.ts` plus local-authority finding types in `lib/agent-os/search/local/types.ts`.

### GEO readiness logic

Scores answer-first openings, FAQ schema presence, tool interconnection, and related-link density. Labeled **readiness signals only** — never claimed AI-engine rankings or citations.

### Limits of inference

- No query×page Search Console matrix → mismatch/cannibalization stay cautious inferences
- Small samples reduce confidence
- Revenue never inferred from impressions
- “Publish more content” / “rank higher locally” / “get more reviews” without evidence is rejected by design

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

## Scheduling and persistence

### Persistence mission

Make Agent OS durable across repeated runs: record when executives ran, track source health and run quality, preserve stable findings/recommendations, prevent unresolved issues from being re-created as new items, track lifecycle and recurrence, and support daily/weekly/on-demand cadence **definitions** without executing email or external jobs yet.

Module: `lib/agent-os/persistence/`.

### Internal mutation boundary

Persistence may mutate **Agent OS operational state only** (run records, finding/recommendation lifecycle, cadence metadata). It must not mutate website content, customer data, GA4, GSC, GBP, social platforms, CRM, email, public files, content inventory outside Agent OS state, or source-system configuration.

### Storage adapters

| Adapter ID | Durability | Environments | Live eligible | Fixture eligible |
|------------|------------|--------------|---------------|------------------|
| `memory` | ephemeral | tests, fixture, explicit non-durable local | only with `allowNonDurableLive` | yes |
| `file-local` | local-durable under `tmp/agent-os/state/` | local/manual Node single-host only | **rejected for scheduled live** | yes |
| `durable-test` | test-durable (shared-backend CAS / atomic claim) | harness/tests with `allowDurableTest` | refused in production runtimes | yes |
| `supabase` | remote-durable (Postgres) | production / serverless scheduled live | yes when env configured | no |
| `unconfigured-production` | none | default when Supabase unset | no (explicit failure) | no |

**Retention:**
- State blob: runs capped at 50; deliveries capped at 100 (application-enforced).
- Claim rows **intended** retention: approximately 90 days.
- **Automatic purge: not yet enabled** — required before or shortly after scheduled-live activation.
- Rows contain operational metadata only (no secrets / raw recipients).
Apply `lib/supabase/agent-os-schema.sql` before production scheduled-live.

Local filesystem persistence is **not** production-safe on Vercel serverless. File-local never copies or streams new state directly over the only canonical file; it uses temp validation plus last-known-good backup recovery.

### Run / executive / finding / recommendation records

Typed records with `schemaVersion` (currently `2`): `AgentOsRunRecord`, `PersistedExecutiveRunRecord`, `PersistedFindingRecord`, `PersistedRecommendationRecord`, `AgentOsDeliveryRecord`. See `lib/agent-os/persistence/types.ts`.

### Lifecycle model

States used: `new`, `active`, `unchanged`, `improved`, `worsened`, `deferred`, `completed`, `resolved`, `superseded`, `stale`, `blocked`, `unknown`.

Rules (summary):

- **New** — first observation of a stable ID
- **Unchanged** — same root + equivalent fingerprint; not recreated
- **Improved / worsened** — only with healthy comparable sources and material fingerprint/severity/confidence change
- **Resolved** — verified absent/corrected with healthy sources (never because a source disappeared)
- **Stale** — healthy non-observation across freshness; never when sources were unavailable
- **Deferred / completed** — preserved across runs; completion does not auto-resolve the finding
- **Superseded** — canonical root replaces symptom IDs

### Reconciliation

After a fixture or live run (when persistence is enabled), the runtime sequence is:

1. Load prior persisted state
2. Run executives (evidence generation)
3. Project prior + current fingerprints → **recurrence eligibility**
4. Chief of Staff ranks full JSON, then surfaces founder brief **only from eligible IDs**
5. Persist reconcile with surfaced-count updates
6. Crash-resistant file-local save (temp → validate → last-known-good backup → promote → verify) or in-memory replace

Failed runs record status but **do not erase** prior findings. Persistence write failure is an explicit error and must not make the run appear fully successful when `requirePersistenceWrite` is set (default for live + `scheduled`). The founder brief does not depend on a write succeeding unless that flag is set.

### Evidence fingerprinting

`buildEvidenceFingerprint` hashes normalized material only (stable ID, root, evidence class, metric tokens, severity/confidence buckets, blockers/deps). Excludes timestamps, run IDs, ordering noise, volatile prose, and raw third-party payloads.

### Cadence definitions (no executor)

Cadences are modeled and evaluated only — no cron wiring, no email, no OS schedulers in this pass.

| Cadence ID | Scope | Frequency |
|------------|-------|-----------|
| `cos-daily-synthesis` | chief-of-staff | daily |
| `cos-weekly-founder-brief` | chief-of-staff | weekly |
| `bi-daily-source-health` | business-intelligence | daily |
| `bi-weekly-performance` | business-intelligence | weekly |
| `search-weekly-full` | search-strategy | weekly |
| `search-daily-source-health` | search-strategy | daily (low-cost) |
| `content-weekly-inventory` | content | weekly |
| `content-on-demand-after-publish` | content | on-demand |
| `opportunity-weekly-scan` | opportunity | weekly |
| `agent-os-on-demand` | agent-os | on-demand |

`evaluateCadence` returns reason codes: `due`, `not-due`, `minimum-interval`, `source-unavailable`, `degraded-allowed`, `dependency-stale`, `dependency-missing`, `already-running`, `disabled`, `manual-override`, `catch-up`, `timezone-window`.

Internal timestamps are **UTC**. Founder-facing cadence timezone is `America/New_York`.

### Freshness

Source-health windows are hours; weekly strategic analyses are days; Chief of Staff must not silently mix incompatible windows — partial synthesis only under an explicit degraded policy (`evaluateChiefOfStaffDependencyFreshness`).

### Founder-priority recurrence

Cooldown + lifecycle gates prevent repeatedly surfacing the same unchanged priority. Critical unresolved items are never permanently hidden. One root problem → at most one founder priority. Brief remains ≤5 named priorities.

### Fixture / live separation

- Fixture state never enters live storage
- Live refuses implicit memory; missing durable persistence fails explicitly via `unconfigured-production`
- In-memory live requires `allowNonDurableLive` and is labeled non-durable
- No fixture fallback for persistence

### Schema versioning

Unsupported future versions fail safely. Corrupted JSON fails safely. No destructive automatic migration. Minimal non-destructive cadence default fill is allowed on load.

### Non-goals (this pass)

- Gmail / non-Resend providers
- Public routes / dashboards
- CRM / Buffer / Calendar scheduling
- External writes outside Agent OS persistence + approved email delivery
- Fabricated persistence or delivery state

### Automated cadence + founder email delivery

Module: `lib/agent-os/cadence-delivery/`.

**Production durable store:** Supabase/Postgres via `SupabasePersistenceAdapter` (`adapterId: supabase`). Schema: `lib/supabase/agent-os-schema.sql` (`agent_os_persisted_state` + `agent_os_delivery_claims` with `UNIQUE(idempotency_key)`).

**Atomic reservation:** Postgres create-if-absent on `idempotency_key`; expired **`reserved`** lease reclaim (15m); expired **`sending`** becomes **`uncertain`** (never auto-reclaimed for send). Uncertain blocks automatic resend until CLI `--resolve-uncertain --as failed|sent --confirm`. Defense in depth: Resend documented `idempotencyKey` (24h) using the stable internal delivery key.

**Scheduled live** selects Supabase when configured; otherwise fails closed. `durable-test` is harness-only (refused in production).

**Cadences:** when no cadence id is passed, all due founder-brief cadences run in order (weekly before daily).

**Email config:** complete `AGENT_OS_EMAIL_*` pair → complete `INTELLIGENCE_EMAIL_*` pair → fail closed (no partial mixing).

**Cron:** `GET|POST /api/cron/agent-os-cadence` — auth before work; header secrets only; `Cache-Control: no-store`; not in `vercel.json` yet.

**Claim retention:** intended ~90 days; automatic purge not yet enabled (required before/shortly after scheduled-live).

**Production activation / rollback runbook:** see [`docs/agent-os-production-activation.md`](./agent-os-production-activation.md) (preparation checklist, schema verification, env rules, smoke test, cron enablement, rollback). Do not treat that document as authorization to activate.

```bash
npm run agent-os:cadence -- --dry-run --force
npm run agent-os:cadence -- --scheduled-live
npm run agent-os:cadence -- --resolve-uncertain --delivery-id del:… --as failed --confirm
```

### How to run with persistence

```bash
npm run agent-os:brief -- --fixture --persist
npm run agent-os:brief -- --fixture --persist-file
# live without configured durable store fails persistence explicitly:
npm run agent-os:brief:live -- --persist
```

## Decision Journal schema

Typed in `lib/agent-os/decision-journal.ts`. Fields include decision ID, recommendation ID, executive, date proposed, evidence snapshot, confidence, founder decision/rationale, owner, target date, outcome status, measured outcome, review date, lesson learned.

**Decision Journal production writes remain disabled.** `InMemoryDecisionJournal` is test/local-only. Agent OS scheduling persistence (above) is separate from Decision Journal founder-outcome storage.

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
- Agent OS GA4 weekly adapter does not yet retrieve `generate_lead` / Concierge form events → conversion status often `unknown` in live mode
- Live GA4 weekly adapter does not expose path/next-page transitions → journey next-step movement unknown until a verified path read exists
- See It On Your Hand / Analyze Sparkle lack journey events in repository
- CTA click samples can be small — percentage swings overstate urgency
- Revenue must never be inferred from traffic, Studio views, or impressions
- Charlotte Guides articles exist without a mapped category hub (repository finding)

## Next implementation phases

1. ~~BI Conversion & Measurement expansion~~
2. ~~Search Strategy Local Authority / GBP Intelligence~~
3. ~~Client Journey & Conversion Analysis~~
4. ~~Scheduling and persistence foundation~~ (run records, lifecycle reconciliation, cadence definitions — no email)
5. ~~Automated executive cadence + Chief of Staff brief assembly on schedule + founder email delivery~~
6. Optional GA4 read expansion for Concierge conversion events and/or path analytics — still read-only, no client tracking changes
7. Decision Journal durable store (still founder-gated writes)
8. Optional authenticated internal preview (separate from production hard-404 dashboard)
9. Optional LLM brief polish behind the existing provider interface
10. Optional verified Buffer / HubSpot-aggregate / paid-cost / remarketing-audience / GBP adapters (still read-only)
11. Optional production-durable Agent OS store (e.g. Supabase) behind the existing persistence interface — founder-gated

## Protected systems (do not touch from Agent OS)

Public site, Concierge, Diamond Studio, Analyze Sparkle, Size Studio, Supabase key handling, retention/cleanup crons, founder-dashboard auth/hard-404, GA4/GSC/HubSpot configuration, Buffer, GBP, Privacy Policy, Vercel env, production data.
