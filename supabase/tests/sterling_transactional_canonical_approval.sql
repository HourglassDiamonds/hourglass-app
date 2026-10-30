-- Disposable-database regression for the proposed Sterling transaction migration.
-- Run only after all repository migrations on an isolated local/disposable DB.
-- The outer transaction guarantees fixture cleanup.
begin;

create or replace function continuum_private.test_insert_sterling_approval(
  p_id uuid, p_type text, p_entity_type text, p_entity_id text, p_payload jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.continuum_sterling_proposals (
    proposal_id, created_at, updated_at, proposal_type, status, affected_entity_type,
    affected_entity_id, current_state_fingerprint, current_state_snapshot, entity_version,
    original_proposal, evidence_refs, reasoning_summary, confidence, source_workflow,
    source_watermark, provider, model, model_configuration, run_id, execution_status,
    ledger_version, contract_version, prompt_version
  ) values (
    p_id,'2026-10-30T16:00:00Z','2026-10-30T16:00:00Z',p_type,'proposed',p_entity_type,
    p_entity_id,repeat('a',64),p_payload,'test-v1',p_payload,
    coalesce(p_payload->'evidenceRefs',p_payload->'sourceRefs','[]'::jsonb),
    'Disposable transactional regression','high','sterling-transaction-test','test-watermark',
    'openai','test-model','test-config',p_id,'not_requested','sterling-proposal-ledger-v1',
    'sterling-today-proposal-v6','test-prompt-v1'
  );
end;
$$;

insert into public.continuum_entities (id,kind,created_at,created_by) values
 ('71000000-0000-4000-8000-000000000001','person','2026-10-30T15:00:00Z','sterling-test'),
 ('71000000-0000-4000-8000-000000000002','person','2026-10-30T15:00:00Z','sterling-test'),
 ('72000000-0000-4000-8000-000000000001','project','2026-10-30T15:00:00Z','sterling-test');
insert into public.continuum_person_profiles
 (person_id,display_name,given_name,family_name,roles,source_system,created_at,updated_at) values
 ('71000000-0000-4000-8000-000000000001','STERLING TX TEST — Client A','Client','A',array['client'],'sterling-test','2026-10-30T15:00:00Z','2026-10-30T15:00:00Z'),
 ('71000000-0000-4000-8000-000000000002','STERLING TX TEST — Client B','Client','B',array['client'],'sterling-test','2026-10-30T15:00:00Z','2026-10-30T15:00:00Z');
insert into public.continuum_project_profiles
 (project_id,display_title,visibility,import_row_key,source_system,created_at,updated_at,project_kind)
values ('72000000-0000-4000-8000-000000000001','STERLING TX TEST — Project','internal-only',
 'sterling-tx-test:project','sterling-test','2026-10-30T15:00:00Z','2026-10-30T15:00:00Z','custom_new_jewelry');
insert into public.continuum_relationships
 (id,from_entity_id,to_entity_id,kind,status,source_system,created_at,created_by)
values ('73000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001',
 '72000000-0000-4000-8000-000000000001','client-project','active','sterling-test','2026-10-30T15:00:00Z','sterling-test');
insert into public.continuum_project_lifecycle_states
 (project_id,project_kind,stage,entered_at,created_at,updated_at)
values ('72000000-0000-4000-8000-000000000001','custom_new_jewelry','cad','2026-10-30T15:00:00Z','2026-10-30T15:00:00Z','2026-10-30T15:00:00Z');
insert into public.continuum_project_jobs
 (job_id,project_id,kind,subject,detail,waiting_on_actor,associated_person_id,state,due_at,
  deferred_until,resolved_at,cancelled_at,created_at,updated_at,created_by,source_system,
  source_ref,created_mutation_id,attention_mode,activation_at,checkpoint_at,attention_metadata)
values ('74000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001',
 'required_action','STERLING TX TEST — obligation',null,'founder','71000000-0000-4000-8000-000000000001',
 'open',null,null,null,null,'2026-10-30T15:00:00Z','2026-10-30T15:00:00Z','sterling-test',
 'continuum','sterling-tx-test:job','75000000-0000-4000-8000-000000000001','action',null,null,null);
insert into public.continuum_project_job_mutations
 (mutation_id,job_id,project_id,action,prior_state,new_state,changed_at,changed_by,source_system,operation)
values ('75000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',
 '72000000-0000-4000-8000-000000000001','create',null,'open','2026-10-30T15:00:00Z',
 'sterling-test','continuum','{"fixture":"sterling-transaction-test"}');
insert into public.continuum_candidates (
 candidate_id,source_system,source_ref,source_timestamp,candidate_type,proposed_target,payload,
 confidence,evidence_basis,candidate_state,review_status,created_at,canonical,automatic_apply,parser_version
) values (repeat('d',64),'gmail','gc1|face000000000001|face000000000002','2026-10-30T15:00:00Z',
 'person_association','{"kind":"person","personId":null}',
 jsonb_build_object('kind','person_association','displayName','Daniel Iles','emailHash',repeat('e',64),'mintPerson',false,'mergePersons',false),
 'high','{"ruleIds":["sterling-transaction-test"],"matchedText":null}','active','pending',
 '2026-10-30T15:00:00Z',false,false,'sterling-transaction-test-v1');

-- Approval required; then exact approval, execution, history, and replay.
select continuum_private.test_insert_sterling_approval(
 '76000000-0000-4000-8000-000000000001','canonical_change_set','project','72000000-0000-4000-8000-000000000001',
 '{"version":1,"kind":"canonical_change_set","approvalId":"76000000-0000-4000-8000-000000000001","projectId":"72000000-0000-4000-8000-000000000001","projectKind":"custom_new_jewelry","evidenceRefs":["founder:test"],"sourceWatermark":"test","requiresFounderApproval":true,"operations":[{"operationId":"77000000-0000-4000-8000-000000000001","kind":"update_open_job_holder","projectId":"72000000-0000-4000-8000-000000000001","personId":"71000000-0000-4000-8000-000000000001","jobId":"74000000-0000-4000-8000-000000000001","expectedRecordVersion":"2026-10-30T15:00:00Z","targetResponsibleParty":"vendor","evidenceRefs":["founder:test"]}]}'::jsonb);
set local role service_role;
do $$ begin
 perform public.continuum_sterling_execute_approved_change_set('76000000-0000-4000-8000-000000000001',1,'founder','2026-10-30T16:01:00Z');
 raise exception 'expected founder-approval-required';
exception when others then if sqlerrm not like '%founder-approval-required%' then raise; end if; end $$;
select public.continuum_sterling_record_canonical_decision(
 '76000000-0000-4000-8000-000000000001',1,'approved',original_proposal,'2026-10-30T16:02:00Z','founder',null)
from public.continuum_sterling_proposals where proposal_id='76000000-0000-4000-8000-000000000001';
select public.continuum_sterling_execute_approved_change_set('76000000-0000-4000-8000-000000000001',2,'founder','2026-10-30T16:03:00Z');
select public.continuum_sterling_execute_approved_change_set('76000000-0000-4000-8000-000000000001',2,'founder','2026-10-30T16:03:00Z');
do $$ begin
 perform public.continuum_sterling_record_canonical_decision('76000000-0000-4000-8000-000000000001',3,'approved','{"different":true}','2026-10-30T16:04:00Z','founder',null);
 raise exception 'expected approval-idempotency-conflict';
exception when others then if sqlerrm not like '%approval-idempotency-conflict%' then raise; end if; end $$;
reset role;
do $$ begin
 if (select waiting_on_actor from public.continuum_project_jobs where job_id='74000000-0000-4000-8000-000000000001') <> 'vendor' then raise exception 'job holder update failed'; end if;
 if (select count(*) from public.continuum_project_job_mutations where mutation_id='77000000-0000-4000-8000-000000000001') <> 1 then raise exception 'idempotent history failed'; end if;
end $$;

-- Cross-client rejection.
select continuum_private.test_insert_sterling_approval(
 '76000000-0000-4000-8000-000000000002','canonical_change_set','project','72000000-0000-4000-8000-000000000001',
 '{"version":1,"kind":"canonical_change_set","approvalId":"76000000-0000-4000-8000-000000000002","projectId":"72000000-0000-4000-8000-000000000001","projectKind":"custom_new_jewelry","evidenceRefs":["founder:test"],"sourceWatermark":"test","requiresFounderApproval":true,"operations":[{"operationId":"77000000-0000-4000-8000-000000000002","kind":"resolve_open_job","projectId":"72000000-0000-4000-8000-000000000001","personId":"71000000-0000-4000-8000-000000000002","jobId":"74000000-0000-4000-8000-000000000001","expectedRecordVersion":"2026-10-30T16:03:00Z","evidenceRefs":["founder:test"]}]}'::jsonb);
set local role service_role;
select public.continuum_sterling_record_canonical_decision('76000000-0000-4000-8000-000000000002',1,'approved',original_proposal,'2026-10-30T16:05:00Z','founder',null)
from public.continuum_sterling_proposals where proposal_id='76000000-0000-4000-8000-000000000002';
do $$ begin
 perform public.continuum_sterling_execute_approved_change_set('76000000-0000-4000-8000-000000000002',2,'founder','2026-10-30T16:06:00Z');
 raise exception 'expected person-not-on-project';
exception when others then if sqlerrm not like '%person-not-on-project%' then raise; end if; end $$;
reset role;

-- Job and lifecycle expected versions are both enforced.
select continuum_private.test_insert_sterling_approval(
 '76000000-0000-4000-8000-000000000008','canonical_change_set','project','72000000-0000-4000-8000-000000000001',
 '{"version":1,"kind":"canonical_change_set","approvalId":"76000000-0000-4000-8000-000000000008","projectId":"72000000-0000-4000-8000-000000000001","projectKind":"custom_new_jewelry","evidenceRefs":["founder:test"],"sourceWatermark":"test","requiresFounderApproval":true,"operations":[{"operationId":"77000000-0000-4000-8000-000000000008","kind":"update_open_job_holder","projectId":"72000000-0000-4000-8000-000000000001","personId":"71000000-0000-4000-8000-000000000001","jobId":"74000000-0000-4000-8000-000000000001","expectedRecordVersion":"2026-10-30T15:00:00Z","targetResponsibleParty":"client","evidenceRefs":["founder:test"]}]}'::jsonb);
set local role service_role;
select public.continuum_sterling_record_canonical_decision('76000000-0000-4000-8000-000000000008',1,'approved',original_proposal,'2026-10-30T16:05:30Z','founder',null)
from public.continuum_sterling_proposals where proposal_id='76000000-0000-4000-8000-000000000008';
do $$ begin
 perform public.continuum_sterling_execute_approved_change_set('76000000-0000-4000-8000-000000000008',2,'founder','2026-10-30T16:05:40Z');
 raise exception 'expected stale-job-version';
exception when others then if sqlerrm not like '%stale-job-version%' then raise; end if; end $$;
reset role;

select continuum_private.test_insert_sterling_approval(
 '76000000-0000-4000-8000-000000000009','canonical_change_set','project','72000000-0000-4000-8000-000000000001',
 '{"version":1,"kind":"canonical_change_set","approvalId":"76000000-0000-4000-8000-000000000009","projectId":"72000000-0000-4000-8000-000000000001","projectKind":"custom_new_jewelry","evidenceRefs":["founder:test"],"sourceWatermark":"test","requiresFounderApproval":true,"operations":[{"operationId":"77000000-0000-4000-8000-000000000009","kind":"set_project_lifecycle","projectId":"72000000-0000-4000-8000-000000000001","personId":"71000000-0000-4000-8000-000000000001","expectedRecordVersion":"2026-10-30T14:00:00Z","expectedCurrentStage":"cad","targetLifecycleStage":"production","evidenceRefs":["founder:test"]}]}'::jsonb);
set local role service_role;
select public.continuum_sterling_record_canonical_decision('76000000-0000-4000-8000-000000000009',1,'approved',original_proposal,'2026-10-30T16:05:50Z','founder',null)
from public.continuum_sterling_proposals where proposal_id='76000000-0000-4000-8000-000000000009';
do $$ begin
 perform public.continuum_sterling_execute_approved_change_set('76000000-0000-4000-8000-000000000009',2,'founder','2026-10-30T16:05:55Z');
 raise exception 'expected stale-lifecycle-version';
exception when others then if sqlerrm not like '%stale-lifecycle-version%' then raise; end if; end $$;
reset role;

-- Candidate record_version rejects stale approval without timestamp assumptions.
select continuum_private.test_insert_sterling_approval(
 '76000000-0000-4000-8000-000000000007','source_suppression','candidate',repeat('d',64),
 jsonb_build_object('version',1,'kind','source_suppression','action','suppress','approvalId','76000000-0000-4000-8000-000000000007',
  'candidateId',repeat('d',64),'sourceRefs',jsonb_build_array('gc1|face000000000001|face000000000002'),
  'emailHash',repeat('e',64),'expectedRecordVersion','99','disposition','spam','itemId','source:stale',
  'workUnitId','source:face000000000001','cadIds','[]'::jsonb,'label','Daniel Iles','wording','Stale test.','requiresFounderApproval',true));
set local role service_role;
select public.continuum_sterling_record_canonical_decision('76000000-0000-4000-8000-000000000007',1,'approved',original_proposal,'2026-10-30T16:06:00Z','founder',null)
from public.continuum_sterling_proposals where proposal_id='76000000-0000-4000-8000-000000000007';
do $$ begin
 perform public.continuum_sterling_execute_approved_change_set('76000000-0000-4000-8000-000000000007',2,'founder','2026-10-30T16:06:30Z');
 raise exception 'expected stale-candidate-version';
exception when others then if sqlerrm not like '%stale-candidate-version%' then raise; end if; end $$;
reset role;

-- Exact source suppression and compensating restore.
select continuum_private.test_insert_sterling_approval(
 '76000000-0000-4000-8000-000000000003','source_suppression','candidate',repeat('d',64),
 jsonb_build_object('version',1,'kind','source_suppression','action','suppress','approvalId','76000000-0000-4000-8000-000000000003',
  'candidateId',repeat('d',64),'sourceRefs',jsonb_build_array('gc1|face000000000001|face000000000002'),
  'emailHash',repeat('e',64),'expectedRecordVersion','1','disposition','spam','itemId','source:daniel',
  'workUnitId','source:face000000000001','cadIds','[]'::jsonb,'label','Daniel Iles','wording','Rejected junk.','requiresFounderApproval',true));
set local role service_role;
select public.continuum_sterling_record_canonical_decision(
 '76000000-0000-4000-8000-000000000003',1,'edited_and_approved',
 original_proposal || jsonb_build_object('wording','Founder-edited junk rejection.'),
 '2026-10-30T16:07:00Z','founder','Edited before approval.')
from public.continuum_sterling_proposals where proposal_id='76000000-0000-4000-8000-000000000003';
select public.continuum_sterling_execute_approved_change_set('76000000-0000-4000-8000-000000000003',2,'founder','2026-10-30T16:08:00Z');
reset role;
do $$ begin
 if not exists (select 1 from public.continuum_candidates where candidate_id=repeat('d',64) and record_version=2 and review_status='discarded' and founder_edited_target->'permanentSuppression'='true'::jsonb) then raise exception 'source suppression failed'; end if;
 if (select count(*) from public.continuum_candidate_suppression_events where proposal_id='76000000-0000-4000-8000-000000000003') <> 1 then raise exception 'suppression audit missing'; end if;
end $$;
select continuum_private.test_insert_sterling_approval(
 '76000000-0000-4000-8000-000000000004','source_suppression','candidate',repeat('d',64),
 jsonb_build_object('version',1,'kind','source_suppression','action','restore','approvalId','76000000-0000-4000-8000-000000000004',
  'candidateId',repeat('d',64),'sourceRefs',jsonb_build_array('gc1|face000000000001|face000000000002'),
  'emailHash',repeat('e',64),'expectedRecordVersion','2','disposition','spam',
  'compensatesProposalId','76000000-0000-4000-8000-000000000003','requiresFounderApproval',true));
set local role service_role;
select public.continuum_sterling_record_canonical_decision('76000000-0000-4000-8000-000000000004',1,'approved',original_proposal,'2026-10-30T16:09:00Z','founder',null)
from public.continuum_sterling_proposals where proposal_id='76000000-0000-4000-8000-000000000004';
select public.continuum_sterling_execute_approved_change_set('76000000-0000-4000-8000-000000000004',2,'founder','2026-10-30T16:10:00Z');
reset role;
do $$ begin
 if not exists (select 1 from public.continuum_candidates where candidate_id=repeat('d',64) and record_version=3 and review_status='pending' and founder_edited_target is null) then raise exception 'suppression compensation failed'; end if;
end $$;

-- Injected later-operation failure proves all earlier canonical/history writes roll back.
create or replace function continuum_private.test_reject_completed_lifecycle()
returns trigger language plpgsql set search_path='' as $$ begin
 if new.project_id='72000000-0000-4000-8000-000000000001' and new.stage='completed' then raise exception 'injected-late-operation-failure'; end if;
 return new; end $$;
create trigger sterling_test_late_failure before update on public.continuum_project_lifecycle_states
for each row execute function continuum_private.test_reject_completed_lifecycle();
select continuum_private.test_insert_sterling_approval(
 '76000000-0000-4000-8000-000000000005','canonical_change_set','project','72000000-0000-4000-8000-000000000001',
 '{"version":1,"kind":"canonical_change_set","approvalId":"76000000-0000-4000-8000-000000000005","projectId":"72000000-0000-4000-8000-000000000001","projectKind":"custom_new_jewelry","evidenceRefs":["founder:test"],"sourceWatermark":"test","requiresFounderApproval":true,"operations":[{"operationId":"77000000-0000-4000-8000-000000000005","kind":"update_open_job_holder","projectId":"72000000-0000-4000-8000-000000000001","personId":"71000000-0000-4000-8000-000000000001","jobId":"74000000-0000-4000-8000-000000000001","expectedRecordVersion":"2026-10-30T16:03:00Z","targetResponsibleParty":"client","evidenceRefs":["founder:test"]},{"operationId":"77000000-0000-4000-8000-000000000006","kind":"set_project_lifecycle","projectId":"72000000-0000-4000-8000-000000000001","personId":"71000000-0000-4000-8000-000000000001","expectedRecordVersion":"2026-10-30T15:00:00Z","expectedCurrentStage":"cad","targetLifecycleStage":"completed","evidenceRefs":["founder:test"]}]}'::jsonb);
set local role service_role;
select public.continuum_sterling_record_canonical_decision('76000000-0000-4000-8000-000000000005',1,'approved',original_proposal,'2026-10-30T16:11:00Z','founder',null)
from public.continuum_sterling_proposals where proposal_id='76000000-0000-4000-8000-000000000005';
do $$ begin
 perform public.continuum_sterling_execute_approved_change_set('76000000-0000-4000-8000-000000000005',2,'founder','2026-10-30T16:12:00Z');
 raise exception 'expected injected late failure';
exception when others then if sqlerrm not like '%injected-late-operation-failure%' then raise; end if; end $$;
reset role;
do $$ begin
 if (select waiting_on_actor from public.continuum_project_jobs where job_id='74000000-0000-4000-8000-000000000001') <> 'vendor' then raise exception 'partial job mutation escaped rollback'; end if;
 if exists (select 1 from public.continuum_project_job_mutations where mutation_id='77000000-0000-4000-8000-000000000005') then raise exception 'partial history escaped rollback'; end if;
 if (select status from public.continuum_sterling_proposals where proposal_id='76000000-0000-4000-8000-000000000005') <> 'approved' then raise exception 'ledger did not roll back'; end if;
end $$;
drop trigger sterling_test_late_failure on public.continuum_project_lifecycle_states;
drop function continuum_private.test_reject_completed_lifecycle();

-- Existing ledger shape remains compatible.
insert into public.continuum_sterling_proposals (
 proposal_id,created_at,updated_at,proposal_type,status,affected_entity_type,affected_entity_id,
 current_state_fingerprint,current_state_snapshot,original_proposal,evidence_refs,reasoning_summary,
 confidence,source_workflow,provider,model,model_configuration,run_id,execution_status,ledger_version,
 contract_version,prompt_version
) values ('76000000-0000-4000-8000-000000000006','2026-10-30T16:00:00Z','2026-10-30T16:00:00Z',
 'job_update','proposed','job','74000000-0000-4000-8000-000000000001',repeat('b',64),'{}','{}','[]',
 'Legacy compatibility','high','sterling-v1','openai','test-model','test-config','76000000-0000-4000-8000-000000000006',
 'not_requested','sterling-proposal-ledger-v1','sterling-v1','test-prompt-v1');

-- Browser roles cannot execute privileged wrappers.
set local role anon;
do $$ begin
 perform public.continuum_sterling_execute_approved_change_set('76000000-0000-4000-8000-000000000001',3,'founder','2026-10-30T16:13:00Z');
 raise exception 'anon unexpectedly executed privileged function';
exception when insufficient_privilege then null; end $$;
reset role;

rollback;
