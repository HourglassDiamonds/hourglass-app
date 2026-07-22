# Hourglass Intelligence Engine — Setup & Testing

V1 backend for weekly GA4 intelligence, Supabase snapshots, Monday email briefs, and `/executive-dashboard` live data (GA4-powered sections; GMB/HubSpot/Ledger remain placeholder until wired).

---

## 1. Executive dashboard (founder OS — preserved UI shell)

| Item | Location |
|------|----------|
| Page route | `/executive-dashboard` → `app/executive-dashboard/(protected)/page.tsx` (auth required outside Vercel production; production 404s) |
| Visual components | `app/executive-dashboard/dashboard-view.tsx` (same cards; expanded sections) |
| Snapshot model | `lib/intelligence/dashboard-snapshot.ts` → `DashboardIntelligenceSnapshot` |
| Display + payload | `lib/intelligence/dashboard-data.ts` → `ExecutiveDashboardPayload` |
| Mapping | `lib/intelligence/map-report-to-dashboard.ts` → `buildExecutiveDashboardPayload()` |

**Architecture:** Ingestion → normalized weekly snapshot → display layer (no live GA4/GSC calls on page render).

**Plan:** `docs/executive-dashboard-system.md`

**Card structures (unchanged):** `WeeklySignalPanel`, `MetricCard`, `SectionPanel`, `ListPanel`, `InsightBlock`.

**Sections (strategic order):** Executive Summary → Search + Authority → Brand Demand → Consultation Funnel → Diamond Studio → Content → Local Authority → Assisted Paths → Recommendations → Ledger.

---

## 2. Supabase schema

Run `lib/supabase/schema.sql` in the Supabase SQL editor.

Tables: `weekly_reports`, `metric_snapshots`, `recommendations`, `content_opportunities`.

Access: **service role only** on server routes (no public RLS policies).

---

## 2b. Service role key rotation (required if exposed)

**Status:** A service role key was accidentally exposed during initial setup. Treat that key as **compromised**, rotate it, and use only the new secret going forward.

### Rotate safely in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **API**.
2. Under **Project API keys**, find **service_role** (`secret`).
3. Click **Reset** / rotate the service role key (confirm in the dialog).
4. Copy the **new** `service_role` value immediately — it is shown once.
5. **Do not** paste the service role into client code, `NEXT_PUBLIC_*` vars, screenshots, or git.

### Update secrets everywhere the old key lived

| Location | Action |
|----------|--------|
| `.env.local` | Set `SUPABASE_SERVICE_ROLE_KEY=` to the **new** key (file is gitignored) |
| Vercel → Environment Variables | Update `SUPABASE_SERVICE_ROLE_KEY` for Production/Preview/Development |
| Any notes / chat / tickets | Redact old key; do not store the new key in the repo |

6. Restart local dev (`npm run dev`) so Node picks up the new value.
7. Redeploy on Vercel after updating project env.
8. Optional: Supabase → **Logs** → review API activity for unusual access around the exposure window.

### Confirm the old key is gone from this repo

- Keys must **only** exist in `.env.local` and Vercel — never in source files.
- Run: `git grep -i "service_role" -- ':!.env.local'` (should only hit docs/types, not JWT strings).
- `.env.local` is listed in `.gitignore` (` .env*.local`) and must not be `git add`’d.

If the old key was ever committed to git, rotate in Supabase **first**, then remove it from history (e.g. `git filter-repo` / BFG) or treat the repository as leaked and rotate all related secrets.

---

## 3. Required environment variables

Set in Vercel (Production) and `.env.local` for local testing.

| Variable | Purpose |
|----------|---------|
| `GA4_PROPERTY_ID` | Numeric GA4 property ID (not measurement ID) |
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID (Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret — **server-only** |
| `GOOGLE_REFRESH_TOKEN` | Long-lived refresh token — **server-only**; obtain via OAuth setup below |
| `GOOGLE_OAUTH_REDIRECT_URI` | Optional; default `http://localhost:3000/api/intelligence/google-oauth-callback` |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-only** — full DB access; rotate if exposed; never `NEXT_PUBLIC_` |
| `RESEND_API_KEY` | Resend API key — **optional in local dev**; required for production email |
| `INTELLIGENCE_EMAIL_FROM` | Verified sender — optional locally |
| `INTELLIGENCE_EMAIL_TO` | Executive recipient — optional locally |
| `CRON_SECRET` | Required for cron + manual API (local example: `hgd_local_manual_test_secret`) |

### GA4 OAuth setup (replaces service-account auth)

Service-account access is **not** used. Authenticate with the Google user that already has GA4 property access.

1. Google Cloud Console → APIs → enable **Google Analytics Data API**.
2. Create **OAuth 2.0 Client ID** (Web application).
3. Authorized redirect URI (local):
   `http://localhost:3000/api/intelligence/google-oauth-callback`
4. Add to `.env.local`:
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GA4_PROPERTY_ID`
5. Obtain refresh token (pick one):
   - **A.** `GET http://localhost:3000/api/intelligence/google-auth-url` → open `authUrl` in browser → callback page shows `GOOGLE_REFRESH_TOKEN`
   - **B.** `node scripts/google-oauth-setup.mjs` → open printed URL
6. Paste `GOOGLE_REFRESH_TOKEN` into `.env.local`, restart `npm run dev`.

**Production:** Add the same OAuth vars in Vercel; use a production redirect URI on the OAuth client and set `GOOGLE_OAUTH_REDIRECT_URI` if different from local.

**Existing public GA:** `NEXT_PUBLIC_GA_ID` remains client-side only; intelligence uses the Data API via OAuth separately. Client gtag loads on Vercel Production when the ID is set. Local and Preview stay off unless server-only `GA_CLIENT_ENABLED=1` (intentional DebugView). See `docs/analytics-tracking-preflight-2026-07.md` Pass 1 appendix.

### Google Search Console (optional — weekly ingest)

Uses the **same** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN` as GA4. The refresh token must include Search Console scope:

`https://www.googleapis.com/auth/webmasters.readonly`

If GA4 OAuth was set up before GSC, re-run OAuth and replace `GOOGLE_REFRESH_TOKEN` with a token that includes **both** scopes:

1. `node scripts/verify-gsc-access.mjs` — if `sites.list` returns 403, re-consent is required.
2. `node scripts/google-oauth-setup.mjs` — open the printed URL (`analytics.readonly` + `webmasters.readonly`).
3. Copy the new refresh token into `.env.local` and Vercel Production (`GOOGLE_REFRESH_TOKEN` only — do not change client id/secret).
4. `node scripts/verify-gsc-access.mjs` again — should pass.
5. Redeploy, then run manual-test and `node scripts/check-latest-report-gsc.mjs`.

**Google Cloud Console:** APIs & Services → Library → enable **Google Search Console API** (same project as GA4).

| Variable | Purpose |
|----------|---------|
| `GSC_SITE_URL` | Exact property URL from Search Console (e.g. `https://hourglassdiamonds.com/` or `sc-domain:hourglassdiamonds.com`) |

**Google Cloud:** Enable **Google Search Console API** on the same project.

**Weekly job:** `fetchGscWeeklyBundle()` runs after GA4; failures log a warning and do **not** fail the report. Results are stored in `raw_payload.gsc` and `raw_payload.dashboardSnapshot` (Search + Authority, Brand Demand sections).

**Dashboard:** Reads stored snapshot only — no live GSC calls on `/executive-dashboard`.

---

## 4. Weekly flow

1. **Cron** (Vercel): `GET /api/cron/weekly-intelligence` — Mondays 13:00 UTC (`vercel.json`).
2. **Manual:** `POST /api/intelligence/weekly-report` with auth header.
3. Job pulls GA4 for last complete Mon–Sun week vs prior week.
4. Optionally pulls GSC (same weeks) when `GSC_SITE_URL` and OAuth scope are configured.
5. Builds summaries, opportunities, problems, recommendations, and `dashboardSnapshot`.
6. Saves to Supabase (`raw_payload` includes GA4, GSC, snapshot).
7. Sends Resend email.

---

## 5. Security

Cron and manual routes require **either**:

- `Authorization: Bearer <CRON_SECRET>`
- `x-cron-secret: <CRON_SECRET>`

Do not expose these endpoints without the secret. Do not commit secrets.

### Server-only vs client-safe env vars

| Variable | Client-safe? |
|----------|----------------|
| `NEXT_PUBLIC_GA_ID` | Yes — measurement ID only |
| `SUPABASE_URL` | **No** — server only |
| `SUPABASE_SERVICE_ROLE_KEY` | **No** — bypasses RLS; never in browser |
| `GA4_PROPERTY_ID` | **No** |
| `GOOGLE_CLIENT_ID` / `SECRET` / `REFRESH_TOKEN` | **No** |
| `RESEND_API_KEY` | **No** |
| `CRON_SECRET` | **No** |
| `INTELLIGENCE_EMAIL_FROM` / `TO` | **No** |
| `HUBSPOT_*` / `BLOB_READ_WRITE_TOKEN` | **No** |

On server startup, `instrumentation.ts` warns if intelligence env is missing and **throws** if any of the above are mistakenly prefixed with `NEXT_PUBLIC_`.

---

## 6. Testing checklist

### A. Supabase

- [ ] Run `lib/supabase/schema.sql`
- [ ] Confirm tables exist

### B. Environment

- [ ] GA4 OAuth vars set locally (refresh token obtained)
- [ ] Terminal shows `[hourglass:intelligence] GA4 OAuth connected` on first report run

### C. Manual job (local)

Set in `.env.local`:

```env
CRON_SECRET=hgd_local_manual_test_secret
```

Resend vars (`RESEND_API_KEY`, `INTELLIGENCE_EMAIL_FROM`, `INTELLIGENCE_EMAIL_TO`) are **optional in local development** — the job still pulls GA4, saves to Supabase, and returns `ok: true` with `emailSkipped: true`.

**PowerShell:**

```powershell
curl.exe -X POST "http://localhost:3000/api/intelligence/weekly-report" `
  -H "Authorization: Bearer hgd_local_manual_test_secret"
```

**curl (Git Bash / WSL):**

```bash
curl -X POST "http://localhost:3000/api/intelligence/weekly-report" \
  -H "Authorization: Bearer hgd_local_manual_test_secret"
```

Expected success shape:

```json
{
  "ok": true,
  "reportId": "<uuid>",
  "source": "ga4",
  "weekStart": "YYYY-MM-DD",
  "weekEnd": "YYYY-MM-DD",
  "emailSent": false,
  "emailSkipped": true
}
```

- [ ] Response `ok: true` with `reportId`
- [ ] Row in `weekly_reports`
- [ ] `/executive-dashboard` shows live GA4 week (not placeholder footer)
- [ ] Terminal: `Email skipped — Resend env vars missing in local development.` (if Resend not configured)
- [ ] Email received (only after Resend vars are set)

### D. Dashboard

- [ ] Open `/executive-dashboard`
- [ ] Header shows `Internal · GA4 week of …` when a report exists
- [ ] Traffic + Studio + landing sections reflect GA4; local/ledger/subscribers may still show placeholder

### E. Production (Vercel)

**Required in Vercel → Settings → Environment Variables (Production):**

| Variable | Required for deploy? | Notes |
|----------|----------------------|--------|
| `SUPABASE_URL` | Yes | Same project as `schema.sql` |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-only; never `NEXT_PUBLIC_` |
| `GOOGLE_CLIENT_ID` | Yes | OAuth Web client |
| `GOOGLE_CLIENT_SECRET` | Yes | Server-only |
| `GOOGLE_REFRESH_TOKEN` | Yes | Paste from local OAuth setup; server-only |
| `GA4_PROPERTY_ID` | Yes | Numeric property ID |
| `CRON_SECRET` | Yes | Long random string; Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically |
| `RESEND_API_KEY` | No* | *Job still runs; email skipped with warning if missing |
| `INTELLIGENCE_EMAIL_FROM` | No* | Required with Resend for email |
| `INTELLIGENCE_EMAIL_TO` | No* | Required with Resend for email |
| `GOOGLE_OAUTH_REDIRECT_URI` | No | Only if re-running OAuth in prod; callback route is disabled in production |

**Deploy checklist:**

- [ ] Run `lib/supabase/schema.sql` on production Supabase project
- [ ] Add all required env vars above (Preview optional; mirror Production for staging)
- [ ] Deploy; **Project → Cron Jobs** shows `GET /api/cron/weekly-intelligence` (Mon 13:00 UTC, `vercel.json`)
- [ ] Smoke test: `POST https://<your-domain>/api/intelligence/weekly-report` with `Authorization: Bearer <CRON_SECRET>`
- [ ] Expect `ok: true`, `source: "ga4"`, `reportId`; `emailSkipped: true` if Resend unset
- [ ] Open `/executive-dashboard` — `Internal · GA4 week of …` when a report exists
- [ ] Do **not** set `NEXT_PUBLIC_` on any intelligence secret (`instrumentation.ts` throws if misconfigured)

**Routes (production):**

| Route | Runtime | Notes |
|-------|---------|--------|
| `/executive-dashboard` | Dynamic server (`force-dynamic`) | Fetches latest report server-side; placeholder if empty |
| `GET /api/cron/weekly-intelligence` | Dynamic, `maxDuration: 120` | Vercel Cron + `CRON_SECRET` |
| `POST /api/intelligence/weekly-report` | Dynamic, `maxDuration: 120` | Manual job; same auth as cron |
| `GET /api/intelligence/google-auth-url` | Dynamic | Setup helper (public client id in JSON only) |
| `GET /api/intelligence/google-oauth-callback` | **403 in production** | Obtain refresh token locally; paste into Vercel env |

**Localhost:** Default OAuth redirect is `http://localhost:3000/api/intelligence/google-oauth-callback` — used only for token setup, not for weekly refresh (refresh token + client credentials are enough in production).

---

## 7. File map

```
lib/intelligence/google-oauth.ts     — OAuth refresh + GA4 auth client
lib/integrations/ga4.ts              — GA4 Data API (OAuth)
app/api/intelligence/google-auth-url/route.ts
app/api/intelligence/google-oauth-callback/route.ts
scripts/google-oauth-setup.mjs
lib/integrations/future-sources.ts     — GSC / GBP / HubSpot stubs
lib/intelligence/weekly-report.ts    — orchestration
lib/intelligence/recommendations.ts  — summaries + signals
lib/intelligence/map-report-to-dashboard.ts
lib/supabase/intelligence.ts         — persistence
lib/email/send-weekly-intelligence-email.ts
app/api/cron/weekly-intelligence/route.ts
app/api/intelligence/weekly-report/route.ts
vercel.json                          — Monday cron
```

---

## 8. TODO (later)

- Google Search Console → content opportunities with queries
- Google Business Profile → local authority cards
- HubSpot → subscribers + concierge inquiry counts
- Ledger indices → macro tone block
