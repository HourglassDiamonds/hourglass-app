-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- One statement. Run it alone in the main Supabase SQL Editor
-- (dashboard query editor, application name supabase/dashboard-query-editor).
-- Do not paste it into the same run as any other statement.
-- Do not run it with supabase db push. That wraps each file in a transaction,
-- and CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
--
-- Requires continuum_gmail_attachment_project_numbers(text) from
-- continuum-gmail-attachment-project-numbers.sql.
--
-- ShareUpdateExclusiveLock. Attachment inserts, updates, and deletes continue.
-- Schema changes on continuum_gmail_attachments wait until this build finishes.
-- Only one concurrent index build can run on this table at a time.
--
-- If this fails, Postgres can leave an invalid index that queries ignore and
-- writes still maintain. Do not retry with IF NOT EXISTS. Check indisvalid
-- with continuum-gmail-attachment-project-numbers-index-check.sql.
-- When indisvalid is false, run this alone, then rerun the statement below:
--   drop index concurrently if exists public.continuum_gmail_attachments_project_numbers_idx;
--
-- Rollback, as its own statement, before dropping the extractor function:
--   drop index concurrently if exists public.continuum_gmail_attachments_project_numbers_idx;

create index concurrently continuum_gmail_attachments_project_numbers_idx
  on public.continuum_gmail_attachments
  using gin (public.continuum_gmail_attachment_project_numbers(filename));
