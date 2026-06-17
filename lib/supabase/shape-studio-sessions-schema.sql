-- Diamond Shape Studio — temporary QR capture sessions (isolated from DI archive).
-- Run manually in Supabase SQL editor when enabling phone capture handoff.
--
-- ISOLATION: Creates only shape_studio_sessions + one index. Does not alter
-- diamond_intelligence_submissions or any DI tables, buckets, or policies.
--
-- STORAGE (Supabase Dashboard → Storage → New bucket):
--   Name: shape-studio-captures  (exact, hyphenated)
--   Public: OFF (private bucket)
--   App uploads via service role; desktop receives signed URLs only.
--
-- ENV (already used by DI/calibration):
--   SUPABASE_URL
--   SUPABASE_SERVICE_ROLE_KEY
-- Optional: SHAPE_STUDIO_PUBLIC_ORIGIN for QR links in production.
--
-- LOCAL DEV QR: Phone must reach your dev machine. localhost QR URLs only work
-- on the same device. Use LAN IP, ngrok, or a deployed preview for real phones.
--
-- VERIFY: npx tsx --env-file=.env.local scripts/shape-studio-qr-smoke-test.ts http://localhost:3000
--
-- NOTE: If the table is not present yet, the app automatically falls back to
-- session metadata JSON in the private `shape-studio-captures` bucket.
-- When this table exists, the app prefers Postgres over storage JSON.

create table if not exists shape_studio_sessions (
  session_id uuid primary key default gen_random_uuid(),
  status text not null default 'pending'
    check (status in ('pending', 'image_uploaded', 'expired')),
  image_path text,
  image_mime text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists shape_studio_sessions_expires_at_idx
  on shape_studio_sessions (expires_at);

-- Private bucket for temporary hand captures (create in Storage UI if not exists):
--   name: shape-studio-captures
--   public: false
-- Optional lifecycle rule: delete objects after 1 day.
