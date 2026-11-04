# Continuum Concierge P0 integration acceptance

## Beta Recovery comparison

Compared read-only against clean Beta Recovery commit `3c25ab0` on 2026-11-04.

- `WebsiteInquiry`, `WebsiteIntakeResult`, validation, hashing, and the `WebsiteIntakeStore` interface are unchanged from the P0 base. The Preview harness composes those contracts directly.
- Beta's Candidate target gained optional founder-disposition metadata. P0's target remains structurally compatible.
- P0's original Candidate ID was incompatible with `continuum_candidates.candidate_id`, whose database constraint requires 64 lowercase hex characters. Integration now uses the existing `assignCandidateId` function.
- The existing intake creates or resolves the Person before the Concierge projection. Integration now retains the returned Person ID for both `new` and `matched`, and leaves it null only for `needs_review`; it never creates a second Person.
- Beta's Today collector now suppresses the canonical `website-intake:<uuid>` shell Job so it does not appear as a duplicate founder task. The Concierge Candidate must therefore be persisted and included in the Candidate load before Today composition.
- Candidate source vocabulary has no `website-intake` member. The compatibility mapping is `sourceSystem: human-intake` plus `sourceRef: website-intake:<uuid>`. Beta's generic evidence label will call this “Human Intake”; a later Beta-owned presentation-only change should label this source “Website Concierge,” or shared schema authorization must add an explicit source-system value.
- Beta Recovery's Gmail OAuth, Sterling publisher, shared schema, and Vercel configuration were not modified.

## Fixture end-to-end path

`preview-acceptance.test.ts` exercises the real website form vocabulary and validator, then:

1. executes `ingestWebsiteInquiry` against a deterministic implementation of the existing intake store;
2. preserves sanitized attribution and the intake-resolved Person identity;
3. creates one qualified, non-canonical Candidate/Open Job proposal;
4. prepares a `CosFounderAttentionItem` decision for Sterling Today;
5. dispatches one approved acknowledgment through `FakeAcknowledgementTransport` only;
6. creates a booking in `requested` state with no offered availability, provider event, or sync receipt.

The fixture store returns `hubspotStatus: skipped` and never records a HubSpot outcome. Replays return `already-present`, the funnel returns `duplicate`, and a sent or uncertain outbox item is not dispatched again.

## Minimum HubSpot-removal changes

The public route currently treats HubSpot as the final delivery path after a successful Continuum intake. The smallest compatible cutover is:

1. after `ingestWebsiteInquiryServer` succeeds, call a server-only Concierge acceptance adapter with the returned `intakeId`;
2. require that adapter to return `created` or `already-present` before acknowledging the request;
3. remove the HubSpot contact/deal/note/SLA block and `recordWebsiteIntakeHubSpotOutcome` calls from the route behind an explicit Preview-only cutover flag;
4. store `hubspot_status = skipped` through one reviewed compatibility transition, retaining old external IDs for rollback/audit;
5. keep the legacy HubSpot path selectable until dual-path fixture and Preview reconciliation proves intake, identity, founder visibility, and acknowledgment parity.

No form or attribution contract needs to change. Do not remove HubSpot code or change route behavior until the durable adapter exists and the Preview rollback drill passes.

## Precise Supabase persistence adapter

The required server-only adapter is one call to a new atomic RPC named `continuum_accept_concierge_funnel_v1`. `persistence-contract.ts` defines its exact client parameters. The RPC must:

- run as `security invoker`, be executable only by `service_role`, and use an empty `search_path`;
- take `p_intake_id`, `p_expected_website_idempotency_key_hash`, `p_candidate`, `p_acknowledgement`, and `p_follow_up_policy`;
- lock the existing `continuum_website_intakes` row, reject missing/synthetic/mismatched rows, and use its authoritative identity/person/attribution rather than client claims;
- validate the Candidate is non-canonical, non-automatic, `open_job.createJob = false`, source-ref linked to the same intake, and identified by the existing 64-hex Candidate identity;
- insert the Candidate using the existing `continuum_candidates` identity semantics;
- insert one dedicated acknowledgment outbox row with unique `outbox_id` and `idempotency_key`, immutable copy version/body, consent evidence, lease/attempt state, provider receipt, and reconciliation state;
- persist follow-up consent and append-only suppression facts; no cadence enrollment is created;
- return the original Candidate/outbox identities on exact replay and raise `idempotency-conflict` on changed payload;
- commit Candidate and outbox visibility atomically so Today cannot see a half-integrated inquiry.

Booking requests need a separate service-role-only durable table/RPC because their requested/offered/confirmed/declined/rescheduled transition history and provider event identity do not fit the intake row. Capacity admissions likewise require a founder-configured capacity record plus atomic admitted/waitlisted ordering. Those are shared-schema changes and remain blocked pending authorization.

New tables in current Supabase projects are not necessarily exposed through the Data API automatically. Regardless, these records must remain unexposed to `anon` and `authenticated`, use RLS as defense in depth, and be reachable only through the server-side adapter.

## Remaining blockers and smallest safe next step

1. Shared-infrastructure approval for the atomic acceptance RPC and service-role-only outbox/consent tables.
2. A Beta-owned Today integration that loads the website Candidate and applies the “Website Concierge” source label while retaining shell-Job suppression.
3. A Preview-only route feature gate and rollback switch; no Production default change.
4. A verified email-ownership policy. Current website validation proves syntax and exact stored identity matching, not mailbox ownership; production qualification must not silently claim stronger verification.
5. Founder approval of copy, explicit follow-up consent wording, retention, and capacity configuration.

The smallest safe next step is a reviewed, unapplied SQL/API design for `continuum_accept_concierge_funnel_v1` plus its RLS/grant tests, followed by a local/ephemeral database acceptance run. No hosted Preview database should be changed before that review.
