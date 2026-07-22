# Supabase Operational Verification — Privacy, Retention, RLS, Storage, Cron

**Date:** 2026-07-22  
**Branch:** `cursor/supabase-operational-verification`  
**Worktree:** sibling worktree `hourglass-app-supabase-ops-verify`  
**Baseline:** `origin/main` @ `3070c49d54e515bb66938220d4d937b3f0ac750d`  
**Mode:** Audit + founder-supervised production closeout (default patch + bounded cron drain).  
**Git:** Nothing staged, committed, pushed, merged, or deployed from this worktree.

Severity legend: **Critical** · **High** · **Medium** · **Low** · **Verified** · **Founder verification required**

---

## Closeout results (2026-07-22) — **Verified**

| Item | Result |
|------|--------|
| RLS enabled on `diamond_intelligence_submissions` | **true** (founder SQL) |
| Force RLS | acceptable |
| Table policies (`pg_policies`) | **0 rows** |
| anon/authenticated grants | standard grants; **no policies allow access** |
| Bucket `diamond-intelligence-submissions` | **private**; storage policies **0** |
| Bucket `shape-studio-captures` | **private**; storage policies **0** |
| Default before patch | `'indefinite'::text` |
| Default after patch | `'30_days'::text` |
| Aggregates unchanged by patch | 382 / 365 older / 382 indefinite / 0 `30_days` / 28 null path / 354 non-null |
| Cron readiness | Production env names present; schedule `45 5 * * *`; unauth **401** |
| Backlog drain | **4 batches** via `vercel crons run`; rowsDeleted **365**; **failed 0** |
| Final older_than_30_days | **0** |
| Final total rows | **17** (inside retention window; labels still `indefinite`, no backfill) |
| PII in cleanup logs/responses | **None observed** (aggregates only) |
| Public smokes | `/` `/privacy` `/diamond-intelligence` → **200**; cleanup unauth → **401** |
| Service-role rotation | still **Founder verification required** |
| Analyze Sparkle scaling | **GO** (monitor daily cron) |

Full batch table: `docs/supabase-di-retention-backlog-closeout-2026-07.md`.

---

## 1. Executive summary

Repository architecture matches the intended server-only service-role model for Diamond Intelligence (DI) and Shape Studio. Both storage buckets are **private**. DI cleanup eligibility uses `created_at`. The approved default patch and bounded cron drain completed under founder supervision on 2026-07-22.

| Finding | Severity |
|---------|----------|
| DI default now `'30_days'`; backlog drained (`older_than_30_days = 0`) | **Verified** |
| Remaining 17 rows within 30-day window; labels may still say `indefinite` (no backfill) | **Low** / expected |
| `shape_studio_sessions` table still absent; storage JSON fallback | **Medium** |
| Shape Studio tombstone JSON never purged | **Medium** |
| Service-role rotation completion | **Founder verification required** |

**Bottom line:** DI 30-day retention is **live and operational** (default + successful cleanup). Marketing and Analyze Sparkle scaling may proceed with ongoing cron monitoring. Write-capable Agent OS still warrants caution until service-role rotation is confirmed.

---

## 2. Repository architecture

### 2.1 Supabase client initialization — **Verified**

| Location | Surface | Credentials |
|----------|---------|-------------|
| `lib/supabase/client.ts` → `getSupabaseAdmin()` | Server-only singleton (`@supabase/supabase-js`) | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` via `lib/intelligence/env.ts` |
| Scripts (`scripts/shape-studio-*.ts`, etc.) | Node/CLI | Same server env |

No browser Supabase client. No `@supabase/ssr` / `createBrowserClient`.

### 2.2 Environment variables (names only) — **Verified**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `SHAPE_STUDIO_PUBLIC_ORIGIN` (origin helper; not a credential)

Related hygiene: `assertNoPrefixedServerSecrets()` rejects `NEXT_PUBLIC_` prefixes for server-only names including Supabase and cron secrets (`lib/intelligence/validate-env.ts`).

### 2.3 `NEXT_PUBLIC_*` credential exposure — **Verified** (safe in repo)

- No `NEXT_PUBLIC_SUPABASE_*` references found.
- Client-safe public env documented: `NEXT_PUBLIC_GA_ID` only.

### 2.4 Tables

| Feature | Table | Notes |
|---------|-------|-------|
| Diamond Intelligence | `diamond_intelligence_submissions` | Archive + retention |
| Shape Studio | `shape_studio_sessions` | Preferred; storage JSON fallback if missing |

### 2.5 Storage buckets

| Bucket | Intended access |
|--------|-----------------|
| `diamond-intelligence-submissions` | Private; service-role upload/delete |
| `shape-studio-captures` | Private; service-role + short-lived signed URLs |

### 2.6 Helpers (upload / signed URL / delete / cleanup)

| Area | Key modules |
|------|-------------|
| DI | `lib/supabase/diamond-intelligence-submissions.ts`, `lib/diamond-intelligence/submission-archive.ts`, `lib/diamond-intelligence/submission-retention.ts` |
| Shape Studio | `lib/shape-studio/sessions.ts`, `session-storage.ts`, `session-capture-delete.ts`, `session-config.ts` |

DI cleanup: storage delete first → row delete; missing object idempotent; storage failure retains row; batch **100**.

Shape Studio: 30-minute TTL; delete capture on consume/cancel/expire; daily ≤24h backstop; **does not** delete tombstone JSON (`SHAPE_STUDIO_TOMBSTONE_TTL_MS` defined but unused).

### 2.7 Service-role consumers (routes)

- `app/api/cron/diamond-intelligence-submission-cleanup`
- `app/api/cron/shape-studio-capture-cleanup`
- `app/api/cron/weekly-intelligence`
- `app/api/diamond-intelligence/interpret`, `ingest-url`
- `app/api/shape-studio/sessions*`
- Calibration / intelligence / executive-dashboard load paths

### 2.8 SQL files

| File | RLS | Public policies |
|------|-----|-----------------|
| `lib/supabase/diamond-intelligence-submissions-schema.sql` | Enables RLS; **no** `CREATE POLICY` | None (service-role by design) |
| `lib/supabase/shape-studio-sessions-schema.sql` | **Does not** enable RLS | None; bucket via Dashboard |
| `lib/supabase/schema.sql` | RLS on intelligence tables | None |
| `lib/supabase/calibration-schema.sql` | RLS on calibration | None |

### 2.9 Cleanup vs live schema assumptions — **Verified** (app-safe)

- Cleanup query filters **only** `created_at < cutoff` — does not require default `'30_days'`.
- Insert path always sets `metadata_retention_policy` to `"30_days"` from app constant.
- Live app remains compatible before SQL default change.
- Legacy `indefinite` rows **are** eligible by `created_at`.

### 2.10 Operational alerts — **Medium**

| Cron | Behavior |
|------|----------|
| DI cleanup | Aggregates logged; `failed > 0` → HTTP **500** (Vercel failed-run signal) |
| Shape Studio cleanup | Returns **200** even when `errors > 0` — weaker signal |
| Neither | Slack/PagerDuty/email integration in repo |

---

## 3. Live-access capability

| Method | Status |
|--------|--------|
| Worktree `.env.local` | Absent |
| Supabase CLI linked project | Unavailable |
| Parent-repo `.env.local` + read-only fetch probe | **Used** (aggregates/config only; secrets not printed) |
| Vercel CLI (project linked via copied `.vercel` metadata, gitignored) | Cron schedule list + env **names** only |

**Live-access method:** Read-only PostgREST + Storage API via service role (parent env), plus Vercel CLI metadata.

Inspection script (not committed): `scripts/supabase-ops-readonly-inspect.mjs`

---

## 4. Verified live database state

### 4.1 Diamond Intelligence — partially **Verified**

| Check | Result |
|-------|--------|
| Table exists | **Verified** (yes) |
| Columns `created_at`, `file_path`, `metadata_retention_policy`, `upload_expires_at`, `ocr_text_expires_at`, `source_type`, `page_image_paths` | **Verified** (present) |
| OpenAPI default for `metadata_retention_policy` | **`'indefinite'`** — **High** gap vs approved `'30_days'` |
| Indexes on `created_at` | **Founder verification required** (SQL `pg_indexes`) |
| RLS enabled / policies | **Founder verification required** |
| anon/authenticated grants | **Founder verification required** |

**Counts only (2026-07-22 probe):**

| Metric | Count |
|--------|-------|
| Total rows | 382 |
| Older than 30 days | 365 |
| `metadata_retention_policy = 'indefinite'` | 382 |
| `metadata_retention_policy = '30_days'` | 0 |
| `file_path` null | 28 |
| `file_path` non-null | 354 |

No row contents, IDs, paths, OCR, filenames, or URLs retrieved.

### 4.2 Shape Studio sessions — **Verified** (table absent)

| Check | Result |
|-------|--------|
| `shape_studio_sessions` in OpenAPI | **Absent** |
| REST counts | **404 Not Found** |
| Runtime path | Private-bucket JSON under `sessions/{id}.json` (by design fallback) |
| RLS / indexes / status counts | N/A until table created — **Founder verification required** after optional table creation |

---

## 5. Verified live storage state

| Bucket | public | file_size_limit | allowed_mime_types |
|--------|--------|-----------------|--------------------|
| `diamond-intelligence-submissions` | **false** | 52428800 (50 MB) | pdf + jpeg/jpg/png/webp/heic/heif |
| `shape-studio-captures` | **false** | null (unset) | null (unset) |

Both expected buckets present. Total project buckets observed: **2**.

Signed URLs are the intended customer-facing read path for Shape Studio captures (repo). DI archive is not customer-download oriented.

Storage **object policies** (anon/authenticated select): **Founder verification required** (Dashboard / SQL).

---

## 6. RLS findings

| Table | Repo intent | Live |
|-------|-------------|------|
| `diamond_intelligence_submissions` | RLS on; no public policies | **Founder verification required** |
| `shape_studio_sessions` | SQL does **not** enable RLS (**High** if table is created as-is) | Table absent |
| Intelligence / calibration | RLS on; no public policies | Out of DI/SS scope; not re-probed |

**Repo:** No `CREATE POLICY` statements granting anon/authenticated access for these private workflows.

---

## 7. Bucket privacy findings — **Verified** (bucket flags)

- Both DI and Shape Studio buckets: **`public: false`**.
- DI MIME + size limits match approved SQL.
- Shape Studio bucket lacks MIME/size limits in live metadata (**Low** — tighten optionally).
- Object-level policies: **Founder verification required**.

---

## 8. DI schema delta (live vs approved SQL)

| Approved change | Live status |
|-----------------|-------------|
| Table + core columns | Present |
| URL-ingestion columns (`source_type`, etc.) | Present |
| Retention columns (`upload_expires_at`, `ocr_text_expires_at`, `metadata_retention_policy`) | Present |
| Default `'30_days'` on `metadata_retention_policy` | **Missing** (live default `'indefinite'`) |
| `created_at` index | **Founder verification required** |
| RLS enable | **Founder verification required** |
| Optional indefinite→30_days label backfill | Not applied (all 382 still `indefinite`) |
| Comments | Operational docs only |

Assessments:

1. Changing default to `'30_days'` is **additive and non-destructive**.
2. No columns need adding for cleanup.
3. Index presence: founder SQL check.
4. Comments are operational only.
5. No RLS policy alterations in the proposed patch.
6. Label backfill optional; **not required** for cleanup (`created_at`).
7. Cleanup eligibility does **not** require destructive backfill.

---

## 9. Exact proposed SQL patch

**File:** `docs/supabase-di-retention-default-patch.sql`

```sql
-- REQUIRED
alter table diamond_intelligence_submissions
  alter column metadata_retention_policy set default '30_days';

-- OPTIONAL (commented in file) — label backfill only
-- update diamond_intelligence_submissions
-- set metadata_retention_policy = '30_days'
-- where metadata_retention_policy = 'indefinite';
```

**Do not execute without founder approval.**

---

## 10. Rollback notes

```sql
alter table diamond_intelligence_submissions
  alter column metadata_retention_policy set default 'indefinite';
```

- Does not restore prior row labels if optional backfill was run (would need a separate reverse `UPDATE` with known criteria).
- Does not affect already-deleted rows/objects.
- Application insert path continues to write `'30_days'` explicitly regardless of default.

---

## 11. Service-role posture — **Verified** (repository)

1. Service-role client is server-only — **Verified**.
2. No service-role use in client components — **Verified** (no browser client).
3. No JWT/`sb_secret_` material found via scoped `git grep` on tracked sources — **Verified** for current tree (docs note historical exposure).
4. No `NEXT_PUBLIC_*` service-role variable — **Verified**.
5. Missing service-role → `getSupabaseAdmin()` returns null; routes fail closed with unavailable/503 patterns — **Verified** in code.
6. Logs avoid printing key values — **Verified** for inspected cleanup/archive paths (aggregates / generic messages).

Vercel Production has encrypted `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (names confirmed; values not read).

---

## 12. Rotation checklist — status: **Founder verification required**

Docs (`docs/intelligence-engine-setup.md`) state a past exposure and require rotation. Completion cannot be proven from this pass.

Safe checklist (no key values):

1. Supabase Dashboard → Project Settings → API → generate/reset **service_role**.
2. Update Vercel Production (and Preview/Development if used) `SUPABASE_SERVICE_ROLE_KEY`.
3. Update local `.env.local` only (gitignored).
4. Redeploy production.
5. Smoke: DI interpret (no customer PII in logs), Shape Studio capture create/upload/ack, both cleanup routes auth with `CRON_SECRET` (do not dump responses with paths).
6. Confirm no spike of 401/503 on those routes.
7. Revoke/invalidate old key in Supabase (reset completes this).
8. Emergency rollback: restore previous key in Vercel only if Supabase still accepts it; otherwise re-issue and redeploy.

---

## 13. Cron readiness / history

### Repository + Vercel registration — **Verified**

| Job | Path | Schedule (UTC) | Auth | Fail-closed |
|-----|------|----------------|------|-------------|
| Shape Studio cleanup | `/api/cron/shape-studio-capture-cleanup` | `15 4 * * *` | Bearer / `x-cron-secret` | Auth yes; partial errors still **200** |
| DI cleanup | `/api/cron/diamond-intelligence-submission-cleanup` | `45 5 * * *` | Same | Auth yes; `failed > 0` → **500** |
| Weekly intelligence | `/api/cron/weekly-intelligence` | `0 13 * * 1` | Same | Unchanged |

- Schedules do not overlap materially (04:15, 05:45 daily; weekly Monday 13:00).
- Responses/logs: aggregate counts only (by design).
- `CRON_SECRET` present in Vercel Production (encrypted; age metadata ~62d).

### Execution history — **Founder verification required**

- Pass A (`4bd4cb7`) landed **2026-07-22**; production deploy of `3070c49` observed same day.
- DI cleanup cron therefore may **not** have completed any successful daily run yet.
- **365** rows older than 30 days is consistent with “implemented, not yet drained.”
- Do **not** claim cron success without Dashboard evidence.
- This pass did **not** invoke authenticated production cleanup.

**Founder Dashboard steps:**

1. Vercel → Project `hourglass-app` → **Cron Jobs** (or Logs).
2. Filter paths above for last 7–14 days.
3. Record: latest status, HTTP status, duration, success/failure counts, retries.
4. For DI: expect eventual decrease in “older than 30 days” aggregate after successful runs (batch 100/day → multi-day drain for 365 rows).

---

## 14. Retention readiness

| System | Intended | Live readiness |
|--------|----------|----------------|
| DI 30-day file + row | Code + cron registered | **High** gap until first successful cleanups drain backlog; default SQL still wrong label |
| Shape Studio 30-min + 24h backstop | Code + cron registered | Capture deletion path **Verified** in repo; table absent → storage JSON path; tombstones accumulate |
| Privacy page disclosure | Present (`app/privacy/page.tsx`) | Aligned with intended behavior |

App remains safe before default SQL change. Cleanup does not depend on label backfill.

---

## 15. Orphan-risk assessment

| Scenario | Assessment |
|----------|------------|
| Storage without row (DI) | Possible if insert fails after upload; **compensating delete** exists (`insertDiamondIntelligenceArchiveWithCompensation`) |
| Compensating delete fails | Logged generically; historical orphans **may** exist — **Medium** |
| Row without storage | Supported (28 null `file_path`); cleanup deletes row after treating missing storage as OK |
| Historical orphan measurement | Requires object listing — **not performed** (would expose identifiers). Prefer founder aggregate inventory later |
| Shape Studio orphans | Capture delete on lifecycle; tombstone JSON retained; unclaimed captures covered by cron when reachable |

---

## 16. Shape Studio metadata accumulation — **Medium–High**

- Capture images: deleted on consume/cancel/expire + daily backstop — **Verified** in code.
- Postgres rows (if table created later): consumed/cancelled/expired **not** deleted by cron — accumulation risk.
- Live today: **no Postgres table**; session JSON tombstones under `sessions/` **explicitly not deleted**; `SHAPE_STUDIO_TOMBSTONE_TTL_MS` unused.
- Risk is metadata growth / storage clutter, not indefinite customer photo retention **if** capture cleanup succeeds.

**Recommendation (future, not this pass):** purge tombstones older than TTL; if creating `shape_studio_sessions`, enable RLS (no public policies) and add bounded terminal-row purge.

---

## 17. Privacy deletion-request runbook (internal)

**Audience:** Founder / authorized operator only.  
**Do not** build a customer portal in this pass.  
**Always verify identity** before deletion.

### 17.1 Intake

1. Request arrives (email: privacy contact on `/privacy`).
2. Record request date, channel, and verification method used.
3. Do **not** paste customer content into tickets, chat, or git.

### 17.2 Identity verification (required)

Accept only after one of:

- Reply from the **same email** used in a HubSpot consultation, **or**
- Founder-confirmed offline verification for known clients.

Refuse or escalate if identity cannot be established.

### 17.3 Consultation information (HubSpot)

| Item | Detail |
|------|--------|
| System of record | HubSpot CRM |
| Locate | Search by verified email / phone |
| Delete | Contact + associated form submissions per HubSpot process |
| Cannot locate without | Email/phone/name identifiers |
| Proof | HubSpot deletion confirmation / empty search screenshot (redact PII in archives) |

### 17.4 Shape Studio hand photos (Supabase)

| Item | Detail |
|------|--------|
| System of record | Bucket `shape-studio-captures` (+ optional `shape_studio_sessions` if created later) |
| Locate | Requires **session id** or approximate time window; photos are not keyed by email |
| Delete | Service-role remove of session prefix `{sessionId}/` and optional `sessions/{sessionId}.json` |
| Cannot locate without | Session id, or narrow time + founder investigation (avoid broad listing) |
| Proof | Confirm objects absent via targeted prefix check; log aggregates only |

### 17.5 Diamond Intelligence submissions (Supabase)

| Item | Detail |
|------|--------|
| System of record | `diamond_intelligence_submissions` + bucket `diamond-intelligence-submissions` |
| Locate | Prefer **submission id**; secondary: report number + created_at window (minimize SELECT columns) |
| Delete | Storage object(s) first, then row (same order as cron). Missing storage is OK |
| Cannot locate without | id / report number / tight time window |
| Proof | Count query for matching filter = 0; storage prefix empty |

### 17.6 Expected response process

1. Verify identity.  
2. Delete in systems of record.  
3. Reply with confirmation of categories deleted / not found — **without** restating sensitive content.  
4. File internal note: date, systems touched, aggregate outcome only.

### 17.7 Areas needing documented founder procedure

- HubSpot retention vs legal hold.
- DI lookup without id (policy for time-window searches).
- Shape Studio when only “I used the tool on date X” is known.
- Analytics (GA4) deletion is external to Supabase — separate Google process.

---

## 18. Founder-only operational checklist

1. **Approve and run** `docs/supabase-di-retention-default-patch.sql` (required statement only) in Supabase SQL editor.  
2. Optional: decide on label backfill after counsel/ops review.  
3. **Verify RLS** (SQL below) for `diamond_intelligence_submissions`.  
4. **Verify storage policies** for both buckets (no anon/authenticated SELECT/INSERT).  
5. Confirm **first successful DI cleanup** runs in Vercel; watch backlog (365 → down by ≤100/day).  
6. Confirm Shape Studio cleanup success/failure signals (consider fail-closed hardening later).  
7. Decide whether to **create** `shape_studio_sessions` with RLS enabled (update repo SQL first).  
8. Complete **service-role rotation verification** (or rotate if uncertain).  
9. Optional: set MIME/size limits on `shape-studio-captures`.  
10. Do **not** manually invoke cleanup until cron auth and monitoring are confirmed.

### Founder SQL — read-only verification (aggregates / catalog only)

```sql
-- RLS flag
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('diamond_intelligence_submissions', 'shape_studio_sessions');

-- Policies (expect none for public roles on DI)
select schemaname, tablename, policyname, roles, cmd, qual
from pg_policies
where tablename in ('diamond_intelligence_submissions', 'shape_studio_sessions');

-- Default
select column_name, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'diamond_intelligence_submissions'
  and column_name = 'metadata_retention_policy';

-- Indexes
select indexname, indexdef
from pg_indexes
where tablename = 'diamond_intelligence_submissions';

-- DI aggregates only
select
  count(*) as total,
  count(*) filter (where created_at < now() - interval '30 days') as older_30d,
  count(*) filter (where metadata_retention_policy = 'indefinite') as indefinite_label,
  count(*) filter (where metadata_retention_policy = '30_days') as label_30d,
  count(*) filter (where file_path is null) as null_path,
  count(*) filter (where file_path is not null) as with_path
from diamond_intelligence_submissions;
```

Storage policies: Supabase Dashboard → Storage → each bucket → Policies (confirm no public read).

---

## 19. Go / no-go recommendations

| Surface | Recommendation | Rationale |
|---------|----------------|-----------|
| Continued marketing | **GO** | Privacy disclosure live; buckets private; DI retention default + cleanup proven |
| Analyze Sparkle scaling | **GO** | Backlog drained; default `30_days`; monitor daily cron |
| Read-only Agent OS | **GO** | No write path to customer archives if scoped read-only |
| Write-capable Agent OS | **CAUTION** | RLS/policies verified empty for DI; confirm service-role rotation; Shape Studio tombstones still accumulate |

---

## 20. Verified vs founder verification required

### Verified in this pass

- Baseline hash and isolated worktree/branch
- Server-only service-role architecture; no `NEXT_PUBLIC_` Supabase secrets in repo
- DI + Shape Studio helpers, cron routes, schedules, auth fail-closed for missing secret
- Live: DI table + retention columns; counts; private buckets + DI limits
- Live: Shape Studio table absent; both buckets present/private
- Live: `metadata_retention_policy` default still `indefinite`; all rows labeled `indefinite`
- Vercel: three crons registered; `CRON_SECRET` / Supabase env names present in Production
- Compensating DI storage delete on insert failure (code)
- Proposed SQL patch prepared (not executed)

### Founder verification required

- RLS enabled + policy inventory (DB)
- Storage object policies
- Index presence for DI `created_at`
- Cron **execution** history / first successful DI drain
- Service-role **rotation completion**
- Optional Shape Studio table creation + RLS
- Optional indefinite label backfill
- Orphan object inventory (without exposing identifiers in shared docs)

---

## Validation performed

- Repository inspection across client, SQL, cron, retention, privacy page
- Read-only live probe (`scripts/supabase-ops-readonly-inspect.mjs`) — aggregates/config only
- OpenAPI default inspection for `metadata_retention_policy`
- Vercel `cron ls` + `env ls` (names only)
- SQL patch reviewed for idempotent non-destructive default change
- **Not** run: production migrations, authenticated cleanup, test customer uploads, object name enumeration
- **No** scoped app lint required (no application runtime code changed; probe script only)

---

## Confirmation

- **No production mutation** occurred (no SQL apply, no deletes, no bucket/RLS/env/cron changes, no authenticated cleanup invoke).
- **Nothing** was staged, committed, pushed, merged, or deployed from this worktree.
