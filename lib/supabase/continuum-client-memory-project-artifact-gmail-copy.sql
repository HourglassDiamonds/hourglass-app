-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
-- Client Memory Sprint #15 — Gmail attachment COPY-IN identity for Project Artifacts.
-- Additive only. Does not copy bytes. Does not alter #16B incremental Gmail sync.
-- Does not create a second artifact system. continuum_project_artifacts remains canonical.
-- Unique identity: destination Project + Gmail message id + attachment id.
-- Encoded in source_ref as gm1|{messageId}|{attachmentId}[|{threadId}|{sentAt}|{fromEmailHash}]
-- Extra provenance is packed only when it fits the existing 240-character source_ref limit.
-- Sender is the indexed from-email hash only. Raw mailbox addresses and bodies are not stored.
-- Copied-at is created_at. original_filename and mime_type remain #14 columns.

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
