# Executive Dashboard — Hourglass Diamonds

Internal architecture document for a calm, executive-level view of business momentum, consumer behavior, content performance, and local authority.

---

## 1. Purpose

The executive dashboard system exists to give leadership a **single, readable pulse** on how Hourglass Diamonds is performing—without opening six tools or drowning in charts.

It should answer, at a glance:

- Is **momentum** building or softening this week?
- How are **consumers behaving** in Diamond Studio and on site?
- Is **content** earning attention and moving search visibility?
- Are **local authority signals** (GMB, reviews, calls) strengthening in Charlotte?

The dashboard is a **decision surface**, not a data warehouse. Every metric shown should tie to an action, a watch item, or a narrative in the weekly executive summary.

This document is **architecture and process only**. It does not implement a live dashboard in the app.

**Related internal docs:**

- `docs/diamond-studio-weekly-insight-system.md`
- `docs/gmb-review-flywheel-system.md`
- `docs/content-flywheel-system.md`

---

## 2. Core Dashboard Philosophy

Design and reporting principles for any future dashboard build (Looker, Notion, email digest, etc.).

| Principle | Meaning |
|-----------|---------|
| **Clean** | Generous whitespace, limited color, serif/sans hierarchy aligned with brand calm |
| **Minimal** | One screen or one page per weekly review—no 40-tab workbook |
| **Signal over noise** | Show deltas and trends; hide raw event counts unless they explain a shift |
| **Weekly trend awareness** | Default compare: vs prior week (and vs same week prior year when seasonality matters) |
| **Actionable insight only** | Every section ends with “so what” or recommended next step |
| **No vanity metric clutter** | No pageviews for their own sake; no social likes without context |

**Anti-patterns:** Dashboards that mirror GA4 default reports verbatim, duplicate the same KPI in five widgets, or require daily maintenance to stay truthful.

---

## 3. Primary Data Sources

| Source | Primary use in dashboard |
|--------|---------------------------|
| **GA4** | Traffic, engagement, paths, device split, key events site-wide |
| **Diamond Studio analytics** | Shape, carat, coverage, orientation, skin tone, session engagement, consultation CTA |
| **Google Search Console** | Queries, impressions, clicks, CTR, page performance, indexing |
| **Google Business Profile** | Reviews, calls, directions, profile views, posts, photos |
| **Concierge inquiries** | Volume, project type, shape/direction themes (form + API pipeline) |
| **HubSpot** | Contact growth, lifecycle stage, consultation outcomes (when CRM hygiene is solid) |
| **Ledger sentiment signals** | Macro tone for the week—pressure, information, materials, AI (editorial indices) |
| **Email subscriber growth** | Ledger signups (`/ledger`, API route)—list size and weekly net adds |

**Integration note:** Sources refresh on different cadences (real-time to 48h lag). Label “as of” dates on each block in the weekly summary.

---

## 4. Diamond Studio Metrics

Pull from GA4 custom events and dimensions (see `diamond-studio-weekly-insight-system.md`).

| Metric | Executive question |
|--------|---------------------|
| **Most interacted shapes** | What are people exploring before they inquire? |
| **Carat clustering** | Where is size appetite landing (e.g. 1.5–2.5 vs 3+)? |
| **Orientation trends** | Is E/W gaining share on elongated shapes? |
| **Coverage zone behavior** | Quiet vs balanced vs statement—confidence or boldness? |
| **Engagement depth** | `studio_session_engaged` rate; split by `engagementTrigger` (time vs interactions) |
| **Consultation click-through rate** | `consultation_cta_clicked` / `diamond_studio_view` (when CTA present) |
| **Mobile vs desktop interaction behavior** | Device-specific shape and zone patterns |

**Display tip:** Small multiples or one ranked table per week—avoid nine separate pie charts.

---

## 5. SEO Metrics

Primarily Google Search Console + GA4 landing page reports.

| Metric | Executive question |
|--------|---------------------|
| **Top landing pages** | What entry points earn organic attention? |
| **Organic traffic trend** | Week-over-week sessions from organic (GA4) |
| **Impression growth** | Are we visible more often, even if CTR lags? |
| **Keyword movement** | Winners/losers for Charlotte + education terms |
| **Top-performing articles** | Diamond Guide URLs by clicks and engagement |
| **Internal linking opportunities** | High-impression pages with weak CTR or orphan guides |

**Tie to content flywheel:** SEO block should feed “reference asset” and refresh priorities (see `content-flywheel-system.md`).

---

## 6. GMB Metrics

Google Business Profile insights + review monitoring (see `gmb-review-flywheel-system.md`).

| Metric | Executive question |
|--------|---------------------|
| **Review velocity** | New reviews per week; trend vs 4-week average |
| **Average rating** | Current rating; any new low-star risk |
| **Calls** | Click-to-call volume |
| **Direction requests** | Map/direction intent |
| **Local ranking movement** | Tracked local pack terms (manual or rank tracker) |
| **Photo uploads** | Fresh profile content |
| **Engagement trend** | Profile views, website clicks from GMB |

---

## 7. Concierge / Conversion Metrics

Concierge form submissions, HubSpot, and GA4 path analysis.

| Metric | Executive question |
|--------|---------------------|
| **Inquiry count** | Weekly concierge submissions |
| **Inquiry sources** | Referrer / landing page / campaign (UTM when used) |
| **Consultation conversion trend** | Inquiries → booked conversations (HubSpot) |
| **Top converting content/pages** | Last-touch or assisted paths before `/concierge` |
| **Repeat themes / questions** | Project type, shape, timeline, budget language from forms |

**Privacy:** Aggregate themes only on the dashboard—no PII in shared executive views.

---

## 8. Ledger / Macro Layer

Editorial indices from `/ledger`—**context layer**, not operational KPIs.

| Signal | How leadership uses it |
|--------|-------------------------|
| **Consumer confidence environment** | Pressure / materials indices → caution vs confidence in outward messaging |
| **Quiet luxury preference** | Tone for social, GMB, and homepage—understated vs loud |
| **Uncertainty tone guidance** | Avoid urgency hooks when macro week is noisy |
| **Macro temperature interpretation** | One-word week label: calm / elevated / mixed (human judgment + index summaries) |
| **Emotional tone calibration** | Match email, reels, and consultation prep to the week’s mood |

This block should be **short**—a paragraph plus index links, not a full Ledger reprint.

---

## 9. Weekly Executive Summary Structure

Reusable template for the human-readable layer above any future dashboard.

```markdown
# Hourglass Executive Summary
**Week of:** YYYY-MM-DD to YYYY-MM-DD  
**Prepared by:**  
**Data as of:**

---

## What changed this week
(3–5 bullets: only material deltas.)

---

## Consumer behavior shifts
(Diamond Studio + site engagement: shapes, carat, zones, device, consultation clicks.)

---

## Commercial interpretation
(What this means for demand, taste, and readiness to buy—not revenue forecasting unless data supports it.)

---

## SEO opportunities
(Queries, pages, striking distance, refresh candidates.)

---

## Content recommendations
(1–3 prioritized outputs: guide, social, email—linked to content flywheel.)

---

## GMB recommendations
(Reviews, post, photos, replies—linked to GMB flywheel.)

---

## Watch items
(Metrics or behaviors to recheck next week.)

---

## Risks
(Declining visibility, review gaps, form errors, data pipeline issues, reputation.)

---

## Momentum indicators
(Simple green/amber/red or ↑/↓/→ for: Studio engagement, organic, GMB, inquiries, subscribers.)
```

---

## 10. Future Dashboard Build

Implementation ideas—**not in production today**.

| Approach | Description |
|----------|-------------|
| **Looker Studio** | Connect GA4, GSC, GMB (where connectors allow); one executive page with weekly date control |
| **Notion dashboard** | Manual or semi-automated weekly paste from summaries; good for narrative + links |
| **Automated summaries** | Scheduled job or agent: pull KPIs → markdown block for Notion/email |
| **Weekly email digest** | Monday internal email: executive summary template auto-filled where possible |
| **AI insight layer** | Draft “commercial interpretation” and “watch items” from raw metrics—human approves |

**Build order (suggested):**  
1) Standardize weekly summary template (Section 9) in Notion.  
2) Add Looker for GA4 + GSC core charts.  
3) Automate Studio + concierge snippets.  
4) Optional AI narrative with strict human review.

---

## 11. Rules

- **Documentation only.** Do not treat edits here as a request to change UI, routes, APIs, HubSpot configuration, analytics code, or styling.
- **One source of truth per metric** — document which tool owns each number to avoid conflicting definitions week to week.
- **Honest gaps** — if a metric is manual (rank tracking) or not yet wired, label it; do not imply live automation.
- **Executive time** — target &lt;15 minutes to read the weekly summary; dashboard UI should support that, not fight it.
- Update this doc when a data source or KPI definition changes materially.

---

*Internal use — Hourglass Diamonds leadership and growth planning.*
