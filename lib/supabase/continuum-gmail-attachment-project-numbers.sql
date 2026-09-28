-- Exact Gmail attachment project-number lookup functions.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Run this file alone in the main Supabase SQL Editor, before the index file.
-- Do not paste it together with the index file. The editor sends one script
-- as one simple query, and Postgres runs a multi-statement script as one
-- transaction. CREATE INDEX CONCURRENTLY cannot run in that transaction.
--
-- Additive. Does not rewrite filename, message, or attachment bytes.
-- No index in this file, so applying it does not lock attachment writes.
-- Current Production does not call these functions.
-- Applying this before the Project Book deploy does not change desk,
-- Today, Calendar, or SMS behavior.
--
-- Normalization: uppercase the filename, turn every non-letter/digit run
-- into a space, then keep whole tokens C + 5 digits, SP + 4 digits, or
-- RN + 4 digits. A token embedded in a longer alphanumeric word is ignored.
-- C0255192 is its own token. It is not the token C025519.
--
-- Rollback, after the index is gone, in order:
--   drop function public.continuum_gmail_thread_ids_for_project_number(text);
--   drop function public.continuum_gmail_attachment_project_numbers(text);
-- Drop the index first. Attachment inserts fail if the index remains
-- and this function is gone.

create or replace function public.continuum_gmail_attachment_project_numbers(p_filename text)
returns text[]
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select coalesce(
    (
      select array_agg(distinct (m)[1])
      from regexp_matches(
        regexp_replace(upper(coalesce(p_filename, '')), '[^A-Z0-9]+', ' ', 'g'),
        '\m(C[0-9]{5,}|SP[0-9]{4,}|RN[0-9]{4,})\M',
        'g'
      ) as m
    ),
    '{}'::text[]
  );
$$;

comment on function public.continuum_gmail_attachment_project_numbers(text) is
  'Exact C/SP/RN tokens in one attachment filename. Index expression. No body.';

revoke all on function public.continuum_gmail_attachment_project_numbers(text) from public;
revoke all on function public.continuum_gmail_attachment_project_numbers(text) from anon;
revoke all on function public.continuum_gmail_attachment_project_numbers(text) from authenticated;
grant execute on function public.continuum_gmail_attachment_project_numbers(text) to service_role;

-- The GIN index is a separate single-statement file:
-- continuum-gmail-attachment-project-numbers-index.sql
-- Run that only after this function exists.

create or replace function public.continuum_gmail_thread_ids_for_project_number(p_identifier text)
returns table (thread_id text)
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  select distinct attachments.thread_id
  from public.continuum_gmail_attachments as attachments
  where p_identifier ~ '^(C[0-9]{5,}|SP[0-9]{4,}|RN[0-9]{4,})$'
    and public.continuum_gmail_attachment_project_numbers(attachments.filename)
      @> array[upper(p_identifier)]::text[]
  limit 32;
$$;

comment on function public.continuum_gmail_thread_ids_for_project_number(text) is
  'Thread ids whose attachment filenames contain one exact project number. Read only.';

revoke all on function public.continuum_gmail_thread_ids_for_project_number(text) from public;
revoke all on function public.continuum_gmail_thread_ids_for_project_number(text) from anon;
revoke all on function public.continuum_gmail_thread_ids_for_project_number(text) from authenticated;
grant execute on function public.continuum_gmail_thread_ids_for_project_number(text) to service_role;
