# Continuum Concierge P0.8 application integration

Status: implemented and verified locally on 2026-11-04. The public
`/api/concierge` HubSpot route is unchanged. No Preview record, customer
message, booking, Vercel setting, OAuth credential, Sterling publication, or
Production resource was changed.

## Integration path

The server-only application seam accepts an authoritative website inquiry,
invokes the existing website-intake RPC, then invokes the installed
`continuum_accept_concierge_funnel_v1` RPC through the P0.5 adapter. It reloads
the persisted intake, Candidate, and outbox row before returning success.

The prepared acknowledgment is founder-approved but remains `ready` with zero
attempts. The application seam has no transport dependency, and its response
states `preview-fake-not-dispatched`. An explicit fake transport remains
available only to local tests. The booking projection remains `requested`, has
no offered window or provider event ID, and therefore makes no availability
claim.

Sterling Today continues to load the shared pending Candidate contract. The
new Candidate stays noncanonical, has `createJob=false`, and requires founder
review. Website-intake Candidate source references are presented as `Website
Concierge`; unrelated `human-intake` Candidates remain `Human Intake`. The
private adapter also exposes the same pending founder action projection through
`listFounderActions()`.

New email identities default to `unverified`. A `verified` status can enter the
pure application seam only with a non-empty authoritative-identity or provider
receipt reference. The controlled hosted fixture route supplies no such
evidence and therefore always creates a review-required proposal for a new
identity.

## Hosted route and flags

The preparation harness is:

`POST /executive-dashboard/concierge/preview-acceptance`

It returns 404 unless both server-only flags are exactly `true`:

- `CONTINUUM_CONCIERGE_PREVIEW_INTEGRATION_ENABLED`
- `CONTINUUM_CONCIERGE_PREVIEW_SYNTHETIC_ACCEPTANCE_ENABLED`

It additionally requires `CONTINUUM_ENV=preview`, `VERCEL_ENV=preview`, the
canonical Preview project ref and URL (`hrmpzplffuhhvbtxxhnt`), the existing
durable founder session, a same-origin JSON request, and a reserved
`@example.test` address. The route fixes source, acknowledgment expectation,
synthetic marker, copy, and follow-up consent server-side. This route cannot be
used as a second public customer intake.

Both flags remain unset. Enabling either flag or inserting a shared Preview
fixture requires separate authorization.

## Controlled hosted acceptance procedure

After a separate approval naming the deployment and authorizing one shared
Preview fixture:

1. Deploy the reviewed commit only to the canonical isolated Preview and set
   both flags to `true` for that Preview deployment only.
2. Sign in through the existing founder dashboard session.
3. From that deployment's same-origin browser context, submit one unique UUID
   with `acceptancePurpose: "controlled-preview-acceptance"`, an
   `@example.test` email, the normal Concierge selection values, sanitized
   attribution, and a requested time window.
4. Require HTTP 200, `sourceLabel="Website Concierge"`, a pending Candidate,
   `acknowledgement.state="ready"`, `attemptCount=0`,
   `reconciliationRequired=false`, `deliveryMode="preview-fake-not-dispatched"`,
   and a booking state of `requested` with no offered window/provider ID.
5. Replay the exact body and require `funnelStatus="duplicate"` with the same
   intake, Candidate, and outbox IDs.
6. Using read-only service-side catalog/data checks, confirm one intake, one
   Candidate, and one outbox row and no `sent` acknowledgment.
7. Set the synthetic-acceptance flag back to false (or remove it) immediately
   after evidence capture.

Changed replay bodies must return conflict. Existing website intakes whose
acknowledgment state is `not_expected` are rejected atomically by the installed
RPC; no Candidate or outbox row is created and no state is converted.

## Compatibility and rollback

The latest Beta Recovery delta through `72f4ad22` changes only Gmail manual
preview recovery files. P0.8 touches none of those files, no Gmail adapter, no
publisher, no shared schema, and no Vercel configuration. The public HubSpot
route remains byte-for-byte outside this change.

Application rollback is disabling both flags and reverting the P0.8 commit.
Because this change adds no migration and the public route is unchanged, the
installed P0.7 schema and existing intake behavior continue to operate. Any
authorized test records should be retained for audit unless a separately
reviewed, ID-scoped cleanup is approved.
