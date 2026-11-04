# Continuum Concierge funnel P0/P1 dependency map

## Implemented Preview boundary

`lib/continuum/concierge-funnel` is a provider-neutral, deterministic Preview kernel. It accepts a server-verified identity result and the existing validated `WebsiteInquiry`, then atomically proposes an immutable intake event, attributed lead, non-canonical Continuum Candidate/Open Job action, consent policy, and acknowledgment outbox item. The acceptance store and transports are fake and in-memory by design. They prove the contract without touching shared schema, Gmail OAuth, Sterling publication, Vercel configuration, or live customers.

No public route calls this kernel yet. `POST /api/concierge` and the current HubSpot compatibility path are unchanged.

## Current intake audit and compatibility

- The browser creates an opaque submission token and submits validated form data plus sanitized first-touch attribution. Text consent currently covers only replying to the inquiry by text; the form has no explicit automated follow-up consent.
- The current route runs honeypot/rate-limit checks, writes `continuum_ingest_website_inquiry`, then writes HubSpot. The database transaction owns durable replay protection, exact hashed email/phone matching, ambiguity review, prospect creation, and one projectless founder Job.
- The process-local route guard is only a fast duplicate guard. The durable database idempotency key and payload hash are authoritative.
- Existing matched Persons are referenced; ambiguous identities are held for founder review. The Preview kernel likewise never mints, merges, or changes an existing Person and never creates a canonical Project.
- HubSpot remains a live compatibility dependency for contact/deal/SLA behavior. An uncertain HubSpot outcome is already held for operator recovery instead of blindly creating another deal.
- Attribution is preserved on the intake and projected lead. Unsafe query strings, secrets, email addresses, and phone-like attribution values are filtered by the existing sanitizer.
- The current acknowledgment ledger is `not_expected`; the browser receipt is not delivery evidence. The new outbox requires founder-approved versioned copy and a positive provider receipt before `sent`.

### Rollback

P0 is additive and disconnected, so rollback is deletion/revert of `lib/continuum/concierge-funnel`, its tests, and this document. There is no database rollback, credential rollback, Vercel rollback, or customer-data repair. A future cutover must keep the current route behind an explicit adapter/feature gate until dual-write comparison, reconciliation, and rollback drills pass.

## Authorization and provider findings

- Existing Continuum Gmail OAuth is `gmail.readonly`; it cannot send. P1 acknowledgment delivery requires separately approved `https://www.googleapis.com/auth/gmail.send`, confirmed sender identity/from-address behavior, founder consent, and a production-ready OAuth publishing posture. Do not broaden or modify Beta Recovery's token custody.
- Existing Calendar OAuth is deliberately `calendar.readonly`. It can authorize Free/Busy reads, but not event creation or rescheduling. P1 writes require a separate founder grant for `https://www.googleapis.com/auth/calendar.events` (or a demonstrably sufficient narrower owned-calendar scope), separate token custody/authorization review, and provider receipts.
- A booking is not confirmed until Google returns an event ID and synchronization receipt. Rescheduling updates that same event identity and records a transition; it never silently creates a replacement.
- No new Supabase table, migration, RPC, cron, secret, production service, or billable infrastructure is included. A production adapter for these contracts is a shared-infrastructure authorization gate.

## P1 activation gates

1. Founder approves the exact acknowledgment and follow-up copy, sender/from address, reply handling, cadence, and commission-capacity configuration.
2. Legal/privacy review confirms service-message basis, explicit follow-up consent vocabulary, SMS consent, retention, deletion, and suppression obligations.
3. Beta Recovery completes Gmail OAuth readiness; a separate `gmail.send` consent is authorized and verified without changing its read-only ingestion lane.
4. Calendar read-only consent is healthy for Free/Busy. A separate `calendar.events` consent and token boundary is approved before any insert/update call.
5. Shared-infrastructure approval covers an additive durable store, RLS/grants, atomic idempotency constraints, outbox leases, run logs, reconciliation, retention, and rollback migration.
6. Preview/Production configuration is explicit and fail-closed. Preview accepts only fake transports; Production activation requires an allowlisted sender, environment gate, and operator kill switch.
7. Dual-write compatibility proves parity with current intake/HubSpot, then a founder-authorized cutover plan defines reconciliation and rollback. HubSpot is not removed until that evidence is accepted.
8. Operational acceptance proves provider receipt capture, uncertain-send quarantine, conflict handling, event-ID preservation, waitlist release, suppression ingestion from replies/bookings/opt-outs/status changes, failed-send intervention, and audit logs.

## Test evidence

`kernel.test.ts` uses deterministic fixtures and mock providers to cover replay/payload conflict, attribution, protected identities, qualified routing, copy approval, fake-only acknowledgment delivery, uncertain-send quarantine, booking conflicts, provider confirmation, reschedule identity, capacity waitlisting, and every required follow-up stop condition.
