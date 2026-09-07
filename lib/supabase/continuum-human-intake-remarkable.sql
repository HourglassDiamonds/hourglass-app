-- Continuum Human Intake #21 — reMarkable V1 additive source metadata.
-- UNAPPLIED. DO NOT RUN AGAINST PRODUCTION from this change.
--
-- Additive only. Does not rewrite continuum_human_sources storage.
-- Original export filename for founder-uploaded reMarkable PDF/PNG/JPEG.
-- Does not add OCR, cloud mailbox watching, or reMarkable account sync.
-- Does not create Persons, Open Jobs, kernel rows, or continuum_commitments.

alter table public.continuum_human_sources
  add column if not exists original_filename text;

comment on column public.continuum_human_sources.original_filename is
  'Founder-uploaded export filename. Not a public URL. Not OCR text.';

-- Explicitly: do not add anon/authenticated grants or policies.
-- Do not create continuum_open_jobs or continuum_commitments.
-- Do not apply OCR or Diamond Intelligence extractors.
