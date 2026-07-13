# Concierge — identified follow-ups

## Visitor confirmation email

Resend is present in the repo for the internal weekly intelligence brief only
(`lib/email/send-weekly-intelligence-email.ts`). There is no stable visitor
transactional email template, verified from-address product path, or Concierge
confirmation sender yet.

**Follow-up (post this sprint):** Add a dedicated Concierge confirmation email
via Resend after HubSpot contact + deal creation succeeds. Keep email failure
non-blocking. Do not overload `INTELLIGENCE_EMAIL_*` env vars.

## Durable submission idempotency

Concierge duplicate protection is currently:

1. Client-side submit lock while `submitting`
2. Stable client `submissionId` per form mount / inquiry
3. In-memory in-flight + completed ID map on the API (best-effort on serverless)
4. Soft-accept honeypot responses use `{ ok: true, accepted: false }` so GA4 lead events do not fire

**Remaining limitation:** Cold starts and multi-instance serverless can still
accept a rare duplicate HubSpot deal if the same submission is retried across
instances before the warm-instance map has seen it. A durable store (e.g.
Supabase submissions table) would close this gap without a new paid service.

## Executive Dashboard

Production always returns `notFound()` for `/executive-dashboard`. There is no
environment flag that opens the route on the public domain. `robots: noindex`
is not access control.
