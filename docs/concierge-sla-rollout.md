# Concierge Lead SLA (P0-5) — production activation order

Ship the code with SLA **default-disabled**. Do not set `CONCIERGE_SLA_ENABLED=true`
until every prerequisite below is complete.

## Prerequisites

1. Supabase table `concierge_sla_obligations` applied from
   `lib/supabase/concierge-sla-schema.sql` (service role; RLS on, no anon policies).
2. HubSpot private app scopes: `crm.objects.tasks.read` + `crm.objects.tasks.write`
   (in addition to existing contact/deal/notes write used by Concierge).
3. Optional but preferred: `HUBSPOT_OWNER_ID` (validated owner) and `HUBSPOT_PORTAL_ID`
   (deal deep links in alerts).
4. Alert delivery: `RESEND_API_KEY` plus a complete from/to pair (see fallback order).
5. Cron: `CRON_SECRET` present; `/api/cron/concierge-sla` registered hourly in `vercel.json`.

## Alert email resolution (server-only)

1. `CONCIERGE_ALERT_EMAIL_FROM` + `CONCIERGE_ALERT_EMAIL_TO` (preferred)
2. Else `AGENT_OS_EMAIL_FROM` + `AGENT_OS_EMAIL_TO` (documented founder fallback)
3. Else `INTELLIGENCE_EMAIL_FROM` + `INTELLIGENCE_EMAIL_TO` (documented fallback)
4. Else fail closed — no `*_alerted_at` stamp; loud operational log; retry later

Never mix from/to across pairs. Never expose these via `NEXT_PUBLIC_*`.

## Enable gate

`CONCIERGE_SLA_ENABLED` must equal the string `true` to activate:

- SLA ledger writes
- HubSpot follow-up task ensure/create
- Concierge SLA Resend alerts
- Watchdog mutations/alerts
- Chief of Staff overdue SLA surfacing

Any other value (including unset): Concierge contact → deal → association/note →
`accepted:true` behaves exactly as pre-P0-5. Watchdog returns
`{ ok: true, enabled: false, checked: 0, alertsSent: 0 }` without HubSpot/Supabase/Resend.

## Recommended production sequence

1. Commit P0-5 code with SLA default-disabled (`CONCIERGE_SLA_ENABLED` unset/false).
2. Push / deploy.
3. Apply Supabase schema (`concierge_sla_obligations`).
4. Enable HubSpot task read/write scopes on the private app.
5. Obtain/verify `HUBSPOT_OWNER_ID`.
6. Configure `HUBSPOT_PORTAL_ID`.
7. Configure `CONCIERGE_ALERT_EMAIL_TO` / `CONCIERGE_ALERT_EMAIL_FROM`.
8. Verify `CRON_SECRET`, `RESEND_API_KEY`, Supabase service-role env.
9. Set `CONCIERGE_SLA_ENABLED=true` in Production.
10. Redeploy (or restart) so the enabled env is live.
11. Run controlled synthetic E2E (synthetic contact naming).
12. Verify HubSpot task + ledger row + one immediate alert.
13. Exercise controlled 20h / 24h fixtures (no real wait).
14. Mark SLA task COMPLETED in HubSpot.
15. Verify ledger completes, future alerts suppress, CoS overdue clears.

Do not activate before prerequisites exist.
