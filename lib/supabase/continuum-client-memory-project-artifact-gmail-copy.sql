-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #15 — Gmail attachment COPY-IN identity for Project Artifacts.
-- Additive #15 migration against already-live #14.
-- Production already has public.continuum_project_artifacts and the private
-- Storage bucket continuum-project-artifacts (public = false, 25 MB, image/PDF MIME).
-- This file does not recreate the #14 table, bucket, RLS, grants, or public access.
-- Existing #14 rows and all other #14 constraints are preserved.
-- Does not copy bytes. Does not alter #16B incremental Gmail sync.
-- Does not create a second artifact system. continuum_project_artifacts remains canonical.
-- Unique identity: destination Project + Gmail message id + attachment id.
-- Encoded in source_ref as gm1|{messageId}|{attachmentId}|{threadId}|{sentAt}|{fromEmailHash}
-- Exact Gmail attachment IDs are retained. They are never truncated or hashed.
-- Gmail source_ref maximum is 2048 characters. Non-Gmail remains 240.
-- Sender is the indexed from-email hash only. Raw mailbox addresses and bodies are not stored.
-- Copied-at is created_at. original_filename and mime_type remain #14 columns.

alter table public.continuum_project_artifacts
  drop constraint if exists continuum_project_artifacts_source_ref_check;

alter table public.continuum_project_artifacts
  add constraint continuum_project_artifacts_source_ref_check
  check (
    source_ref is null
    or (
      source_ref !~ E'[\\n\\r]'
      and char_length(source_ref) <=
        case
          when source_system = 'gmail' then 2048
          else 240
        end
    )
  );

-- Unique on identity (first three source_ref fields), not filename.
create unique index if not exists continuum_project_artifacts_gmail_copy_identity_uq
  on public.continuum_project_artifacts (
    project_id,
    split_part(source_ref, '|', 2),
    split_part(source_ref, '|', 3)
  )
  where source_system = 'gmail'
    and source_ref is not null
    and split_part(source_ref, '|', 1) = 'gm1';

comment on index public.continuum_project_artifacts_gmail_copy_identity_uq is
  'UNAPPLIED #15 Gmail copy-in identity. Not a mailbox mirror. Not filename dedupe.';

comment on constraint continuum_project_artifacts_source_ref_check
  on public.continuum_project_artifacts is
  'UNAPPLIED #15 additive replacement of live #14 source_ref check. Gmail 2048. Non-Gmail 240.';
