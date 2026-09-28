-- READ ONLY. Not a migration. Do not treat this as schema to apply.
-- Run in the main Supabase SQL Editor while the concurrent index builds,
-- and again after it finishes. PostgREST does not expose pg_catalog.
-- These selects return catalog flags and counts. They do not return
-- filenames, message text, query text, or attachment bytes.

select c.relname, i.indisvalid, i.indisready, i.indislive
from pg_index i
join pg_class c on c.oid = i.indexrelid
where c.relname = 'continuum_gmail_attachments_project_numbers_idx';

select phase, blocks_done, blocks_total, tuples_done, tuples_total
from pg_stat_progress_create_index
where relid = 'public.continuum_gmail_attachments'::regclass;

select c.relname
from pg_index i
join pg_class c on c.oid = i.indexrelid
join pg_class t on t.oid = i.indrelid
where t.relname = 'continuum_gmail_attachments'
  and (not i.indisvalid or not i.indisready);

select l.mode, l.granted, a.state, a.wait_event_type, a.wait_event
from pg_locks l
join pg_class c on c.oid = l.relation
left join pg_stat_activity a on a.pid = l.pid
where c.relname = 'continuum_gmail_attachments';

select count(*) as lock_waits
from pg_locks l
join pg_class c on c.oid = l.relation
where c.relname = 'continuum_gmail_attachments'
  and not l.granted;

select max(indexed_at) as latest_attachment_indexed_at
from public.continuum_gmail_attachments;

select max(indexed_at) as latest_message_indexed_at
from public.continuum_gmail_messages;
