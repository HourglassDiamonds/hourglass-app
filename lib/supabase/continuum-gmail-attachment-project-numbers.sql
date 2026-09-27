-- Exact Gmail attachment project-number lookup.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Additive. Does not rewrite filename, message, or attachment bytes.
-- Current Production inserts name their columns and keep working.
-- Postgres maintains the index when filename changes.
-- Current Production does not call the lookup function.
-- Applying this before the Project Book deploy does not change desk,
-- Today, Calendar, or SMS behavior.
--
-- Not full-text search. Not trigram search. Not fuzzy matching.
-- The index stores exact C / SP / RN tokens extracted from filename.
--
-- Rollback, in order:
--   drop function public.continuum_gmail_thread_ids_for_project_number(text);
--   drop index public.continuum_gmail_attachments_project_numbers_idx;
--   drop function public.continuum_gmail_attachment_project_numbers(text);

create or replace function public.continuum_gmail_attachment_project_numbers(p_filename text)
returns text[]
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select coalesce(
    (
      select array_agg(distinct upper((m)[1]))
      from regexp_matches(
        regexp_replace(coalesce(p_filename, ''), '[^A-Za-z0-9]+', ' ', 'g'),
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

-- Expression matches the function above so the planner can use this index.
-- Build scans existing filenames once. Writes on this table wait for that build.
create index if not exists continuum_gmail_attachments_project_numbers_idx
  on public.continuum_gmail_attachments
  using gin (public.continuum_gmail_attachment_project_numbers(filename));

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
