# Agent OS — Production Activation Runbook

**Status:** preparation only — do not treat this document as authorization to apply schema, send email, enable cron, push, or deploy.

**Code baseline (local `main` at runbook authorship):**

```text
b2598f7604ea283225089f5aa53860f044543526
fix(agent-os): keep CLI --test off real email by default
```

Re-verify `git rev-parse HEAD` before every gated step. If HEAD differs, stop and re-run Final Operational QA against the new SHA.

Related architecture docs: [`docs/agent-os-v1.md`](./agent-os-v1.md).

---

## 1. Pre-activation verification

Confirm all of the following before any write:

1. Working tree is clean of tracked changes (`marketing-sprint/` and `tmp/` may remain untracked and must not be staged).
2. Local `main` contains only the reviewed Agent OS commit stack ahead of `origin/main`.
3. `vercel.json` lists `/api/cron/agent-os-cadence` at `0 11 * * *` and `0 12 * * *` (dual UTC fire for 07:00 America/New_York).
4. `lib/supabase/agent-os-schema.sql` is present.
5. Agent OS email variables are not accidentally committed.
6. `npm run test:agent-os` and `npm run build` pass on the activation SHA.
7. CLI `--test` defaults to fake email transport; real test sends require `--allow-real-email`.

---

## 2. Supabase schema application procedure

**Preferred method:** Supabase Dashboard → SQL Editor → paste and run `lib/supabase/agent-os-schema.sql` while authenticated as a project owner/admin (service-role capable session).

**Do not** apply via ad-hoc application code, public APIs, or anon keys.

**Idempotency:** the file uses `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` and enables RLS. It does **not** auto-alter incompatible existing columns. If `agent_os_*` tables already exist with a different shape, stop and migrate explicitly.

**Scope:** creates only:

| Object | Purpose |
|--------|---------|
| `agent_os_persisted_state` | Durable cadence/run state blob (`scope` PK: `live` \| `fixture` \| `test`) |
| `agent_os_delivery_claims` | Delivery reservation / claim rows |
| Indexes on lease, cadence window, `updated_at` | Inspection / reclaim / future retention |
| RLS enabled, **no** anon/authenticated policies | Service-role-only access |

Unrelated tables (`intelligence`, Shape Studio, Diamond Intelligence, calibration, etc.) are not modified by this script.

**Before apply:** confirm the dashboard project matches the production `SUPABASE_URL` host configured in Vercel (compare host only — never paste keys into chat or docs).

---

## 3. Schema verification queries

Run after application (SQL editor). Expect two tables, RLS on, and the uniqueness constraint:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('agent_os_persisted_state', 'agent_os_delivery_claims')
order by 1;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('agent_os_persisted_state', 'agent_os_delivery_claims');

select conname, contype
from pg_constraint
where conrelid = 'public.agent_os_delivery_claims'::regclass
order by 1;

select indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('agent_os_persisted_state', 'agent_os_delivery_claims')
order by 1;
```

Optional emptiness check (should be empty before first live run):

```sql
select count(*) as state_rows from agent_os_persisted_state;
select count(*) as claim_rows from agent_os_delivery_claims;
```

**Rollback implication:** dropping these tables after live use destroys cadence/delivery history and weakens duplicate-send protection. Prefer leaving tables in place and disabling cron/email instead of dropping.

---

## 4. Environment variables (names + completeness)

Set in **Vercel Production** (and Preview only if intentionally testing Agent OS there). Never commit values. Never log values.

| Variable | Required for scheduled-live email |
|----------|-----------------------------------|
| `SUPABASE_URL` | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (server only) |
| `CRON_SECRET` | Yes (cron route auth) |
| `RESEND_API_KEY` | Yes |
| `AGENT_OS_EMAIL_FROM` + `AGENT_OS_EMAIL_TO` | Preferred complete pair |
| `INTELLIGENCE_EMAIL_FROM` + `INTELLIGENCE_EMAIL_TO` | Allowed complete fallback pair |
| `AGENT_OS_RECIPIENT_ALIAS` | Optional (defaults to `founder`; used in fingerprints/logs — not a mailbox) |

**Precedence (fail closed, no partial mixing):**

1. Complete `AGENT_OS_EMAIL_FROM` + `AGENT_OS_EMAIL_TO`
2. Else complete `INTELLIGENCE_EMAIL_FROM` + `INTELLIGENCE_EMAIL_TO`
3. Else refuse send

Partial Agent OS `from` without `to` (or vice versa) is refused even if intelligence values exist.

Validate configuration **without printing values** by observing CLI/API `errorCode: "unconfigured"` vs success paths, or by checking boolean helpers in a private operator session that redacts output.

Local `.env.local` may differ from Vercel Production. Production activation requires Production env, not local placeholders.

---

## 5. Secret-handling rules

- Do not paste secrets, service-role keys, Resend keys, or full recipient addresses into chat, commits, screenshots, or this runbook.
- Do not put secrets on CLI argv where shell history retains them; use env / Vercel UI.
- Delivery persistence stores **fingerprints and aliases only**, never raw recipient addresses.
- Failure alerts and CLI summaries must remain redacted (`safeSummary` / redaction helpers).

---

## 6. Resend sender-domain verification

The `from` address domain must be verified in the Resend dashboard before a live founder send. Unverified domains typically fail at provider send time after the durable claim has moved to `sending` — raising `failed` or `uncertain` risk.

Confirm in Resend UI (operator): domain verified → DNS OK → intended `from` mailbox authorized. Do not record the address here.

---

## 7. Safe dry-run

Never sends email. Does not mark deliveries as `sent`.

```bash
npx tsx scripts/agent-os-cadence.ts --dry-run --cadence cos-daily-synthesis --force
```

Expect `dryRun: true`, `emailSent: false`, `deliveryStatus: "dry-run-no-send"` (or equivalent quiet/suppressed outcome).

---

## 8. Safe fake-email test

Defaults to an in-process fake sender. **Does not call Resend** unless `--allow-real-email` is also passed.

```bash
npx tsx scripts/agent-os-cadence.ts --test --cadence cos-daily-synthesis --force --persist-durable-test
```

Expect log/JSON markers such as `email=fake(default)` and `testEmailTransport: "fake"`.

Do **not** use `--allow-real-email` during preparation.

Without `--persist-durable-test`, fixture/test mode uses non-production adapters (memory by default) — still must not hit Resend when fake transport is default.

---

## 9. Controlled single live-email command

**Approval-gated.** Prerequisites: schema applied, Production env complete, Resend domain verified, durable Supabase reachable.

```bash
npx tsx scripts/agent-os-cadence.ts --scheduled-live --cadence cos-daily-synthesis --force
```

Or authenticated one-shot HTTP to `/api/cron/agent-os-cadence` with `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret` (never `?secret=`).

`--scheduled-live` must use durable Supabase persistence. File/memory adapters are refused.

`--allow-real-email` is **not** the production path; it only opts test mode into Resend.

---

## 10. Expected cadence ID and local-date window

| Cadence | Window shape | Founder TZ gate |
|---------|--------------|-----------------|
| `cos-daily-synthesis` | `day:YYYY-MM-DD` | At/after **07:00** `America/New_York` |
| `cos-weekly-founder-brief` | `week:YYYY-Www` | Weekly eligibility + anti-redundancy vs same-day daily |

Smoke-test with `--force` may run before 07:00 locally; production cron should fire at/after the gate.

---

## 11. Persistence and delivery-state checks after smoke test

```bash
npx tsx scripts/agent-os-cadence.ts --inspect
```

Confirm (without expecting raw emails in output):

- A delivery row for the cadence window
- Status `sent` (or intentional `suppressed` / `send-nothing`)
- `kind` is `founder-brief` or `failure-alert` as appropriate
- `providerMessageId` present only for successful provider accepts
- No recipient address fields

Optional SQL (service role / SQL editor):

```sql
select cadence_id, cadence_window, kind, status, provider_message_id is not null as has_provider_id, updated_at
from agent_os_delivery_claims
order by updated_at desc
limit 20;
```

---

## 12. Duplicate-send verification

Immediately re-run the same live/smoke command for the same cadence window. Expect:

- `already-terminal` / suppressed / no second provider send
- `emailSent: false` on the duplicate invocation

Do not bypass claim lease / fingerprint cooldown protections.

---

## 13. Cron configuration and recommended frequency

Route (already in code, not yet scheduled):

```text
GET|POST /api/cron/agent-os-cadence
```

Auth: shared `CRON_SECRET` via `Authorization: Bearer …` or `x-cron-secret` only (`timingSafeEqual`). Query-string secrets are rejected.

**Recommended `vercel.json` entries (dual UTC fire + New York app gate):**

```json
{
  "path": "/api/cron/agent-os-cadence",
  "schedule": "0 11 * * *"
},
{
  "path": "/api/cron/agent-os-cadence",
  "schedule": "0 12 * * *"
}
```

Rationale:

- Schedules are UTC; America/New_York offsets alternate between UTC−4 (EDT) and UTC−5 (EST).
- `0 11 * * *` = **07:00 EDT**; `0 12 * * *` = **07:00 EST**.
- App-level `localEligibleAt: { hour: 7, minute: 0 }` rejects the off-season early fire (e.g. 11:00 UTC during EST is still 06:00 local) and accepts any invocation at/after 07:00 local.
- Delivery ledger + one-success-per-local-date make the second same-day fire a no-op after a successful send — no competing scheduler.
- A delayed fire later in the local morning still runs (`catchUpBehavior: run-if-stale`) and does **not** silently skip the day.
- Prefer dual daily UTC schedules over a single fixed-UTC hour or an hourly cron. Do **not** enable hourly cron on Hobby (deploy will fail).

`maxDuration` on the route is 120s — confirm plan limits support it.

---

## 14. Push and deployment sequence

Default order (minimize “code expects missing infra” window):

1. **Push** local `main` to `origin/main` (fast-forward only; Agent OS stack only).
2. **Preview deploy** (optional but advisable) — cron still absent; email unset → fail closed.
3. **Apply schema** on the production Supabase project.
4. **Configure Production env** (Supabase, `CRON_SECRET`, Resend, email pair).
5. **Redeploy Production** so runtime picks up env (if env added after prior deploy).
6. **Controlled live smoke** (`--scheduled-live` or single authenticated cron invoke).
7. **Duplicate-send check**.
8. **Confirm cron** entries in `vercel.json` (dual UTC) + deploy.
9. Monitor first local morning + first weekly window.

Deploying code **with cron still disabled** is safe: the route exists but is not invoked by schedule; unauthenticated calls 401; missing durable/email config fails closed.

Pushing **before** schema apply is acceptable if cron remains disabled and no operator runs `--scheduled-live` against Production.

---

## 15. First-day monitoring

After cron enablement (or next 07:00+ New York window):

- Vercel function logs for `/api/cron/agent-os-cadence` (status, `deliveryAction`, `errorCode` only)
- `--inspect` / SQL claim rows for today’s `day:YYYY-MM-DD`
- Founder inbox: at most one normal brief (or intentional quiet / failure alert)
- No recursive failure-alert storms

---

## 16. First weekly-window monitoring

- Confirm weekly cadence window `week:YYYY-Www`
- Confirm same-day daily is suppressed after successful weekly founder claim/send/uncertain
- Confirm weekly `send-nothing` / failure-alert does **not** suppress a valid daily

---

## 17. Failure and `uncertain` delivery handling

| Symptom | Action |
|---------|--------|
| No email, `send-nothing` | Healthy quiet cycle — no action |
| `unconfigured` / 503 | Fix env; do not force unsafe adapters |
| `failed` pre-send | Inspect `errorCode`; retry allowed after claim is `failed` |
| `uncertain` | **Do not auto-resend.** Inspect provider. Resolve explicitly: |
| | `npx tsx scripts/agent-os-cadence.ts --resolve-uncertain --delivery-id del:… --as sent\|failed --confirm` |
| Auth 401 on cron | `CRON_SECRET` mismatch; never use `?secret=` |

---

## 18. Rollback procedure

1. Remove `/api/cron/agent-os-cadence` from `vercel.json` (or disable schedule) and redeploy.
2. Unset or rotate Agent OS email / Resend values in Vercel if sends must stop immediately.
3. Leave Supabase `agent_os_*` tables in place (preserves anti-duplication) unless a deliberate data wipe is approved.
4. Resolve any `uncertain` rows before re-enabling sends.
5. If code rollback is required: redeploy the pre-Agent-OS production SHA; keep cron disabled.

---

## 19. Retention-cleanup follow-up

Claim-row automatic purge is **not** enabled. Intended retention ≈ 90 days. Implement and enable cleanup shortly after scheduled-live activation (operational debt; non-blocking for first smoke, blocking for long-lived production neglect).

---

## 20. Daily-versus-weekly content differentiation follow-up

Daily and weekly currently share the same `runAgentOsBrief` synthesis and email renderer; differentiation is scheduling/window/anti-redundancy. Product follow-up: action-focused daily vs deeper weekly brief content (non-blocking for activation safety).

---

## 21. Prohibited shortcuts

- Do not send via raw Resend scripts outside `executeAgentOsCadence`.
- Do not use memory/file adapters for Production scheduled-live.
- Do not treat CLI `--test` as Production delivery (fake by default; `--allow-real-email` is still not the approved prod path).
- Do not pass cron secrets in query strings.
- Do not bypass durable claims, fingerprint cooldowns, or `uncertain` blocks.
- Do not apply schema with anon keys or to the wrong Supabase project.
- Do not enable cron before a successful controlled smoke test.
- Do not commit secrets or stage `marketing-sprint/` / `tmp/`.
- Do not contact customers or enable autonomous non-email writes.
