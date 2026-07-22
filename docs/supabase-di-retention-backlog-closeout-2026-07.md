# Diamond Intelligence Retention Backlog — Founder-Guided Production Closeout

**Date:** 2026-07-22  
**Branch / worktree:** `cursor/supabase-operational-verification` (sibling worktree `hourglass-app-supabase-ops-verify`)  
**Baseline:** `3070c49d54e515bb66938220d4d937b3f0ac750d`  
**Status:** **COMPLETE** — security gate passed (founder), default patch applied (founder), backlog drained via `vercel crons run` (4 batches, all `failed: 0`).

### Starting counts (pre-patch / pre-drain)

| Metric | Count |
|--------|------:|
| Total DI rows | 382 |
| Older than 30 days (eligible) | 365 |
| Labeled `indefinite` | 382 |
| Labeled `30_days` | 0 |
| With storage path | 354 |
| Without storage path | 28 |
| Live column default | `indefinite` → **`30_days` after patch** |
| Cleanup batch size | 100 |

### Final counts (post-drain)

| Metric | Count |
|--------|------:|
| Total DI rows | 17 |
| Older than 30 days | **0** |
| Labeled `indefinite` | 17 |
| Labeled `30_days` | 0 |
| null `file_path` | 2 |
| non-null `file_path` | 15 |
| Live default (OpenAPI) | **`30_days`** |

Note: remaining rows are within the 30-day window. Historical labels may still read `indefinite`; **no label backfill was performed** (not required for cleanup).

---

## Phase 1 — Security gate (founder-verified)

| Check | Result |
|-------|--------|
| RLS enabled | **true** |
| Force RLS | acceptable |
| `pg_policies` rows | **0** |
| anon/authenticated table grants | standard grants present; **no RLS policies allow access** |
| `diamond-intelligence-submissions` | **private** |
| `shape-studio-captures` | **private** |
| Storage policies on both buckets | **0** |
| Signed URLs intended for temporary Shape Studio access | unchanged |

**Gate decision:** PASS — proceeded to patch + cron drain.

---

## Phase 2–3 — Default patch

Applied (founder) exactly:

```sql
alter table diamond_intelligence_submissions
  alter column metadata_retention_policy set default '30_days';

comment on column diamond_intelligence_submissions.metadata_retention_policy is
  'Retention label. Application cleanup eligibility uses created_at age (30 days), not this label alone. New inserts should use 30_days.';
```

| Check | Result |
|-------|--------|
| Default before | `'indefinite'::text` |
| Default after | `'30_days'::text` |
| Aggregates before/after patch | **unchanged** (382 / 365 / 382 / 0 / 28 / 354) |

See `docs/supabase-di-retention-default-patch.sql`.

---

## Phase 4 — Cron readiness

| Check | Result |
|-------|--------|
| Production env names `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | present (Encrypted; values not inspected) |
| Cron registered | `/api/cron/diamond-intelligence-submission-cleanup` @ `45 5 * * *` |
| Route exists on production | unauthenticated GET → **401** `{"error":"Unauthorized"}` |
| Trigger mechanism | `vercel crons run` (no secret in CLI args/URLs) |
| Log format | `[di-submission-cleanup] { scanned, expired, storageDeleted, rowsDeleted, alreadyMissing, failed }` — aggregates only |

Public smoke: `/` 200, `/privacy` 200, `/diamond-intelligence` 200.

---

## Phase 5 — Bounded backlog drain

All invocations via:

```bash
vercel crons run /api/cron/diamond-intelligence-submission-cleanup
```

~5 minute pause between supervised batches. No parallel invocations. No `CRON_SECRET` in commands/URLs/files.

### Batch table (aggregates only)

| Batch | Timestamp (UTC) | scanned | expired | storageDeleted | rowsDeleted | alreadyMissing | failed | older_than_30_days after |
|------:|-----------------|--------:|--------:|---------------:|------------:|---------------:|-------:|-------------------------:|
| 1 | 2026-07-22T19:20:30Z | 100 | 100 | 88 | 100 | 12 | **0** | 265 |
| 2 | 2026-07-22T19:27:00Z | 100 | 100 | 98 | 100 | 2 | **0** | 165 |
| 3 | 2026-07-22T19:33:30Z | 100 | 100 | 100 | 100 | 0 | **0** | 65 |
| 4 | 2026-07-22T19:40:12Z | 65 | 65 | 53 | 65 | 12 | **0** | **0** |

**Totals:** rowsDeleted **365**; failed **0**; retained eligible failures **0**.

**PII check:** logs/responses contained aggregate fields only — no IDs, paths, filenames, OCR, report numbers, or URLs.

**Stop conditions:** none triggered.

---

## Phase 6 — Final verification

| Check | Result |
|-------|--------|
| Default `30_days` | **Verified** (founder SQL + OpenAPI) |
| older_than_30_days | **0** |
| Remaining rows | 17 (inside retention window) |
| Cron still registered | **Yes** (`45 5 * * *`) |
| Public routes | 200 |
| Cleanup without auth | 401 generic |
| Application code changed this pass | **No** |
| Vercel env / RLS / storage / buckets changed this pass | **No** (patch was default+comment only; drain used existing route) |

---

## Go / no-go (updated)

| Surface | Recommendation |
|---------|----------------|
| Continued marketing | **GO** |
| Analyze Sparkle scaling | **GO** (monitor daily cron; backlog cleared) |
| Read-only Agent OS | **GO** |
| Write-capable Agent OS | **CAUTION** — RLS verified empty policies OK for service-role model; still confirm service-role rotation separately |

**Service-role rotation:** still **Founder verification required** (historical exposure noted in setup docs; completion not proven here).

---

## Safety confirmation

- No label backfill  
- No SQL row deletes (cleanup via app route only)  
- No RLS / storage policy / bucket setting changes in this agent pass  
- No Vercel environment variable changes  
- Nothing staged, committed, pushed, merged, or deployed  
