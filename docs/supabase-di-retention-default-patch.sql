-- Diamond Intelligence — final production default patch
-- APPLIED in production: 2026-07-22 (founder-supervised)
-- Outcome: SUCCESS — live default changed indefinite → 30_days
-- Aggregate row counts unchanged by this patch (382 before/after)
-- Scope: column DEFAULT + comment only (no row updates, deletes, RLS, storage, indexes)
--
-- Companion: docs/supabase-di-retention-backlog-closeout-2026-07.md
--           docs/supabase-operational-verification-2026-07.md

-- ── PRE-CHECK (read-only) — recorded before apply ───────────────────────────
-- select column_name, column_default, is_nullable, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name = 'diamond_intelligence_submissions'
--   and column_name = 'metadata_retention_policy';
-- Observed before: column_default = 'indefinite'::text

-- ── REQUIRED PATCH (applied 2026-07-22) ─────────────────────────────────────
alter table diamond_intelligence_submissions
  alter column metadata_retention_policy set default '30_days';

comment on column diamond_intelligence_submissions.metadata_retention_policy is
  'Retention label. Application cleanup eligibility uses created_at age (30 days), not this label alone. New inserts should use 30_days.';

-- ── POST-CHECK (read-only) — recorded after apply ───────────────────────────
-- Same select as pre-check.
-- Observed after: column_default = '30_days'::text
-- OpenAPI probe after apply: default "30_days"
-- Aggregates unchanged by patch:
--   total_rows 382 | older_than_30_days 365 | indefinite 382 | thirty_day 0
--   null_file_path 28 | non_null_file_path 354

-- ── ROLLBACK (default only; does not rewrite row labels) ────────────────────
-- Only if needed; do not run unless reversing the default intentionally.
-- alter table diamond_intelligence_submissions
--   alter column metadata_retention_policy set default 'indefinite';
