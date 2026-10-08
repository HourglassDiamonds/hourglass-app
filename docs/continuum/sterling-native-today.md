# Sterling-native Today V1

## Boundary

Sterling makes semantic judgments over a bounded evidence snapshot. Deterministic code assembles canonical identity and evidence, validates structured output, and protects every mutation. V1 runs only in read-only shadow mode; it does not publish a Today snapshot or execute canonical writes.

## Repository reconnaissance

### Keep

- `lib/continuum/today-snapshot.ts` and `today-snapshot-store.ts`: compact persisted read model, watermark compatibility, and publish race protection.
- `lib/continuum/gmail/today-thread-context.ts`: exact indexed-thread recovery and read-only live current-message enrichment.
- `lib/continuum/calendar/today-upcoming-load.ts`: read-only calendar context.
- `lib/continuum/client-memory/project-desk/*`, `project-jobs/*`, and `project-lifecycle/*`: canonical identity, relationship, lifecycle, idempotency, and mutation history.
- `lib/continuum/chief-of-staff/operating-loop/founder-corrections-load.ts`: durable founder directives.
- `app/executive-dashboard/concierge/cos-operating-loop-actions.ts`: authenticated founder mutation boundary.

### Reuse with modification at beta integration

- `lib/continuum/chief-of-staff/operating-loop/load.ts`: assemble the Sterling working set and schedule a model-backed recompute behind the existing snapshot path.
- `lib/continuum/concierge-sol/models.ts`: approved model route and Responses endpoint only.
- `lib/continuum/chief-of-staff/operating-loop/docket.ts` and the current Today UI: adapt validated proposal categories to the established presentation contract.
- `continuum_sterling_proposals` from `codex/sterling-worker-v1`: durable approval/audit/rollback handoff. The Today implementation must map validated mutations into the ledger contract after that branch lands; it does not duplicate the ledger here.

### Bypass

The shadow path does not call `thread-truth.ts`, `group-truth.ts`, `current-work.ts`, `work-loop-state.ts`, `moderator.ts`, deterministic ranking, or briefing-copy reducers. Those modules remain untouched for production fallback during evaluation.

### Deprecate later

Only after live founder-beta acceptance may the bypassed semantic reducers and their dedicated tests be retired. Gmail retrieval, snapshots, canonical stores, writers, audit history, permissions, and rollback remain.

## Implemented flow

```text
canonical projects / people / jobs
            +
indexed + live current-message Gmail evidence
            +
calendar + founder directives + prior Today
            |
            v
sterling-today-working-set-v1
            |
            v
one strict Structured Output Sterling call (no tools, no writes)
            |
            v
sterling-today-proposal-v1
            |
            v
identity / relationship / provenance / version / transition / dedupe validation
            |
            v
presentation proposal + founder-review-only mutation proposals
```

`lib/continuum/today-sterling/working-set.ts` uses complete loaded chronology for every deterministically associated thread; it applies no arbitrary date cutoff. Quote removal and current-message extraction are retrieval hygiene, not semantic judgment.

`lib/continuum/today-sterling/evidence-load.ts` extends the candidate-oriented Gmail loader with the existing project-evidence resolver. Trusted thread associations are attached to canonical projects. Bounded candidate or ambiguous discoveries are loaded only as unassociated evidence; they acquire a project reference only when the assembler finds an exact canonical project number. This exposes unresolved evidence to Sterling without silently converting an uncertain relationship into canonical truth.

`lib/continuum/today-sterling/request.ts` sends one strict JSON-schema request with no tools. It instructs Sterling to separate project stage from obligations, classify contacts conservatively, honor newer evidence and founder corrections, and preserve state under ambiguity.

`lib/continuum/today-sterling/validate.ts` never reinterprets conversation text. It verifies only structural and canonical safety facts. Passing mutations are “approved for founder review,” never approved for execution.

## Shared Sterling ledger contract

The downstream adapter should create one ledger proposal per validated mutation with:

- deterministic proposal/validation ID;
- affected entity and current state fingerprint;
- exact expected record version;
- bounded evidence references and reasoning summary;
- source watermark, working-set snapshot ID, run ID, model, and prompt version;
- `review-required` status and no automatic execution.

Execution remains limited to existing canonical writers after founder approval and a fresh version/fingerprint check. Rollback is a compensating audited mutation, never history deletion.

## Production boundary

Run `npm run continuum:today-sterling-shadow` for an assembly-only live read. It refuses a non-production Supabase project, performs no database writes, never calls the model, and does not update `continuum_today_snapshots`. `npm run continuum:today-sterling-shadow:model` is the explicit model-enabled shadow command; it still performs no writes and exits nonzero on contract, validation, or acceptance failure. Production rendering remains on the existing path until founder approval.

The acceptance runner scopes the model package to the ten authorized regression cases before Gmail enrichment. It retains complete chronology only for threads selected by exact canonical project association or case-specific identifier/name evidence. People, Jobs, founder corrections, prior Today entries, and calendar items are filtered through the same scope. Full email bodies and credentials are never logged; shadow output contains only counts, canonical-linkage metadata, recommendation summaries, evidence references, and validation results.
