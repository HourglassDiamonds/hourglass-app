# Agent OS Live Measurement — GA4 + Search Console

Read-only production measurement for Hourglass Agent OS.
Uses the **existing Google OAuth refresh-token architecture** (not a service account).

## Architecture / data flow

```
Google OAuth refresh token
  → GA4 Data API (lib/integrations/ga4.ts)
  → GSC Search Analytics API (lib/integrations/gsc.ts)
  → Agent OS adapters (lib/agent-os/adapters/load.ts)
  → SourceHealth + healthCode + founderLabel
  → Business Intelligence (GA4) / Search Strategy (GSC)
  → Chief of Staff synthesis
  → persisted brief → cadence email (separate path)
```

Live mode never falls back to fixtures.

Weekly intelligence (`lib/intelligence/weekly-report.ts`) still uses Mon–Sun UTC week helpers.
Agent OS live loads use **America/New_York completed-day windows** (rolling 7d + day-over-day + optional 28d baseline).

## Required Google APIs

Enable on the Google Cloud project tied to the OAuth client:

1. **Google Analytics Data API**
2. **Google Search Console API** (Web Search API / Search Console API)

## OAuth client / consent

1. Create an OAuth **Web application** client (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`).
2. Authorized redirect URI must match `GOOGLE_OAUTH_REDIRECT_URI`
   (local default: `http://localhost:3000/api/intelligence/google-oauth-callback`).
3. Consent scopes (already requested by setup scripts):
   - `https://www.googleapis.com/auth/analytics.readonly`
   - `https://www.googleapis.com/auth/webmasters.readonly`
4. Generate a refresh token once:

```bash
npm run intelligence:google-oauth
```

Store the refresh token as `GOOGLE_REFRESH_TOKEN` (never commit it).

## GA4 property permissions

1. In GA4 Admin → Property access management, grant the **same Google user** that completed OAuth at least **Viewer**.
2. Set `GA4_PROPERTY_ID` to the **numeric** property id (not the G-XXXXXXXX measurement id).

## Search Console site permissions

1. In Search Console, add the Google user as a user on the exact property.
2. Set `GSC_SITE_URL` to the **exact** property string shown in GSC, e.g.:
   - `https://www.hourglassdiamonds.com/`
   - or `sc-domain:hourglassdiamonds.com`

## Environment variables

### Shared (OAuth)

| Variable | Required for |
|----------|----------------|
| `GOOGLE_CLIENT_ID` | GA4 + GSC |
| `GOOGLE_CLIENT_SECRET` | GA4 + GSC |
| `GOOGLE_REFRESH_TOKEN` | GA4 + GSC |
| `GOOGLE_OAUTH_REDIRECT_URI` | Setup / token refresh (optional if default local URI used) |

### GA4-specific

| Variable | Required for |
|----------|----------------|
| `GA4_PROPERTY_ID` | GA4 reads |

### GSC-specific

| Variable | Required for |
|----------|----------------|
| `GSC_SITE_URL` | GSC reads |

### Not used for these adapters

- No `NEXT_PUBLIC_*` secrets
- No service-account JSON in this pass
- Email vars (`RESEND_*`, `AGENT_OS_EMAIL_*`) are **delivery-only** — not required for measurement smoke

## Local setup

1. Put the variables above in `.env.local` (gitignored).
2. Run OAuth setup if you do not yet have a refresh token.
3. Smoke test (no email):

```bash
npm run agent-os:measurement-smoke
# or
npx tsx scripts/agent-os-measurement-smoke.ts --json
```

## Vercel production checklist (Justin)

1. Enable Analytics Data API + Search Console API on the Google Cloud project.
2. Ensure the OAuth user has GA4 Viewer + GSC site access.
3. In Vercel → Project → Settings → Environment Variables (Production), set:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REFRESH_TOKEN`
   - `GOOGLE_OAUTH_REDIRECT_URI` (production callback URL if used)
   - `GA4_PROPERTY_ID`
   - `GSC_SITE_URL`
4. Redeploy so server runtimes pick up env.
5. Run smoke against production env pull **or** wait for the next daily cron and inspect source-health labels in the brief.
6. Do **not** paste secrets into chat, tickets, or git.

## Safe smoke command

```bash
npm run agent-os:measurement-smoke
```

Guarantees:

- read-only
- default **no email**
- no persistence
- no fixture fallback
- sanitized property/site ids only
- exit `1` on auth/access failure or neither source configured
- exit `0` for healthy, empty, or normal GSC lag

## Source-health troubleshooting

| Founder label | Meaning | Action |
|---------------|---------|--------|
| GA4 not configured | Missing OAuth and/or `GA4_PROPERTY_ID` | Add env vars |
| GA4 OAuth authentication failed | Refresh token invalid/revoked | Re-run `intelligence:google-oauth` |
| GA4 property access denied | User lacks GA4 Viewer (or wrong id) | Fix property access / id |
| GA4 request failed | Upstream Data API error | Retry; check API enablement |
| GA4 returned no usable rows | Auth ok, zero sessions in window | Confirm property + traffic |
| Search Console not configured | Missing OAuth and/or `GSC_SITE_URL` | Add env vars |
| Search Console OAuth authentication failed | Shared token refresh failed | Re-run OAuth |
| Search Console site access denied | User not on GSC property | Add user / fix site URL |
| Search Console … normal reporting delay | Newest date 2–5 days old | Expected — not an outage |
| Search Console data unusually stale | Newest date ≥ ~6 days | Check API/site; still not “auth failed” |
| Search Console returned no usable rows | Auth ok, empty search rows | Confirm property coverage |

## Expected Search Console lag

Search Analytics `startDate` / `endDate` and `metadata.first_incomplete_date` use **America/Los_Angeles** (Pacific), not Eastern.

Agent OS freshness discovery:

1. One bounded date-dimension query with `dataState: "all"` (lookback ≈ 16 Pacific days).
2. Prefer `metadata.first_incomplete_date` when present.
3. Newest **finalized** date = day before `first_incomplete_date`.
4. Comparison windows end on that finalized Pacific date.
5. Zero-traffic days are omitted by the API — that is empty activity, not missing/delayed data.
6. If metadata is absent: conservative fallback assumes finalized through `(most recent complete Pacific day − 2 days)`.

Founder Morning Brief stays America/New_York for cadence framing; GSC source dates are labeled as Pacific / finalized, not ET.

Smoke output can show finalized / firstIncomplete / observed separately. The founder email only surfaces a compact freshness note when decision-useful.

## Credential rotation

1. Revoke old refresh token in Google Account → Security → Third-party access (or Cloud Console).
2. Run `npm run intelligence:google-oauth` again.
3. Update `GOOGLE_REFRESH_TOKEN` in Vercel + local `.env.local`.
4. Re-run `npm run agent-os:measurement-smoke`.

## Disabling a source

- Disable GA4: remove `GA4_PROPERTY_ID` (or shared OAuth vars).
- Disable GSC: remove `GSC_SITE_URL`.
- Briefs remain valid; gaps use precise “not configured” labels.

## Rollback

Revert this branch / undeploy the build. Removing the six env vars above instantly disables live reads without code changes. Fixture mode continues to work for offline validation:

```bash
npm run agent-os:brief
```

## Pattern for future HubSpot / Buffer / GBP adapters

1. Official read-only client behind `lib/integrations/<source>.ts`
2. Thin Agent OS loader in `adapters/load.ts` returning `AdapterResult` + `healthCode` / `founderLabel`
3. No fixture fallback in live mode
4. Executives consume normalized evidence only
5. Preflight/smoke must report configured / auth / access / empty / stale without secrets
6. Daily brief mapping must preserve precise labels (do not collapse to “unavailable”)
