-- DML-only, sanitized Sterling acceptance fixture.
-- Apply only to Continuum Preview project hrmpzplffuhhvbtxxhnt.
-- Never apply to Production. No correspondence bodies, invoices, or payments.
begin;

insert into public.continuum_entities (id, kind, created_at, created_by) values
  ('c1000000-0000-4000-8000-000000000001','person','2026-10-30T14:00:00Z','sterling-preview-acceptance'),
  ('c1000000-0000-4000-8000-000000000002','person','2026-10-30T14:00:00Z','sterling-preview-acceptance'),
  ('c1000000-0000-4000-8000-000000000003','person','2026-10-30T14:00:00Z','sterling-preview-acceptance'),
  ('c1000000-0000-4000-8000-000000000004','person','2026-10-30T14:00:00Z','sterling-preview-acceptance'),
  ('c1000000-0000-4000-8000-000000000005','person','2026-10-30T14:00:00Z','sterling-preview-acceptance'),
  ('d1000000-0000-4000-8000-000000000001','project','2026-10-30T14:00:00Z','sterling-preview-acceptance'),
  ('d1000000-0000-4000-8000-000000000002','project','2026-10-30T14:00:00Z','sterling-preview-acceptance'),
  ('d1000000-0000-4000-8000-000000000003','project','2026-10-30T14:00:00Z','sterling-preview-acceptance'),
  ('d1000000-0000-4000-8000-000000000004','project','2026-10-30T14:00:00Z','sterling-preview-acceptance'),
  ('d1000000-0000-4000-8000-000000000005','project','2026-10-30T14:00:00Z','sterling-preview-acceptance')
on conflict (id) do nothing;

insert into public.continuum_person_profiles
  (person_id, display_name, given_name, family_name, roles, source_system, created_at, updated_at) values
  ('c1000000-0000-4000-8000-000000000001','STERLING ACCEPTANCE SANDBOX — Morgan Jines','Morgan','Jines',array['client'],'sterling-preview-acceptance','2026-10-30T14:00:00Z','2026-10-30T14:00:00Z'),
  ('c1000000-0000-4000-8000-000000000002','STERLING ACCEPTANCE SANDBOX — Zane Kennedy','Zane','Kennedy',array['client'],'sterling-preview-acceptance','2026-10-30T14:00:00Z','2026-10-30T14:00:00Z'),
  ('c1000000-0000-4000-8000-000000000003','STERLING ACCEPTANCE SANDBOX — Madi Rutledge','Madi','Rutledge',array['client'],'sterling-preview-acceptance','2026-10-30T14:00:00Z','2026-10-30T14:00:00Z'),
  ('c1000000-0000-4000-8000-000000000004','STERLING ACCEPTANCE SANDBOX — Dylan Doerner','Dylan','Doerner',array['client'],'sterling-preview-acceptance','2026-10-30T14:00:00Z','2026-10-30T14:00:00Z'),
  ('c1000000-0000-4000-8000-000000000005','STERLING ACCEPTANCE SANDBOX — J. Pennock','J.','Pennock',array['client'],'sterling-preview-acceptance','2026-10-30T14:00:00Z','2026-10-30T14:00:00Z')
on conflict (person_id) do update set display_name=excluded.display_name, updated_at=excluded.updated_at;

insert into public.continuum_project_profiles
  (project_id, display_title, visibility, import_row_key, source_system, created_at, updated_at, project_kind) values
  ('d1000000-0000-4000-8000-000000000001','STERLING ACCEPTANCE SANDBOX — Morgan Jines — CAD','internal-only','sterling-preview-acceptance:morgan','sterling-preview-acceptance','2026-10-30T14:00:00Z','2026-10-30T14:10:00Z','custom_new_jewelry'),
  ('d1000000-0000-4000-8000-000000000002','STERLING ACCEPTANCE SANDBOX — Zane Kennedy — Production','internal-only','sterling-preview-acceptance:zane','sterling-preview-acceptance','2026-10-30T14:00:00Z','2026-10-30T14:10:00Z','custom_new_jewelry'),
  ('d1000000-0000-4000-8000-000000000003','STERLING ACCEPTANCE SANDBOX — Madi Rutledge — Declined','internal-only','sterling-preview-acceptance:madi','sterling-preview-acceptance','2026-10-30T14:00:00Z','2026-10-30T14:10:00Z','custom_new_jewelry'),
  ('d1000000-0000-4000-8000-000000000004','STERLING ACCEPTANCE SANDBOX — Dylan Doerner — Completed','internal-only','sterling-preview-acceptance:dylan','sterling-preview-acceptance','2026-10-30T14:00:00Z','2026-10-30T14:10:00Z','custom_new_jewelry'),
  ('d1000000-0000-4000-8000-000000000005','STERLING ACCEPTANCE SANDBOX — J. Pennock — Completed','internal-only','sterling-preview-acceptance:pennock','sterling-preview-acceptance','2026-10-30T14:00:00Z','2026-10-30T14:10:00Z','custom_new_jewelry')
on conflict (project_id) do update set display_title=excluded.display_title, updated_at=excluded.updated_at;

insert into public.continuum_relationships
  (id, from_entity_id, to_entity_id, kind, status, source_system, created_at, created_by)
select ('e1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       ('c1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       ('d1000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
       'client-project','active','sterling-preview-acceptance','2026-10-30T14:00:00Z','sterling-preview-acceptance'
from generate_series(1,5) n
on conflict (id) do nothing;

insert into public.continuum_project_lifecycle_states
  (project_id, project_kind, stage, entered_at, created_at, updated_at) values
  ('d1000000-0000-4000-8000-000000000001','custom_new_jewelry','cad','2026-10-30T14:10:00Z','2026-10-30T14:00:00Z','2026-10-30T14:10:00Z'),
  ('d1000000-0000-4000-8000-000000000002','custom_new_jewelry','production','2026-10-30T14:10:00Z','2026-10-30T14:00:00Z','2026-10-30T14:10:00Z'),
  ('d1000000-0000-4000-8000-000000000003','custom_new_jewelry','design','2026-10-30T14:00:00Z','2026-10-30T14:00:00Z','2026-10-30T14:00:00Z'),
  ('d1000000-0000-4000-8000-000000000004','custom_new_jewelry','completed','2026-10-30T14:10:00Z','2026-10-30T14:00:00Z','2026-10-30T14:10:00Z'),
  ('d1000000-0000-4000-8000-000000000005','custom_new_jewelry','completed','2026-10-30T14:10:00Z','2026-10-30T14:00:00Z','2026-10-30T14:10:00Z')
on conflict (project_id, project_kind) do update
set stage=excluded.stage, entered_at=excluded.entered_at, updated_at=excluded.updated_at;

insert into public.continuum_project_lifecycle_events
  (event_id, project_id, project_kind, prior_stage, new_stage, changed_at, changed_by, source_system, mutation_id) values
  ('b1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','custom_new_jewelry','design','cad','2026-10-30T14:10:00Z','sterling-preview-acceptance','concierge-manual','b2000000-0000-4000-8000-000000000001'),
  ('b1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','custom_new_jewelry','cad','production','2026-10-30T14:10:00Z','sterling-preview-acceptance','concierge-manual','b2000000-0000-4000-8000-000000000002'),
  ('b1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000004','custom_new_jewelry','ready_for_delivery','completed','2026-10-30T14:10:00Z','sterling-preview-acceptance','concierge-manual','b2000000-0000-4000-8000-000000000003'),
  ('b1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000005','custom_new_jewelry','ready_for_delivery','completed','2026-10-30T14:10:00Z','sterling-preview-acceptance','concierge-manual','b2000000-0000-4000-8000-000000000004')
on conflict (mutation_id) do nothing;

insert into public.continuum_project_jobs
  (job_id, project_id, kind, subject, detail, waiting_on_actor, associated_person_id, state,
   due_at, deferred_until, resolved_at, cancelled_at, created_at, updated_at, created_by,
   source_system, source_ref, created_mutation_id, attention_mode, activation_at, checkpoint_at, attention_metadata) values
  ('f1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','required_action','STERLING ACCEPTANCE SANDBOX — await shop CAD work','Synthetic acceptance state only; no customer correspondence.','vendor','c1000000-0000-4000-8000-000000000001','open',null,null,null,null,'2026-10-30T14:00:00Z','2026-10-30T14:10:00Z','sterling-preview-acceptance','continuum','sterling-preview-acceptance:morgan-job','a1000000-0000-4000-8000-000000000001','action',null,null,null),
  ('f1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','required_action','STERLING ACCEPTANCE SANDBOX — production monitoring','Synthetic acceptance state only; no customer correspondence.','vendor','c1000000-0000-4000-8000-000000000002','open',null,null,null,null,'2026-10-30T14:00:00Z','2026-10-30T14:10:00Z','sterling-preview-acceptance','continuum','sterling-preview-acceptance:zane-job','a1000000-0000-4000-8000-000000000002','action',null,null,null),
  ('f1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000003','required_action','STERLING ACCEPTANCE SANDBOX — stale declined follow-up','Synthetic acceptance history only; no customer correspondence.','founder','c1000000-0000-4000-8000-000000000003','cancelled',null,null,null,'2026-10-30T14:10:00Z','2026-10-30T14:00:00Z','2026-10-30T14:10:00Z','sterling-preview-acceptance','continuum','sterling-preview-acceptance:madi-job','a1000000-0000-4000-8000-000000000003','action',null,null,null),
  ('f1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000004','required_action','STERLING ACCEPTANCE SANDBOX — delivered item','Synthetic acceptance history only; no customer correspondence.','unknown','c1000000-0000-4000-8000-000000000004','resolved',null,null,'2026-10-30T14:10:00Z',null,'2026-10-30T14:00:00Z','2026-10-30T14:10:00Z','sterling-preview-acceptance','continuum','sterling-preview-acceptance:dylan-job','a1000000-0000-4000-8000-000000000004','action',null,null,null),
  ('f1000000-0000-4000-8000-000000000005','d1000000-0000-4000-8000-000000000005','required_action','STERLING ACCEPTANCE SANDBOX — delivered item','Synthetic acceptance history only; no customer correspondence.','unknown','c1000000-0000-4000-8000-000000000005','resolved',null,null,'2026-10-30T14:10:00Z',null,'2026-10-30T14:00:00Z','2026-10-30T14:10:00Z','sterling-preview-acceptance','continuum','sterling-preview-acceptance:pennock-job','a1000000-0000-4000-8000-000000000005','action',null,null,null)
on conflict (job_id) do update set waiting_on_actor=excluded.waiting_on_actor, state=excluded.state,
  resolved_at=excluded.resolved_at, cancelled_at=excluded.cancelled_at, updated_at=excluded.updated_at;

insert into public.continuum_project_job_mutations
  (mutation_id, job_id, project_id, action, prior_state, new_state, changed_at, changed_by, source_system, operation) values
  ('a1000000-0000-4000-8000-000000000001','f1000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','create',null,'open','2026-10-30T14:00:00Z','sterling-preview-acceptance','continuum','{"fixture":"sterling-preview-acceptance-v1"}'),
  ('a1000000-0000-4000-8000-000000000002','f1000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','create',null,'open','2026-10-30T14:00:00Z','sterling-preview-acceptance','continuum','{"fixture":"sterling-preview-acceptance-v1"}'),
  ('a1000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000003','create',null,'open','2026-10-30T14:00:00Z','sterling-preview-acceptance','continuum','{"fixture":"sterling-preview-acceptance-v1"}'),
  ('a2000000-0000-4000-8000-000000000003','f1000000-0000-4000-8000-000000000003','d1000000-0000-4000-8000-000000000003','cancel','open','cancelled','2026-10-30T14:10:00Z','sterling-preview-acceptance','continuum','{"fixture":"sterling-preview-acceptance-v1","founderReview":"synthetic"}'),
  ('a1000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000004','create',null,'open','2026-10-30T14:00:00Z','sterling-preview-acceptance','continuum','{"fixture":"sterling-preview-acceptance-v1"}'),
  ('a2000000-0000-4000-8000-000000000004','f1000000-0000-4000-8000-000000000004','d1000000-0000-4000-8000-000000000004','resolve','open','resolved','2026-10-30T14:10:00Z','sterling-preview-acceptance','continuum','{"fixture":"sterling-preview-acceptance-v1","founderReview":"synthetic"}'),
  ('a1000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005','d1000000-0000-4000-8000-000000000005','create',null,'open','2026-10-30T14:00:00Z','sterling-preview-acceptance','continuum','{"fixture":"sterling-preview-acceptance-v1"}'),
  ('a2000000-0000-4000-8000-000000000005','f1000000-0000-4000-8000-000000000005','d1000000-0000-4000-8000-000000000005','resolve','open','resolved','2026-10-30T14:10:00Z','sterling-preview-acceptance','continuum','{"fixture":"sterling-preview-acceptance-v1","founderReview":"synthetic"}')
on conflict (mutation_id) do nothing;

insert into public.continuum_gmail_messages
  (message_id, thread_id, sent_at, indexed_at, subject, from_email_hash, to_email_hashes,
   cc_email_hashes, bcc_email_hashes, direction, label_ids, has_attachments, source_system) values
  ('face000000000002','face000000000001','2026-10-29T12:00:00Z','2026-10-30T14:00:00Z','[STERLING ACCEPTANCE SANDBOX] exact-source junk fixture',repeat('d',64),array[]::text[],array[]::text[],array[]::text[],'inbound',array['INBOX'],false,'gmail'),
  ('face000000000012','face000000000011','2026-10-29T12:05:00Z','2026-10-30T14:00:00Z','[STERLING ACCEPTANCE SANDBOX] distinct unresolved JP fixture',repeat('e',64),array[]::text[],array[]::text[],array[]::text[],'inbound',array['INBOX'],false,'gmail')
on conflict (message_id) do update set subject=excluded.subject, indexed_at=excluded.indexed_at;

insert into public.continuum_candidates
  (candidate_id, source_system, source_ref, source_timestamp, candidate_type, proposed_target, payload,
   confidence, evidence_basis, candidate_state, review_status, last_review_action, founder_edited_payload,
   founder_edited_target, reviewed_at, created_at, canonical, automatic_apply, parser_version,
   supersedes_candidate_id, superseded_by_candidate_id) values
  ('d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1','gmail','gc1|face000000000001|face000000000002','2026-10-29T12:00:00Z','person_association','{"kind":"person","personId":null}','{"kind":"person_association","displayName":"Daniel Iles","emailHash":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd","mintPerson":false,"mergePersons":false}','high','{"ruleIds":["sterling-preview-acceptance"],"matchedText":null}','active','pending','edit',null,'{"kind":"person","personId":null,"permanentSuppression":true,"founderDisposition":{"kind":"spam","itemId":"preview:daniel-iles","workLoopId":"source:face000000000001","cadIds":[],"sourceRefs":["gc1|face000000000001|face000000000002"],"label":"Daniel Iles","wording":"Daniel Iles is rejected junk."}}','2026-10-30T14:15:00Z','2026-10-29T12:00:00Z',false,false,'sterling-preview-acceptance-v1',null,null),
  ('d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2d2','gmail','gc1|face000000000001|face000000000002','2026-10-29T12:00:00Z','open_job','{"kind":"open_job","projectId":null}','{"kind":"open_job","jobKind":"follow_up","subject":"Synthetic stale reply","detail":null,"waitingOnActor":"founder","dueAt":null,"createJob":false}','low','{"ruleIds":["sterling-preview-acceptance"],"matchedText":null}','active','discarded','discard',null,null,'2026-10-30T14:15:00Z','2026-10-29T12:00:00Z',false,false,'sterling-preview-acceptance-v1',null,null),
  ('e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1','gmail','gc1|face000000000011|face000000000012','2026-10-29T12:05:00Z','person_association','{"kind":"person","personId":null}','{"kind":"person_association","displayName":"JP","emailHash":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","mintPerson":false,"mergePersons":false}','ambiguous','{"ruleIds":["sterling-preview-acceptance"],"matchedText":null}','active','pending',null,null,null,null,'2026-10-29T12:05:00Z',false,false,'sterling-preview-acceptance-v1',null,null)
on conflict (candidate_id) do update set review_status=excluded.review_status,
  founder_edited_target=excluded.founder_edited_target, reviewed_at=excluded.reviewed_at;

commit;
