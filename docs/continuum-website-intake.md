# Continuum first-party website intake

## Runtime flow

`POST /api/concierge` keeps the existing website form and HubSpot delivery. After the existing honeypot and rate limit, the server strictly validates the current form vocabulary and writes the inquiry through `continuum_ingest_website_inquiry` using the server-only Supabase service-role client.

The database transaction durably deduplicates the opaque submission token, resolves exact hashed email/phone identities, creates a prospect only when there is no match, records ambiguity for founder review, and creates one projectless `required_action` Job through the existing atomic Open Job writer. That writer supplies the canonical mutation history and Today already loads projectless Jobs.

The browser never supplies a Person, Project, Job, role, acknowledgement state, source, or synthetic flag. The intake ledger has RLS enabled and grants no `anon` or `authenticated` access.

## Dual ingest and HubSpot removal seam

HubSpot remains downstream of the Continuum write. The intake ledger records `pending`, `succeeded`, or `failed` HubSpot delivery plus the external contact/deal IDs. A durable replay whose HubSpot state is already `succeeded` skips another HubSpot create. A replay whose HubSpot state is `pending` or `failed` is treated as an uncertain delivery and does not automatically create another deal; it is marked `recovery_required` and logged for operator reconciliation. While the migration is not installed or Continuum is unavailable, the route retains the legacy HubSpot-only behavior.

Every first-attempt HubSpot deal created after a successful Continuum write includes the exact `Continuum Intake ID` in its description. To recover an uncertain delivery, search HubSpot for that exact UUID, compare the deal's `Submission ID`, then call the service-role-only `continuum_record_website_intake_hubspot` RPC with the verified contact/deal IDs. If no exact deal exists, retry or create it only through a controlled operator action. HubSpot's ordinary deal fields and search are not unique or atomic, so the public route deliberately does not guess. A future portal-managed unique deal property could support HubSpot batch upsert without changing Continuum idempotency.

After dual-ingest validation, HubSpot removal is localized to the HubSpot block in `app/api/concierge/route.ts`, its SLA setup, and `recordWebsiteIntakeHubSpotOutcome`. The public form and Continuum intake contract do not need to change.

## Acknowledgement

The ledger models `not_expected`, `pending`, `sent`, and `failed`. The current site displays an in-browser receipt but does not send a client email, so website submissions are stored as `not_expected`. Continuum acceptance, HubSpot success, and the HTTP success response never transition acknowledgement state to `sent`. Future acknowledgement delivery may set `sent` only after positive provider evidence that the delivery action occurred; no such writer is included in this lane.

## Synthetic health check

`GET /api/cron/continuum-intake-health` requires the existing `CRON_SECRET`. It runs the same strict form parser and durable intake RPC with a reserved `.invalid` address and `synthetic=true`. The database constraint requires synthetic rows to have no Person, Job, or identity-review references and skips HubSpot. The response contains only status and isolation state.

No schedule is added in this lane. During dual ingest, configure the deployment scheduler or external monitor to call the endpoint periodically and alert on non-2xx responses. Synthetic ledger rows are intentionally retained as health history but cannot pollute client records.

## Migration operation

`supabase/migrations/20260930020000_website_inquiry_intake.sql` is additive and unapplied. It fails closed unless the projectless/atomic Open Job foundation is present. Apply and verify the prerequisite migration first, then review and apply this migration in the intended Continuum environment. Do not replay historical unapplied SQL files indiscriminately.
