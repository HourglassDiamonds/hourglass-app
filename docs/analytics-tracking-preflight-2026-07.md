# Analytics & Attribution Preflight Audit — July 2026

**Scope:** Report-only investigation of analytics, attribution, conversion tracking, and search-platform readiness before the first coordinated social/video launch.  
**Date:** 2026-07-21  
**Constraint:** No application source, config, dependency, environment-variable, or external-account changes were made during this audit (this document is the sole deliverable).  
**Evidence standard:** Findings cite file paths and code behavior. Claims that cannot be confirmed from the repository are labeled **Cannot verify**.

---

## A. Executive summary

### Current state

Hourglass uses **direct GA4 via `gtag.js`**, loaded globally from the root layout. There is **no Google Tag Manager container**, no Meta/LinkedIn/TikTok pixels, and no `@vercel/analytics` / Speed Insights packages in `package.json`. A first-party **sessionStorage attribution layer** captures UTMs and CTA context and attaches them to Concierge submissions (and HubSpot source lines). Concierge lead events fire only after a **confirmed server soft-accept** (`accepted === true`). Diamond Size Studio has a substantial event surface; Analyze Sparkle (Diamond Intelligence) and See It On Your Hand (Shape Studio) have **almost no journey events**.

### What is working

- Global GA4 script injection when `NEXT_PUBLIC_GA_ID` is set (`app/shared-components/GoogleAnalytics.tsx`, `lib/gtag.ts`).
- App Router client navigations send `page_path` updates via `usePathname` / `useSearchParams` (`GoogleAnalytics.tsx` → `pageview()`).
- Commercial CTA click tracking via `consultation_cta_clicked` (`lib/consultation-cta.ts`) across marketing surfaces.
- Concierge funnel: `concierge_form_started`, validation/submit errors, `concierge_form_submitted` + `generate_lead` only on confirmed acceptance (`lib/concierge/analytics.ts`, `app/concierge/concierge-page-client.tsx`).
- First-touch UTM persistence and form handoff (`lib/attribution.ts`) with PII sanitization tests (`lib/attribution.test.ts`).
- Conversations video milestones and related-resource / concierge clicks (`lib/conversations/analytics.ts`).
- Technical SEO foundations: `SITE_URL`, canonicals, `app/robots.ts`, `app/sitemap.ts`, structured data helpers.
- Privacy page discloses analytics + session attribution without claiming names/emails go to analytics (`app/privacy/page.tsx`).

### Most important deficiencies

1. **Likely duplicate `page_view` on first load** — initial `gtag('config')` plus immediate `pageview()`/`config` from `useEffect` with no `send_page_view: false`.
2. **Sensitive query strings can enter GA4 `page_path`** — Diamond Intelligence → Concierge links include report numbers, listing URLs, grades, etc., and page views include the full query string.
3. **No journey measurement for Analyze Sparkle or See It On Your Hand** — only Concierge CTA clicks on DI; Shape Studio has zero gtag calls.
4. **No environment separation** in code for development / preview / production GA traffic.
5. **Phone/email click events missing**; no calendar booking journey in the app.
6. **`home_clicked` is typed and ingested by Intelligence but never fired** in UI code.
7. **No cookie banner / Consent Mode** implementation (policy review may still be needed; not a legal conclusion).

### Launch risk

**Medium.** You can measure landing traffic and Concierge leads with the stack you already have, but first-load page-view inflation, DI query leakage into GA, and missing tool funnels will weaken campaign ROI and tool-performance decisions during `hg_conv_01`.

### Recommended next action

Review this report, then approve a **foundational fix pass only**: dedupe page views, strip/redact sensitive query params from `page_path`, and optionally gate client GA to production. Do **not** expand event inventory until that pass is validated in GA4 DebugView.

### Readiness scores (out of 10)

| Area | Score | Why |
|------|------:|-----|
| Basic analytics | **7** | Direct GA4 + App Router page paths exist; first-load duplication and env mixing remain. |
| Conversion tracking | **6** | Confirmed Concierge lead path is strong; CTA clicks are intent, not conversions; phone/email/booking gaps. |
| Campaign attribution | **7** | First-party UTM capture + HubSpot source line is restrained and useful; GA last-click still depends on URL/session survival. |
| Search Console readiness | **6** | Sitemap/robots/canonicals are solid in-repo; HTML verification and live property config cannot be confirmed here; GSC API ingest is optional/ops. |
| Diamond Studio journey measurement | **4** | Size Studio is instrumented; Intelligence and Shape Studio funnels are largely unmeasured. |
| Privacy / data safety | **5** | Attribution sanitization and privacy copy are good; full query strings in `page_path` and no Consent Mode are material risks. |
| **Overall launch readiness** | **6** | Commercial lead measurement is usable; tool + privacy hygiene must improve before trusting launch analytics. |

---

## B. Current architecture map

```
Visitor
  → Next.js App Router (app/layout.tsx)
      → GoogleAnalytics client component (always mounted)
          → if NEXT_PUBLIC_GA_ID set:
               Script: googletagmanager.com/gtag/js?id=<measurement id>
               Inline: dataLayer + gtag('js') + gtag('config', id, { anonymize_ip: true })
          → AnalyticsPageView effect on every pathname/searchParams change:
               captureAttributionFromLocation(pathname, query)  → sessionStorage hg_attribution_v1
               pageview(pathname[?query]) → gtag('config', id, { page_path, anonymize_ip })
      → Page / tool UI
          → lib/gtag.event(...) via thin helpers
               → GA4 custom events (browser)
      → Concierge form (success path)
          → attribution fields on FormData
          → POST /api/concierge
          → on accepted===true: concierge_form_submitted + generate_lead
          → server: HubSpot + email with sanitized attribution lines

Parallel (server-only, not visitor tracking):
  Weekly Intelligence cron → GA4 Data API (@google-analytics/data) + optional GSC API
  → Supabase + Resend (docs/intelligence-engine-setup.md)
```

### Cannot verify from the repository

- Whether production/preview Vercel env currently sets `NEXT_PUBLIC_GA_ID`, and to which property.
- Whether GA4 already marks `generate_lead` (or others) as key events.
- Whether Google Search Console is verified (no `google-site-verification` meta or HTML file in repo).
- Whether Vercel domain redirects apex ↔ `www` preserve query strings (both hostnames appear in ops artifacts; redirect logic is not in `next.config.ts` / `vercel.json`).
- Live Buffer / YouTube / social pixel configurations (none present in code).
- Whether ad blockers or ITP materially suppress gtag in production traffic.

---

## C. Verified integration inventory

| Integration | Status | File evidence | Environment dependency | Duplication risk | Notes |
|-------------|--------|---------------|------------------------|------------------|-------|
| GA4 (`gtag.js`) direct | **Present** | `app/shared-components/GoogleAnalytics.tsx`, `lib/gtag.ts`, `app/layout.tsx` | `NEXT_PUBLIC_GA_ID` | **High on first load** (config + effect); medium if component remounted | Loaded globally when ID set; `strategy="afterInteractive"` |
| `dataLayer` | **Present** (gtag bootstrap only) | `GoogleAnalytics.tsx` inline script | Same | Low | Not used as a custom event bus beyond gtag |
| Google Tag Manager container | **Absent** | No `GTM-` IDs; gtag URL is measurement-id loader | — | — | Do not assume GTM |
| `@next/third-parties` GA | **Absent** | Not in `package.json` | — | — | Custom Script approach instead |
| Vercel Analytics | **Absent** | Not in `package.json` | — | — | |
| Vercel Speed Insights | **Absent** | Not in `package.json` | — | — | |
| Meta Pixel | **Absent** | No `fbq` / pixel IDs | — | — | |
| LinkedIn Insight | **Absent** | No Insight Tag | — | — | |
| TikTok Pixel | **Absent** | No `ttq` | — | — | |
| Microsoft Clarity / Hotjar / etc. | **Absent** | No matching libraries | — | — | |
| First-party attribution | **Present** | `lib/attribution.ts`, wired in `GoogleAnalytics.tsx` + Concierge | sessionStorage | Low | First-touch UTMs; last CTA overwrites |
| GA4 Data API (Intelligence) | **Present (server)** | `lib/integrations/ga4.ts`, OAuth helpers | `GA4_PROPERTY_ID`, Google OAuth vars | N/A (server pull) | Not visitor tagging |
| Search Console API ingest | **Optional / pending ops** | `lib/integrations/gsc.ts`, docs | `GSC_SITE_URL` + OAuth scopes | N/A | Dashboard copy still notes pending in places |
| Cookie / Consent Mode | **Absent** | No Consent Mode APIs; privacy page text only | — | — | Scripts load when ID present |
| HubSpot (CRM, not analytics) | **Present (server)** | `app/api/concierge/route.ts` | `HUBSPOT_ACCESS_TOKEN` / alias | — | Receives attribution lines |

---

## D. Event inventory

### Existing events (verified)

| Event | Current status | Existing trigger | Recommended trigger | Parameters (today) | Key vs supporting | Risk / notes |
|-------|----------------|------------------|---------------------|--------------------|-------------------|--------------|
| Automatic `page_view` (gtag config) | Active when GA ID set | Initial `gtag('config')` | Keep one source of truth | Default GA params | Supporting | Likely duplicates with manual config |
| Manual `page_view` via `config` + `page_path` | Active | Path/search change effect | Same; disable auto on init | `page_path` may include query | Supporting | Query may contain report/listing data |
| `consultation_cta_clicked` | Active | Begin Conversation / Concierge CTAs | Keep as **supporting** intent | `location`, `destination`, `page_path` | Supporting (not conversion) | Closest match to proposed `begin_conversation_click` |
| `concierge_form_started` | Active | First meaningful form interaction (session-deduped) | Keep | `page_path` | Supporting | Name differs from proposed `concierge_form_start` |
| `concierge_form_error` | Active | Client validation fail or submit error | Keep | `reason`, `page_path` | Supporting | Do not mark as conversion |
| `concierge_form_submitted` | Active | After `accepted === true` | Keep | project/budget/timeline/source/tool/campaign | **Key candidate** | Confirmed success; honeypot excluded |
| `generate_lead` | Active | Same as submitted | Keep as **primary key event** | Same + `campaign_name` | **Key event** | GA4 recommended event; must be marked in GA4 admin |
| `diamond_studio_view` | Active | Size Studio mount | Keep as start proxy | shape/carat/finger/skin/orientation/coverage/device | Supporting | Once per mount |
| `shape_selected` | Active | Shape change | Keep restrained | Studio props | Supporting | Meaningful |
| `carat_changed` / `finger_size_changed` | Active | Commit (not every tick, per docs) | Keep supporting only | Studio props | Supporting | Do not key-event |
| `coverage_zone_changed` | Active | Debounced zone change | Keep | Studio props | Supporting | |
| `orientation_changed` / `skin_tone_selected` | Active | Selection change | Keep | Studio props | Supporting | |
| `studio_session_engaged` | Active | 45s **or** 5 meaningful interactions (once) | Closest to “complete engagement” | + `engagementTrigger` | Supporting / soft key | Not a commercial conversion |
| `consultation_cta_clicked` (from studio) | Active via shared helper | Editorial CTA | Keep | location string | Supporting | Studio type lists extra `source`/`placement` but helper does not send them |
| `home_clicked` | **Typed only — not fired** | — | Fire from suite home control **or** remove from Intelligence list | — | — | Dead event / false Intelligence signal |
| `ring_studio_cta_clicked` | Active | Engagement Rings “Explore the Ring Studio” | Supporting | `location`, `destination`, `page_path` | Supporting | Scroll anchor, not Concierge |
| `custom_design_motion_clicked` | Active | Finished-piece motion card | Supporting | `page_path` etc. | Supporting | |
| `conversation_video_started` / `_progress` / `_completed` | Active | Mux player | Keep for campaign content | slug, season, episode, provider, milestone | Supporting | Milestone dedupe per page view |
| `conversation_related_resource_clicked` | Active | Related article/tool | Supporting | destination_type/path | Supporting | |
| `conversation_concierge_clicked` | Active | Episode Concierge CTA | Supporting | destination concierge | Supporting | Builds `/concierge?tool=conversations&content=<slug>` |

### Priority proposed events vs reality

| Proposed | Status | Most accurate trigger location | Key or supporting | Useful params (non-PII) | PII / repeat risks |
|----------|--------|--------------------------------|-------------------|-------------------------|--------------------|
| 1. `begin_conversation_click` | **Exists as** `consultation_cta_clicked` | `lib/consultation-cta.ts` call sites | Supporting | `location`, `page_path` | Repeat on every click (expected) |
| 2. `concierge_form_start` | **Exists as** `concierge_form_started` | `markFormStarted()` in concierge client | Supporting | `page_path` | Session-deduped |
| 3. `concierge_form_submit` | **Exists as** `concierge_form_submitted` + `generate_lead` | After `accepted === true` | **Key** | project_type, budget_band, timeline, originating_tool, campaign | Do not add name/email/phone/notes |
| 4. `phone_click` | **Missing** | No public `tel:` links found in app UI (only mailto on Concierge intro) | Supporting if added | `page_path` | N/A today |
| 5. `email_click` | **Missing** | `app/concierge/concierge-intro.tsx` mailto | Supporting | `page_path` | Click ≠ reply |
| 6. Appointment booking | **Missing journey** | No Calendly/booking embed in repo | — | — | Appointment language is copy-only |
| 7–8. `diamond_studio_start` / `_complete` | **Partial** (`diamond_studio_view`, `studio_session_engaged`) | `app/diamond-studio/page.tsx` | Supporting | deviceType, shape | “Complete” is engagement, not purchase |
| 9–10. Analyze Sparkle start/complete | **Missing** | `processFile` start / `applyInterpretation` success in `diamond-intelligence-client.tsx` | Start supporting; complete **soft key** | lab (if known), shape, success/partial flag — **not** report number | Avoid filename/report/URL |
| 11–12. See It On Your Hand start/complete | **Missing** | Shape Studio entry / `calibrated-preview` step | Start supporting; complete **soft key** | entry_path=`qr`\|`local`, device | Avoid session IDs / image URLs |
| 13. Tool selected | **Partial** (Size Studio shapes only) | Shape selectors | Supporting | tool_id, shape | |
| 14–15. Certificate upload / analysis complete | **Missing** | `ReportUploadDock` / `processFile` | Soft key on success | result_state, lab | No report #, no file name |
| 16–17. Mobile capture session / image received | **Missing** | `usePhoneCaptureSession` create / `onImageReceived` | Supporting | entry=`cross_device` | No sessionId in GA |
| 18. Final preview reached | **Missing** | Shape Studio `calibrated-preview` | Soft key | shape, carat band | |
| 19. Report opened | **Missing / N/A as outbound** | DI results UI | Supporting if needed | lab | |
| 20. Outbound diamond-viewer click | **Not found** as tracked outbound | Listing URLs may appear in Concierge query `url=` | — | Prefer not to send full URLs to GA | Listing URL in page_path is a privacy risk |

---

## E. Funnel maps

### Begin the Conversation / Concierge

```
Entry: marketing CTA / header / footer / tools / conversations
  → consultation_cta_clicked (intent) + last_cta_location stored
  → /concierge land (page_view; attribution capture; optional DI/conversation query prefill)
  → form start → concierge_form_started (once/session)
  → validation fail → concierge_form_error(reason=validation)  [not a conversion]
  → POST /api/concierge
      → honeypot soft-accept accepted=false → UI success look, NO lead events  [verified]
      → hard fail → concierge_form_error(reason=submit)
      → accepted=true → concierge_form_submitted + generate_lead  [confirmed conversion]
  → success UI (session flag prevents re-fire)
```

**Safest confirmed-success location (already implemented):** client branch requiring `data.accepted === true` after successful JSON (`app/concierge/concierge-page-client.tsx`), covered by `lib/concierge/hardening.test.ts`.

### Diamond Studio (Size Studio / `/diamond-studio`)

```
Entry: /diamond-studio (sitemap + suite nav)
  → diamond_studio_view
  → meaningful interactions (shape/carat/finger/skin/orientation/zone)
  → studio_session_engaged (time or 5 interactions)
  → optional consultation_cta_clicked → Concierge
Abandonment (inferable): bounce before engagement; engagement without CTA
Mobile vs desktop: deviceType param on events
Cross-device: N/A for this tool
Missing: explicit “complete” commercial event (by design, soft engagement only)
Dead: home_clicked never emitted
```

### Analyze Sparkle (Diamond Intelligence / `/diamond-intelligence`)

```
Entry: /diamond-intelligence
  → idle upload dock
  → file chosen → reading → checking → building → result OR error phases
  → optional Concierge CTAs (many locations) → consultation_cta_clicked
  → Concierge href may include report, grades, listing url, verdict (context for CRM; risky for GA page_path)
Existing tracking: CTA clicks only
Missing: start, upload, success/partial, failure kinds (non-PII), URL-ingest attempts if exposed
```

### See It On Your Hand (Shape Studio / `/diamond-shape-studio`)

```
Desktop entry: QR relay session create → phone /capture/[sessionId] → upload → desktop poll → image adopt
  → mark-card → mark-seat → frame → calibrated-preview
Narrow mobile: same-device camera / local photo → review gate → same calibration steps (no relay session)
Existing tracking: none (no gtag imports under app/diamond-shape-studio)
Missing: start, session created, image received, calibrated preview reached, Concierge handoff (if added later)
Capture routes: no robots metadata found under capture/ (indexing posture unclear)
```

---

## F. UTM readiness assessment

### What exists

- On every navigation, `captureAttributionFromLocation` stores **first-touch** `utm_source|medium|campaign|content|term`, landing path, referrer host/path, optional `tool`/`source` → `originating_tool`, and `content`/`article`/`slug` → `originating_content` (`lib/attribution.ts`).
- Concierge form merges attribution into FormData; API sanitizes again and formats HubSpot/email attribution lines (`app/api/concierge/route.ts`).
- Planned campaign shape (`utm_source=instagram|facebook|…`, `utm_medium=organic_social`, `utm_campaign=hg_conv_01`, `utm_content=full_episode|clip_01|…`) is compatible with sanitizer character rules (verified pattern allowance in `sanitizeAttributionValue`).

### Path from landing → conversion

1. Land with UTMs → sessionStorage first-touch (preserved across internal navigation).
2. GA4 receives campaign params via standard collection on the landing hit (and subsequent hits while session continues) — **standard GA behavior; cannot verify admin settings**.
3. Internal Next.js client navigations do **not** strip sessionStorage attribution.
4. At Concierge submit, attribution snapshot is available even if the address bar no longer shows UTMs.

### Risks / gaps

| Topic | Assessment |
|-------|------------|
| Redirects stripping UTMs | `/diamond-tech-suite` → `/diamond-studio` is a path redirect only (`next.config.ts`); query preservation is Next default but **should be smoke-tested**. Apex↔www is **Cannot verify** (Vercel/DNS). |
| Canonicalization stripping UTMs | Canonical tags use path-only alternates (`lib/seo/site-metadata.ts`); they do not rewrite the browser URL. |
| Internal navigation propagating UTMs into every URL | Links generally do **not** append UTMs; attribution relies on sessionStorage + GA session — good (avoids polluting internal links). |
| Overwriting first-touch | First UTM wins; later campaigns in same tab session do **not** overwrite — intentional for small-business first-touch. |
| Storing attribution helps? | **Yes, materially** for Concierge/HubSpot when SPA navigation clears the query string before submit. |
| GA `page_path` with full query | UTMs on `/concierge?...` are fine; **DI report/url params are not** (see Findings). |

### Restrained attribution model (recommended)

- Keep first-touch sessionStorage for CRM context (already built).
- Rely on GA4 for last-click / session campaign reports for ads/social.
- Do **not** build multi-touch enterprise models.
- Mark `generate_lead` as the sole commercial key event for launch; treat CTA clicks as funnel assists.
- Use consistent UTM taxonomy in Buffer/YouTube descriptions; no extra vendor required.

---

## G. Search and indexing assessment

| Item | Evidence | Assessment |
|------|----------|------------|
| Production hostname | `SITE_URL = https://www.hourglassdiamonds.com` (`lib/seo/site-metadata.ts`) | Consistent www preference in metadata/sitemap |
| `metadataBase` | `app/layout.tsx` | Set |
| Canonicals | `pageMetadata()`, tool layouts | Path-relative canonicals resolved via metadataBase |
| Open Graph URLs | Layouts + pageMetadata | Present; some OG images hardcode www host |
| `robots.ts` | Allow `/`, sitemap URL | Present |
| `sitemap.ts` | Core pages + guide + ledger + published conversations | Includes `/diamond-studio`, `/diamond-shape-studio`, `/diamond-intelligence`, `/concierge` |
| Accidental noindex | Executive dashboard, calibration library, draft conversation metadata | Intentional internal/draft protection |
| Shape Studio indexing | `app/diamond-shape-studio/layout.tsx` `index: true` | Public tool intentionally indexable |
| Capture session URLs | No robots metadata under `capture/` | **Risk:** ephemeral session URLs could be indexed if discovered — prefer `noindex` |
| Google site verification meta/file | None in repo | **Cannot verify** GSC verification method |
| GSC API | `GSC_SITE_URL` optional | Ops/ingest separate from Search Console UI verification |
| Parameterized URLs | Sitemap lists clean paths only | Good for GA4↔GSC comparisons |
| Preview indexing | No middleware; relies on Vercel + robots on specific routes | Preview protection **Cannot verify** from repo alone |

Anything that could muddy GA4↔GSC comparisons: mixed apex/www property choice vs `SITE_URL`; query-heavy Concierge URLs in GA landing pages; duplicate page_views inflating sessions.

---

## H. Findings ranked by priority

### Critical

#### H1 — Sensitive Concierge query parameters can enter GA4 `page_path`

- **Finding:** `AnalyticsPageView` sends `pathname?query` to `pageview()`. DI Concierge handoff builds query strings including `report`, `url`, grades, `sid`, etc.
- **Evidence:** `app/shared-components/GoogleAnalytics.tsx` L13–17; `lib/concierge/diamond-intelligence-context.ts` `buildConciergeHrefFromDiamondIntelligence`.
- **Business impact:** Certificate/report identifiers and listing URLs may land in GA4 — conflicts with privacy posture and stated privacy copy.
- **Recommended fix:** Send pathname-only (or allowlist UTM keys only) to `pageview`; keep full query for attribution capture separately.
- **Files likely affected:** `GoogleAnalytics.tsx`, possibly `lib/gtag.ts`.
- **External account work:** GA4 data deletion / filter review if historical leakage confirmed.
- **Regression risk:** Low if UTM allowlist preserved for debugging.
- **Validation:** Land `/concierge?report=TEST&utm_source=instagram` → Network/DebugView shows path without `report`.

#### H2 — Likely duplicate page views on initial load

- **Finding:** Inline `gtag('config')` does not set `send_page_view: false`; mount effect immediately calls `pageview()` → another `config`.
- **Evidence:** `GoogleAnalytics.tsx` L32–38 and L13–18; `lib/gtag.ts` `pageview`.
- **Business impact:** Inflated sessions/page views → broken launch baselines and CPA math.
- **Recommended fix:** Initial config with `send_page_view: false`, or skip first effect pageview when matching the automatic hit.
- **Files:** `GoogleAnalytics.tsx`, `lib/gtag.ts`.
- **External:** Compare DebugView before/after.
- **Regression risk:** Medium (must keep SPA navigations accurate).
- **Validation:** Hard refresh → exactly one `page_view`; client navigate → one new `page_view`.

### High

#### H3 — Analyze Sparkle and See It On Your Hand funnels unmeasured

- **Finding:** No gtag usage under Shape Studio; DI only tracks Concierge CTAs.
- **Evidence:** Grep across `app/diamond-shape-studio` (no matches); DI client `processFile` has no analytics calls.
- **Business impact:** Cannot attribute social traffic to tool completion or drop-off.
- **Recommended fix:** Add restrained start/success events only (see sequence).
- **Files:** new thin analytics helpers; `diamond-intelligence-client.tsx`; `shape-studio-view.tsx` / `use-phone-capture-session.ts`.
- **External:** Register custom dimensions if needed; do not key-event noisy steps.
- **Regression risk:** Low if fail-safe try/catch pattern reused.
- **Validation:** Complete one happy path per tool in DebugView.

#### H4 — No production/preview/dev separation for client GA

- **Finding:** Client sends whenever `NEXT_PUBLIC_GA_ID` is defined; no `VERCEL_ENV` / host guard.
- **Evidence:** `lib/gtag.ts` `canSend()`; `.env.example` documents public GA ID only.
- **Business impact:** Preview/local traffic can pollute production property.
- **Recommended fix:** Gate on production hostname or `VERCEL_ENV===production'`; use a separate GA property for preview if desired.
- **Files:** `lib/gtag.ts` / `GoogleAnalytics.tsx`; Vercel env config.
- **External:** Vercel Production vs Preview env values.
- **Regression risk:** Low.
- **Validation:** Preview deploy → no hits (or hits only to preview property).

#### H5 — Phone and email click conversions missing; no booking funnel

- **Finding:** Mailto on Concierge intro untracked; no `tel:` UI links found; no booking embed.
- **Evidence:** `app/concierge/concierge-intro.tsx`; Footer has no phone/email.
- **Business impact:** Incomplete commercial intent picture if email remains a path.
- **Recommended fix:** Track `email_click` on mailto; add `phone_click` only if a tel link ships.
- **Files:** `concierge-intro.tsx` (+ shared helper).
- **External:** None required for click events.
- **Regression risk:** Low.
- **Validation:** Click mailto → one event; no PII in params.

### Medium

#### H6 — `home_clicked` documented/ingested but never emitted

- **Evidence:** Type in `app/diamond-studio/analytics.ts`; listed in `lib/integrations/ga4.ts`; no UI fire site-wide.
- **Impact:** Intelligence weekly studio counts for this event stay zero / misleading.
- **Fix:** Wire or remove from Intelligence event list.
- **Files:** Size Studio UI and/or `lib/integrations/ga4.ts`.

#### H7 — Shape Studio capture routes lack explicit `noindex`

- **Evidence:** No robots metadata under `app/diamond-shape-studio/capture/`.
- **Impact:** Ephemeral session URLs could appear in Search Console noise.
- **Fix:** `robots: { index: false }` on capture layout/page.
- **Files:** capture `page.tsx` or layout.

#### H8 — Event naming inconsistency vs launch checklist names

- **Evidence:** `consultation_cta_clicked` vs `begin_conversation_click`; `concierge_form_started` vs `concierge_form_start`.
- **Impact:** Reporting confusion if Buffer/docs use proposed names.
- **Fix:** Prefer **keeping existing names** (already in Intelligence) and update launch docs — avoid dual events.

#### H9 — Diamond Studio engagement events are relatively chatty

- **Evidence:** Multiple supporting interaction events; documented in `docs/diamond-studio-weekly-insight-system.md`.
- **Impact:** Useful for weekly insight; dangerous if marked as key events.
- **Fix:** In GA4 admin, key-event only `generate_lead` (and maybe later tool completes). Keep studio interactions supporting.

#### H10 — GSC weekly ingest may still be pending in ops

- **Evidence:** `docs/intelligence-engine-setup.md`; dashboard stubs mention Search Console pending in places.
- **Impact:** Executive dashboard search metrics incomplete — not blocking public launch measurement.
- **Fix:** Ops: set `GSC_SITE_URL`, ensure OAuth scopes, verify with `scripts/verify-gsc-access.mjs`.

### Low

#### H11 — No CSP headers / middleware for script allowlisting

- **Evidence:** No `middleware.ts`; `next.config.ts` has no security headers.
- **Impact:** Not an analytics correctness bug; future hardening opportunity.
- **Fix:** Deferred; do not block launch.

#### H12 — Privacy page is accurate but Consent Mode absent

- **Evidence:** `app/privacy/page.tsx`; no Consent Mode code.
- **Impact:** May need policy/owner review for EU/CA visitors — not concluded here.
- **Fix:** Owner decision; implement only if required.

#### H13 — Documentation gap for launch measurement checklist

- **Evidence:** Studio weekly insight doc exists; no unified pre-launch checklist (this audit fills that).
- **Fix:** After implementation, add a short launch checklist derived from Section K.

---

## I. Code work versus external account work

### Repository implementation (later Cursor pass)

1. Deduplicate first-load page views; keep SPA path tracking.
2. Redact/allowlist query params in `page_path` (UTMs only).
3. Optional production-only GA gate.
4. Typed central event helper (wrap `lib/gtag.ts`) with shared sanitize limits.
5. `email_click` (and `phone_click` if tel links exist).
6. Restrained DI events: start, analysis_success/partial/error_kind.
7. Restrained Shape Studio events: start, mobile_session_created, image_received, calibrated_preview_reached.
8. Wire or remove `home_clicked`.
9. `noindex` on capture session routes.
10. Tests mirroring Concierge hardening style for “events only on success.”

### GA4 administration

- Confirm property receives production traffic only.
- Mark **`generate_lead`** as a key event (and decide whether `concierge_form_submitted` is redundant as key).
- Do **not** mark interaction spam (`carat_changed`, etc.) as key events.
- Register needed custom dimensions for studio params (see existing weekly insight doc).
- DebugView + Realtime validation; internal traffic filters; unwanted referrals.
- Data retention / retention of user-level data review if query leakage occurred.
- **Cannot verify current key-event config from repo.**

### Google Search Console

- Confirm property matches `https://www.hourglassdiamonds.com` (or domain property covering both).
- Submit/verify sitemap `https://www.hourglassdiamonds.com/sitemap.xml`.
- Monitor capture URLs if any appear; fix with noindex.
- Optional: wire `GSC_SITE_URL` for Intelligence ingest.

### Google Tag Manager

- **Not present and not required** for current architecture. Skip unless a future multi-pixel requirement appears.

### Vercel

- Ensure `NEXT_PUBLIC_GA_ID` on Production; omit or use separate ID on Preview/Development.
- Confirm apex → www (or reverse) redirect preserves query strings.
- Deployment Protection for preview if indexing is a concern.

### Buffer / social platforms

- Apply UTM taxonomy on every profile link, caption link, and YouTube description.
- No in-repo Buffer integration to configure.
- Platform-native insights remain separate from GA4 (expected).

### Manual production validation

- Hard refresh + SPA navigation page_view counts.
- Concierge happy path + honeypot path (no lead).
- DI → Concierge URL without sensitive params in GA.
- One Shape Studio desktop QR path and one mobile local path.
- Conversations video milestones for `hg_conv_01` content.

---

## J. Recommended implementation sequence

1. **Fix foundational page-view accuracy + query redaction** (H1, H2, H4).
2. **Add typed central event utility** (thin wrapper; do not rename existing events yet).
3. **Confirm commercial conversions** — verify `generate_lead` in GA4; add `email_click` if desired.
4. **Add restrained Diamond Intelligence + Shape Studio funnel events** (start + success only).
5. **UTM / attribution** — keep current first-touch model; only patch if smoke tests show redirect loss.
6. **GA4 + Search Console account configuration** (key events, filters, sitemap, property match).
7. **Validate in development (no prod hits), preview, production**.
8. **Document launch measurement checklist** (Section K as living checklist).

---

## K. Proposed validation checklist

- [ ] Hard load `/` → **one** `page_view` in GA4 DebugView / Network (`collect` / `g/collect`).
- [ ] Client navigate `/` → `/diamond-studio` → **one** additional `page_view` with correct `page_path`.
- [ ] Land `/?utm_source=instagram&utm_medium=organic_social&utm_campaign=hg_conv_01&utm_content=clip_01` → sessionStorage has first-touch fields; Concierge submit includes them in HubSpot source (no PII).
- [ ] Concierge success (`accepted:true`) → exactly one `concierge_form_submitted` and one `generate_lead`.
- [ ] Honeypot / soft-accept → UI may succeed but **zero** lead events.
- [ ] Validation error → `concierge_form_error` only.
- [ ] Mailto click → `email_click` once (after implemented).
- [ ] Size Studio: `diamond_studio_view` once; `studio_session_engaged` once max.
- [ ] DI: start + complete events fire on success only (after implemented); failures do not look like completes.
- [ ] Shape Studio: start + calibrated preview (after implemented); no `sessionId` / image URL in payloads.
- [ ] Inspect event payloads: no name, email, phone, notes, report numbers, image URLs, session IDs.
- [ ] No duplicate commercial events on double-submit (leadTracked / session flags).
- [ ] Force gtag failure / adblock → Concierge and tools still complete (try/catch already present on helpers).
- [ ] GA4 DebugView (preview debug) and Realtime (prod smoke).
- [ ] Browser Network: single gtag.js load; no GTM container; no unexpected pixels.
- [ ] Production smoke after deploy with known UTM link from Buffer test post.

---

## L. Questions requiring owner input

1. Is the live production Measurement ID intended to receive **Preview** and local traffic, or Production only? (Repo cannot see Vercel env assignments.)
2. In GA4 today, which events are already marked as **key events**?
3. How is Search Console verified (DNS, HTML tag, HTML file), and is the property **URL-prefix www**, apex, or **Domain**?
4. Should email (`mailto:justin@…`) be treated as a secondary conversion path for launch, or Concierge-only?
5. For Analyze Sparkle / See It On Your Hand, is “success” defined as **result rendered** / **calibrated preview**, or only when the user later submits Concierge?
6. Any jurisdictions requiring a cookie banner / Consent Mode before enabling GA for the social launch audience?
7. Confirm whether apex `hourglassdiamonds.com` permanently redirects to `www` with query-string preservation (Vercel/DNS).

---

## Appendix — Environment variables (names only)

| Variable | Client-safe? | Referenced in | Missing handled? | Prod required for public GA? | `.env.example` |
|----------|--------------|---------------|------------------|------------------------------|----------------|
| `NEXT_PUBLIC_GA_ID` | Yes | `lib/gtag.ts`, `GoogleAnalytics.tsx`, `lib/intelligence/validate-env.ts` | Yes — scripts/events no-op | Yes for visitor analytics | Yes |
| `GA_CLIENT_ENABLED` | No (server) | `lib/analytics/client-enabled.ts`, root layout | Yes — Preview/local stay off | Opt-in only | Documented (commented) |
| `GA4_PROPERTY_ID` | No | Intelligence / `lib/integrations/ga4.ts` | Soft-fail weekly job | For Intelligence only | Yes |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REFRESH_TOKEN` | No | OAuth | Soft-fail | Intelligence / GSC ingest | Yes |
| `GOOGLE_OAUTH_REDIRECT_URI` | No | OAuth | Optional default | Optional | Commented |
| `GSC_SITE_URL` | No | `lib/integrations/gsc.ts` | Soft-fail / pending | Optional | Documented in intelligence-engine-setup (not in `.env.example` body) |
| HubSpot / Blob / Resend / Supabase / Cron | No | Concierge / Intelligence | Various | Concierge CRM separate from GA | Partial in `.env.example` |

**Do not print values.** Measurement ID format is `G-…` when set; presence is implied by code paths, not restated here from local env files.

---

## Appendix — Compatibility notes (Next.js App Router)

- Next.js `16.2.2` with App Router client navigation: pathname/searchParams effect is the correct pattern for SPA page views.
- `afterInteractive` Script loading is compatible and non-blocking relative to first paint vs `beforeInteractive`.
- Failures are caught in event helpers; analytics should not break Concierge or tools **if** new code follows the same try/catch + early-return pattern.
- Risk to Core Web Vitals: one third-party gtag script — typical; no duplicate vendor pixels found. Hydration: Suspense around `useSearchParams` is already used.

---

## Appendix — Pass 1 implementation (2026-07-21)

### Pre-implementation confirmations

1. **Automatic initial `page_view`:** Yes. The previous inline `gtag('config', id, { anonymize_ip: true })` did **not** set `send_page_view: false`, so GA4 sent an automatic page view on config.
2. **Manual initial `page_view`:** Yes. `AnalyticsPageView` called `pageview()` on mount via `usePathname` / `useSearchParams`, which previously issued another `gtag('config', …, { page_path })`.
3. **Full query representation:** Yes. The effect used `searchParams.toString()` and passed `` `${pathname}?${query}` `` into `pageview`.
4. **Sensitive DI → Concierge query keys:** `source`, `lab`, `report`, `carat`, `shape`, `color`, `clarity`, `cut`, `polish`, `symmetry`, `fluorescence`, `url`, `vendor`, `stype`, `verdict`, `sid` (`lib/concierge/diamond-intelligence-context.ts`). Conversations also uses `tool` and `content`.
5. **UTM persistence elsewhere:** Yes. `lib/attribution.ts` first-touch sessionStorage (`hg_attribution_v1`), still fed the **raw** query via `captureAttributionFromLocation` (unchanged).
6. **Env delivery of measurement ID:** `NEXT_PUBLIC_GA_ID` is client-bundled whenever set in the deployment env. There was **no** Preview/local gate — Preview with the production ID would load gtag.

### Files changed

| File | Change |
|------|--------|
| `lib/analytics/sanitize-page-location.ts` | **New** — allowlisted page_path / page_location sanitizer |
| `lib/analytics/sanitize-page-location.test.ts` | **New** — sanitizer tests |
| `lib/analytics/client-enabled.ts` | **New** — server enablement (`VERCEL_ENV` / `GA_CLIENT_ENABLED`) |
| `lib/analytics/client-enabled.test.ts` | **New** — enablement tests |
| `lib/gtag.ts` | Manual `page_view` event; arm/config helpers; dedupe; no config-per-navigation |
| `lib/gtag.test.ts` | **New** — page-view ownership tests |
| `app/shared-components/GoogleAnalytics.tsx` | Single controller; `enabled` prop; gtag.js only; attribution always |
| `app/layout.tsx` | Passes `enabled={isClientAnalyticsEnabled()}` |
| `lib/concierge/analytics.test.ts` | **New** — `generate_lead` behavioral + source contract |
| `.env.example` | Documents `GA_CLIENT_ENABLED` |
| `docs/analytics-tracking-preflight-2026-07.md` | This appendix + checklist |

### Final page-view ownership model

1. Server layout enables client GA only when `isClientAnalyticsEnabled()` is true.
2. When enabled, load `gtag/js` once (`afterInteractive`).
3. On first client effect: `configureGaWithoutAutomaticPageViews` → `gtag('config', id, { send_page_view: false, anonymize_ip: true })`.
4. Same effect (and later route changes): `pageview(pathname, rawQuery)` → one `gtag('event', 'page_view', { page_path, page_location })` per distinct sanitized path.
5. Module-level dedupe suppresses identical sanitized `page_path` repeats (rerenders / Strict Mode double-invoke).
6. **No** second `gtag('config')` on navigation.

**MANUAL — NOT COMPLETED IN CODE:** In GA4 Admin → Data streams → Web stream → Enhanced measurement → Page views → Advanced settings → disable **Page changes based on browser history events**.

### URL sanitization behavior

- Central helpers: `sanitizeAnalyticsPagePath`, `sanitizeAnalyticsPageLocation`, `buildAnalyticsPageViewParams`.
- Retains pathname; allowlists only `utm_id`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`.
- Drops fragments and all other query keys (including every DI/Concierge sensitive key above).
- Sets both `page_path` and `page_location` (canonical `SITE_URL` origin) so the full browser URL is not reintroduced.
- Does not rewrite `window.location`. Does not log removed values.
- `gclid` / `wbraid` / `gbraid` **not** allowlisted — current launch uses first-party UTMs; revisit only if Google Ads auto-tagging is adopted.

### Environment behavior

| Context | Client GA |
|---------|-----------|
| `VERCEL_ENV=production` + `NEXT_PUBLIC_GA_ID` set | **On** |
| Vercel Preview (default) | **Off** |
| Local `next dev` (default) | **Off** |
| Missing `NEXT_PUBLIC_GA_ID` | **Off** |
| Preview/local + `GA_CLIENT_ENABLED=1` + ID set | **On** (intentional DebugView) |

Events also require `armClientAnalytics()` from the loader — Preview builds that still embed `NEXT_PUBLIC_GA_ID` cannot dispatch without the loader arming.

### Tests added

- `lib/analytics/sanitize-page-location.test.ts`
- `lib/analytics/client-enabled.test.ts`
- `lib/gtag.test.ts`
- `lib/concierge/analytics.test.ts`

Existing `lib/attribution.test.ts` and `lib/concierge/hardening.test.ts` remain the attribution / honeypot contracts.

### What remains external / manual

See **Production validation checklist** below. Account-side GA4 Admin settings and production smoke results are recorded there; Vercel Preview isolation remains deferred.

### Deliberately deferred

- Diamond Studio / Analyze Sparkle / See It On Your Hand funnel events
- Phone/email click events, pixels, GTM, Vercel Analytics, Consent Mode
- Renaming `consultation_cta_clicked` / `concierge_form_started`
- Stripping sensitive params from the **browser** Concierge URL (CRM prefill still needs them)
- `home_clicked` wiring; capture-route `noindex`
- Vercel Preview → production GA isolation confirmation (await next normal Preview deploy)

---

## Production validation checklist (Pass 1)

**Validated:** production deploy after commit `de68ed7` (2026-07-21).  
**Not claimed from code alone** — results below were observed in GA4 / HubSpot / browser behavior by the owner.

| # | Check | Status |
|---|--------|--------|
| 1 | GA4 Enhanced Measurement → disable history-based page views | **Verified (manual GA4 Admin)** — browser-history page views OFF |
| 2 | GA4 URL query-parameter redaction for approved sensitive params | **Verified (manual GA4 Admin)** — redaction ON |
| 3 | GA4 email-address redaction (defense in depth) | **Verified (manual GA4 Admin)** — email redaction ON |
| 4 | One initial `page_view` per hard load | **Verified in production** |
| 5 | One additional `page_view` per client-side route change | **Verified in production** |
| 6 | Approved UTMs preserved on `page_location` and `page_path` | **Verified in production** |
| 7 | Sensitive params `report`, `url`, and `shape` absent from GA4 payloads | **Verified in production** |
| 7b | UTMs do not propagate onto internal page URLs | **Verified in production** |
| 8 | Ordinary Vercel Preview visit sends **no** production hits | **Deferred** — confirm on next normal Preview deployment |
| 9 | Confirmed Concierge submit → exactly one `generate_lead` | **Verified in production** — one `generate_lead`; no direct personal information in the event |
| 9b | Successful Concierge submission created expected HubSpot deal | **Verified** |
| 9c | Original campaign attribution persisted into HubSpot | **Verified** |
| 10 | Failed-validation Concierge path → no `generate_lead` | **Verified in production** — missing required fields kept the form in validation/error; GA4 fired `concierge_form_error` (`reason=validation`); no additional `generate_lead` (Tag Assistant retained only the earlier successful one); no personal information in the validation-error payload |

---

*Pass 1 code shipped (`de68ed7`). Production page-view, UTM, redaction, confirmed-lead, and failed-validation checks above are owner-verified. Preview isolation remains open until the next normal Preview deployment.*
