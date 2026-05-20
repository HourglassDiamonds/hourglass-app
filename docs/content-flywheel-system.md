# Content Flywheel — Hourglass Diamonds

Internal architecture document for how behavioral data, search signals, and client intelligence compound into authority content across every customer touchpoint.

---

## 1. Purpose

The Hourglass content flywheel exists to turn **signals into sustained authority**—not to publish for volume’s sake.

The goal is to convert:

- Behavioral data (how people use the site and Diamond Studio)
- Search data (what people query and where we win or lose)
- Market signals (macro tone, sentiment, competitive context)
- Customer questions (concierge, consultations, reviews)

…into **compounding content** that supports:

| Channel | Role |
|---------|------|
| **SEO** | Discoverability for high-intent jewelry and education queries |
| **GMB** | Local trust, photos, posts, and review narrative |
| **Social** | Proof, education, and emotional relevance (Instagram, reels) |
| **Email** | Nurture and The Ledger for considered audiences |
| **Consultations** | Prospects arrive warmer, better informed, and more aligned |

Each output should reinforce the same brand: calm guidance, custom craft, and permanence—not pressure or inventory churn.

This document is **planning and process only**. It does not change product code, routes, or live site behavior.

**Related internal docs:**

- `docs/diamond-studio-weekly-insight-system.md` — Studio GA4 → weekly insight
- `docs/gmb-review-flywheel-system.md` — Reviews and local authority

---

## 2. Core Inputs

Primary input systems feed the flywheel weekly (or as data becomes available).

| Input system | What it provides |
|--------------|------------------|
| **Diamond Studio analytics** | Shape, carat, finger size, coverage zone, orientation, skin tone, engagement, consultation CTA patterns |
| **Google Search Console** | Queries, impressions, CTR, pages gaining/losing visibility, indexing issues |
| **GA4 engagement data** | Page paths, engagement time, conversions, device split, entry/exit pages |
| **GMB insights** | Calls, directions, profile views, search keywords, photo views, review themes |
| **Concierge inquiries** | Project type, shape interest, direction, timeline, budget bands, recurring questions |
| **Ledger macro/sentiment signals** | Weekly editorial indices—pressure, information, materials, AI, infrastructure (tone for market context) |
| **Client questions** | Verbatim themes from calls, email, and post-sale conversations |
| **Reddit / forum observations** | Unfiltered language couples use (buying anxiety, scams, “is this too big,” lab-grown debates) |
| **Search trend shifts** | Seasonality, new query clusters, competitor content gaps, SERP feature changes |

**Principle:** No single input drives the week. **Synthesize**—one strong Studio signal plus one Search Console opportunity often beats five weak hunches.

---

## 3. Diamond Studio Signals

Use Diamond Studio GA4 events and dimensions (see `diamond-studio-weekly-insight-system.md`) to detect product-level interest.

| Signal type | Examples | Possible content response |
|-------------|----------|-------------------------|
| **Rising shape interest** | Spike in `shape_selected` for oval, emerald, marquise | Shape guide refresh, comparison post, reel on proportion |
| **Elongated ratio trends** | Oval / pear / marquise engagement with higher carat commits | “Length vs spread” education, finger coverage context |
| **East/west engagement** | `orientation_changed` toward `ew` on ovals | Short FAQ or visual on E/W vs N/S on finger |
| **Statement coverage behavior** | Users clustering in noticeable / statement / dramatic zones | Size confidence content, “how big is too big” calm framing |
| **Mobile interaction trends** | Higher mobile `studio_session_engaged`, different shape mix | Mobile-first page checks, shorter social cuts, simplified CTAs |
| **Consultation click behavior** | `consultation_cta_clicked` after specific shape + carat combos | Concierge prep, homepage or guide CTA copy tuned to that path |

Studio data answers **what people are exploring before they talk to us**—not what they bought.

---

## 4. Ledger / Macro Signals

The Ledger (`/ledger`) provides **editorial macro context**—not jewelry SKUs, but the emotional and economic weather around the client.

| Signal theme | Examples | Content tone implication |
|--------------|----------|---------------------------|
| **Uncertainty environments** | Pressure indices elevated, volatile news cycles | Reassurance, process clarity, no urgency hooks |
| **Consumer caution** | Spending restraint narratives | Value of guidance, long-term wear, quality over hype |
| **Quiet luxury preference** | Understated taste, anti-logo sentiment | Restraint in visuals and copy; craftsmanship over flash |
| **Permanence / trust messaging** | Heirloom, redesign, “done once” stories | Custom design, certification, relationship-led service |
| **AI / information fatigue** | Signal map, noise vs clarity themes | Plain-language guides, fewer jargon walls, human concierge |
| **Emotional tone guidance** | Warmth vs anxiety in macro week | Match social and email tone—calm anchor vs celebratory (proposal season) |

Ledger signals **set the mood** for the week’s GMB post, email subject lines, and whether to lead educational vs inspirational content.

---

## 5. Content Outputs

All downstream outputs should trace back to at least one core input.

| Output | Description |
|--------|-------------|
| **Diamond Guide articles** | Long-form education (`/diamond-guide`) — shapes, cut, color, size, certification, light performance, buying strategy |
| **Article refreshes** | Update stats, FAQs, internal links, and tone on pages losing traction or ranking for new queries |
| **FAQ additions** | Short blocks on high-exit or high-bounce pages; align with concierge repeat questions |
| **GMB posts** | Weekly local post—education, completed work, seasonal (see GMB flywheel doc) |
| **Instagram posts** | Feed posts: detail shots, process, client moments (with permission) |
| **Reels / short-form ideas** | 15–45s hooks from Studio insights, proposal emotion, “one thing we wish couples knew” |
| **Educational carousels** | Slide-by-slide guides (4–8 frames): shape compare, coverage zones, GIA basics |
| **Email newsletter ideas** | Ledger tie-in, new guide, Studio feature, quiet CTA to concierge |
| **Homepage messaging refinements** | Subtle copy tests on hero, credibility strip, studio portal—only when data supports |

**Anti-pattern:** Publishing the same topic across every channel the same day. **Stagger** and **vary format** so each channel feels native.

---

## 6. Weekly Content Questions

Answer these each week before assigning creation tasks.

1. **What are users interacting with most?**  
   Studio shapes/zones, top GA4 pages, GMB actions.

2. **What are users confused about?**  
   High bounce, short time-on-page, concierge “still exploring” themes, forum threads.

3. **What topics are gaining momentum?**  
   Search Console rising queries, new Reddit clusters, seasonal search upticks.

4. **What emotional tone currently fits the market?**  
   Ledger + news environment + review sentiment (celebration vs caution).

5. **Which pages deserve upgrades?**  
   Declining URLs, thin sections, missing FAQs, poor mobile experience on high-traffic pages.

6. **Which topics could attract backlinks?**  
   Original data (Studio aggregates anonymized), tools, definitive comparisons, local Charlotte resource angles.

7. **Which content should become “reference assets”?**  
   See Section 7—pick one candidate per quarter, not seven per week.

---

## 7. Reference Asset Strategy

A **small set** of Diamond Guide (and select site) pages should become **canonical references**—the pages we want to rank, cite, and link to for years.

Invest disproportionately in:

| Element | Why |
|---------|-----|
| **Visuals** | Custom diagrams, finger coverage, shape comparisons—not stock-only |
| **Charts** | Carat vs mm, zone bands, shape aspect—sourced from Studio logic where honest |
| **Calculators** | Diamond Studio as the live calculator; guide pages explain how to use it |
| **Diamond Studio integration** | Clear paths from guide → studio → concierge |
| **FAQs** | Structured Q&A matching real concierge and search queries |
| **Comparison tables** | Shape vs shape, lab vs natural (neutral), setting styles |
| **Internal linking** | Hub/spoke from guide index, related articles, homepage portal |
| **Schema optimization** | FAQ, Article, Breadcrumb where appropriate—implemented in code when prioritized |

**Candidate reference themes (examples):** diamond size on finger, oval vs round presence, certification (GIA), light performance, buying strategy for custom rings.

**Rule:** One reference asset upgraded deeply beats ten shallow new posts.

---

## 8. Weekly Workflow

Standard operating loop (internal rhythm).

```text
┌─────────────────┐
│ Collect signals │  Studio, GSC, GA4, GMB, concierge, Ledger, forums
└────────┬────────┘
         ▼
┌─────────────────┐
│ Summarize       │  1-page insight: top 3 signals + tone
│ insights        │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Identify        │  Map signals → outputs (guide, GMB, social, email)
│ opportunities   │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Publish /       │  Ship or refresh; one reference touch if scheduled
│ update content  │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Monitor         │  Rankings, engagement, reviews, consultation volume
│ performance     │
└────────┬────────┘
         ▼
┌─────────────────┐
│ Feed results    │  What worked → next week’s inputs
│ back            │
└─────────────────┘
```

**Time budget (suggested):** Signal collection and summary ~30–45 min; opportunity mapping ~15 min; creation is separate craft time.

---

## 9. Future Automation Opportunities

Document for later agents or workflows—**not in production today**.

| System | Function |
|--------|----------|
| **Automated insight summaries** | Weekly roll-up: Studio + GSC + GMB one-pager |
| **Content idea agents** | Propose 3 guide topics, 2 reels, 1 GMB post from signals |
| **GMB draft generation** | Draft post + reply suggestions; human approves |
| **SEO opportunity detection** | Striking distance keywords, cannibalization flags |
| **Backlink opportunity identification** | Local press, podcasts, supplier/education partners |
| **Trend shift alerts** | Query spike / drop notifications vs 28-day baseline |

Automation should **draft and alert**; brand voice and factual claims stay human-reviewed.

---

## 10. Rules

- **Documentation only.** Do not treat edits here as a request to change routes, APIs, UI, styling, HubSpot, analytics code, or production logic.
- **Accuracy over speed** — jewelry claims must be defensible; no fabricated reviews or metrics in content.
- **Align with brand** — calm, premium, personal; avoid discount language and fear-based urgency unless Ledger context explicitly supports caution framing.
- **Privacy** — never publish identifiable client data from concierge or analytics without consent.
- **Cross-link docs** — when Studio events or GMB process change, update this file and sibling docs in the same change set.

---

*Internal use — Hourglass Diamonds content and growth planning.*
