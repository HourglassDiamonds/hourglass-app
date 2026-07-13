# Executive Dashboard — Hourglass Diamonds

Founder operating system for market gravity: search authority, brand demand, consultation funnel, Diamond Studio behavior, local signals, and prioritized actions.

**Live route:** `/executive-dashboard` (internal, `noindex`)

**Access:** Production always returns `notFound()` — there is no environment flag that opens this route on the public domain. `robots: noindex` is SEO-only and is **not** access control. Local and other non-production environments remain available for internal review. Do not link this route from the public footer. Any future production exposure requires genuine authentication or confirmed Vercel Deployment Protection.

---

## 1. Purpose

Answer whether Hourglass is **gaining market gravity** — not only what happened on-site.

| Question | Section |
|----------|---------|
| Is momentum building? | Executive Summary (Weekly Signal) |
| Is search visibility compounding? | Search + Authority Momentum |
| Is brand recall growing? | Brand Demand |
| Are consultations accelerating? | Consultation Funnel |
| How are buyers exploring diamonds? | Diamond Studio Intelligence |
| What content earns entry? | Content Performance |
| Is Charlotte authority strengthening? | Local Authority / GMB |
| What should we do next? | Recommendation Engine |
| What macro tone fits outreach? | Ledger / Market Tone |

---

## 2. Architecture (required)

**Do not** call GA4, GSC, or GMB from the dashboard page at render time.

```
GA4 / GSC / GMB / Concierge / Ledger
        ↓
Intelligence ingestion (weekly job + manual test)
        ↓
Normalized snapshot → Supabase weekly_reports.raw_payload
        ↓
buildExecutiveDashboardPayload()
        ↓
ExecutiveDashboardView (display layer only)
```

| Layer | File | Role |
|-------|------|------|
| Snapshot types | `lib/intelligence/dashboard-snapshot.ts` | `DashboardIntelligenceSnapshot` — canonical weekly object |
| Display types | `lib/intelligence/dashboard-data.ts` | `ExecutiveDashboardData`, `ExecutiveDashboardPayload` |
| Mapping | `lib/intelligence/map-report-to-dashboard.ts` | Snapshot → UI fields + GA4 enrichments |
| UI | `app/executive-dashboard/dashboard-view.tsx` | Same shell; section order per strategy below |
| Ingestion | `lib/intelligence/weekly-report.ts`, `lib/integrations/ga4.ts` | GA4 today; GSC/GMB next |

Optional persistence: write `dashboardSnapshot` into `raw_payload` on each weekly run so history and agents read one object.

---

## 3. Dashboard section order

1. **Executive Summary** — Weekly Signal panel  
2. **Search + Authority Momentum** — GSC (pending)  
3. **Brand Demand** — branded queries (GSC pending)  
4. **Consultation Funnel** — GA4 live (sessions, `consultation_cta_clicked`, engagement)  
5. **Diamond Studio Intelligence** — GA4 partial + pending depth metrics  
6. **Content Performance** — GA4 landing pages partial  
7. **Local Authority / GMB** — static 5.0 rating; GBP API pending  
8. **Assisted Conversion Paths** — GA4 paths pending  
9. **Recommendation Engine** — rule-based from weekly report (partial)  
10. **Ledger / Market Tone** — narrative placeholder  

---

## 4. Metric groups (data model)

### 4.1 Search + Authority Momentum (`searchAuthority`)

Source: **Google Search Console** — `IntegrationStatus: pending`

- Total impressions, impressions WoW  
- Total clicks, clicks WoW  
- Average position, position movement  
- CTR trend  
- Indexed pages, newly indexed pages  
- Lists: top gaining/losing queries, top pages by impressions, fastest climbing, losing momentum  

### 4.2 Brand Demand (`brandDemand`)

Source: **GSC** with query filters — pending  

Tracked patterns (`BRAND_QUERY_PATTERNS` in `dashboard-snapshot.ts`):

- hourglass diamonds  
- hourglass diamonds charlotte  
- hourglass engagement rings  
- hourglass diamond studio  
- hourglass custom rings  

Metrics: branded impressions, clicks, CTR, brand WoW growth, non-brand vs brand split.

### 4.3 Consultation Funnel (`consultationFunnel`)

Source: **GA4** — live when weekly report exists  

- Weekly sessions  
- `consultation_cta_clicked` (Concierge Inquiries card)  
- CTA / studio view rate  
- Engaged session rate  
- Subscribers — HubSpot/Ledger not connected  

### 4.4 Diamond Studio Intelligence (`diamondStudio`)

Source: **GA4** — partial  

| Metric | Status |
|--------|--------|
| Studio visits (`diamond_studio_view`) | Live |
| Top shapes | Live |
| Orientation events | Live |
| Mobile share | Live |
| Carat cluster, coverage zone, finger size | Pending (events exist; aggregation TBD) |
| Return usage %, session depth, high-intent, repeat 7d | Pending |
| CTA pathing, drop-off | Pending |

### 4.5 Content Performance (`content`)

Source: **GA4** landing pages — partial (sessions, not GSC impressions)  

### 4.6 Local Authority / GMB (`localAuthority`)

Source: **GMB API** — pending except static 5.0 review average  

Profile views, website clicks, calls, directions, review velocity, unanswered items, post cadence, map pack trend.

### 4.7 Assisted Conversion Paths (`assistedPaths`)

Source: **GA4** path / funnel — pending  

Examples: Landing → Studio → Article → Concierge → Submit  

### 4.8 Recommendation Engine (`recommendations`)

Types: `PrioritizedRecommendation` in `dashboard-snapshot.ts`  

Future fields: `roiScore`, `confidenceScore`, `urgency`, `actionType`, `sourceMetric`  

Current: rule-based strings from `lib/intelligence/recommendations.ts` mapped to cards when a weekly report exists.

---

## 5. Source status labels (UI)

Every metric shows a `sourceLabel`:

- **GA4** — live from latest snapshot  
- **Pending · GSC** / **Pending · GMB** — integration not wired; value `—`  
- **Static** — verified 5.0 Google rating  
- **Not connected** — subscribers / CRM  

Never show fabricated numbers as live.

---

## 6. Weekly executive summary

Unchanged template in Section 9 of prior doc — narrative still generated by `buildRecommendationsAndSignals` and stored in `weekly_reports`.

---

## 7. Implementation roadmap

| Step | Work | Owner |
|------|------|-------|
| **Done** | Canonical `consultation_cta_clicked` sitewide | GA4 |
| **Done** | `DashboardIntelligenceSnapshot` + display payload | Code |
| **Done** | Dashboard sections + pending placeholders | UI |
| **Done** | `lib/integrations/gsc.ts` + weekly ingest into `raw_payload` | Backend |
| **Next** | Set `GSC_SITE_URL` + re-OAuth with `webmasters.readonly` in production | Ops |
| **Next** | Persist `dashboardSnapshot` in `raw_payload` on cron | Backend |
| **Next** | GMB Business Profile API | Backend |
| **Next** | GA4 path exploration for assisted conversions | Backend |
| **Later** | Scored recommendations (ROI, confidence) | Intelligence |
| **Later** | Ledger index → `ledger` section live | Editorial |

---

## 8. Rules

- Do not redesign the public site from this doc.  
- Do not change cron schedule or env from dashboard work.  
- One source of truth per metric — document in `dashboard-snapshot.ts`.  
- Target &lt;15 minutes to read the weekly dashboard.  

---

*Internal use — Hourglass Diamonds leadership and growth planning.*
