/**
 * Disposable loopback-only PostgreSQL acceptance for Concierge P0.6.
 * Requires EMBEDDED_POSTGRES_MODULE and POSTGRES_CTL on Windows. It never
 * connects to a shared Supabase project or sends a client-facing message.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';

const { default: EmbeddedPostgres } = await import(
  process.env.EMBEDDED_POSTGRES_MODULE || 'embedded-postgres'
);

const [candidateSchema, conciergeFreshInstall] = await Promise.all([
  readFile(new URL('../lib/supabase/continuum-candidates-schema.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/release/20261110_continuum_concierge_fresh_install.sql', import.meta.url), 'utf8'),
]);

const fixture = `
create role anon;
create role authenticated;
create role service_role bypassrls;
grant usage on schema public to service_role;
create table public.continuum_website_intakes (
  intake_id uuid primary key,
  idempotency_key_hash text not null unique,
  payload_hash text not null,
  source text not null,
  identity_status text not null,
  person_id uuid,
  email text not null,
  synthetic boolean not null default false,
  acknowledgement_state text not null default 'pending',
  attribution jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null
);
alter table public.continuum_website_intakes enable row level security;
revoke all on public.continuum_website_intakes from public, anon, authenticated;
grant select, insert, update on public.continuum_website_intakes to service_role;
`;

// Current shared Preview drift layered over the original Candidate contract:
// transactional founder review added record_version and its bump trigger.
const currentPreviewCandidateDrift = `
create schema continuum_private;
alter table public.continuum_candidates
  add column record_version bigint not null default 1,
  add constraint continuum_candidates_record_version_check check (record_version > 0);
create function continuum_private.bump_record_version() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.record_version := old.record_version + 1;
  return new;
end;
$$;
revoke all on function continuum_private.bump_record_version() from public, anon, authenticated;
grant execute on function continuum_private.bump_record_version() to service_role;
create trigger continuum_candidates_record_version_trg
before update on public.continuum_candidates
for each row execute function continuum_private.bump_record_version();
`;

const hex = (character) => character.repeat(64);
const stamp = '2026-11-04T15:00:00.000Z';

function values({ intakeId, candidateId = hex('a'), confidence = 'high', suffix = '1' }) {
  const sourceRef = `website-intake:${intakeId}`;
  return {
    candidate: {
      candidateId, sourceSystem: 'human-intake', sourceRef, sourceTimestamp: stamp,
      candidateType: 'open_job', proposedTarget: { kind: 'open_job', projectId: null },
      payload: { kind: 'open_job', jobKind: 'required_action', subject: 'Personally review this inquiry',
        detail: 'Review evidence.', waitingOnActor: 'founder', dueAt: null, createJob: false },
      confidence, evidenceBasis: { ruleIds: ['concierge-intake-v1'], matchedText: null },
      candidateState: 'active', reviewStatus: 'pending', lastReviewAction: null,
      founderEditedPayload: null, founderEditedTarget: null, reviewedAt: null,
      createdAt: stamp, canonical: false, automaticApply: false,
      parserVersion: 'concierge-funnel-preview-v1', supersedesCandidateId: null,
      supersededByCandidateId: null,
    },
    acknowledgement: {
      outboxId: `ack_${suffix.repeat(24)}`, intakeId, idempotencyKey: hex(suffix),
      to: `${suffix}@example.test`, copy: { copyVersion: 'quiet-luxury-v1',
        approvalStatus: 'founder_approved', subject: 'Your Hourglass Concierge inquiry',
        text: 'Thank you. Justin will personally review your note.' },
      state: 'ready', attemptCount: 0, providerMessageId: null, lastAttemptAt: null,
      reconciliationRequired: false, createdAt: stamp,
      eventId: `event_${suffix.repeat(24)}`, leadId: `lead_${suffix.repeat(24)}`,
      actionId: `action_${suffix.repeat(24)}`, conciergeIdempotencyKey: hex(suffix),
      conciergePayloadHash: hex('c'), emailVerification: 'verified', qualification: 'qualified',
    },
    followUp: { consent: { serviceAcknowledgement: true, followUp: 'not_granted',
      textReply: 'not_granted', capturedAt: stamp, source: 'concierge_form' }, suppressions: [] },
  };
}

const acceptSql = `select public.continuum_accept_concierge_funnel_v1(
  $1::uuid,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb
) as result`;

async function accept(client, intakeId, submissionHash, acceptanceHash, input) {
  return (await client.query(acceptSql, [intakeId, submissionHash, acceptanceHash,
    JSON.stringify(input.candidate), JSON.stringify(input.acknowledgement),
    JSON.stringify(input.followUp)])).rows[0].result;
}

async function stopWindows(pg, databaseDir) {
  if (process.platform !== 'win32' || !process.env.POSTGRES_CTL || !pg.process) {
    await pg.stop();
    return;
  }
  const child = pg.process;
  const exited = child.exitCode === null ? once(child, 'exit') : Promise.resolve();
  await promisify(execFile)(process.env.POSTGRES_CTL,
    ['-D', databaseDir, 'stop', '-m', 'fast', '-w'], { windowsHide: true });
  await exited;
  pg.process = undefined;
}

test('Concierge SQL is atomic, private, replay-safe, durable, and delivery-quarantining',
  { timeout: 120000 }, async () => {
    const probe = createServer();
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    const databaseDir = await mkdtemp(join(tmpdir(), 'continuum-concierge-pg-'));
    const pg = new EmbeddedPostgres({
      databaseDir, port, user: 'postgres', password: randomUUID(), persistent: true,
      postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {},
    });
    let clients = [];

    try {
      await pg.initialise();
      await pg.start();
      let observer = pg.getPgClient();
      clients.push(observer);
      await observer.connect();
      await observer.query(fixture);
      // The bundled Windows cluster defaults to WIN1252; normalize a comment-only
      // mathematical glyph before sending the otherwise canonical schema text.
      await observer.query(candidateSchema.replaceAll('≠', '!='));
      await observer.query(currentPreviewCandidateDrift);

      // Existing Preview-shaped records must remain unchanged when the additive
      // migration is installed. These are synthetic local fixtures, never a
      // copy of customer data.
      const legacyIntakeId = randomUUID();
      await observer.query(`insert into public.continuum_website_intakes
        (intake_id,idempotency_key_hash,payload_hash,source,identity_status,person_id,email,synthetic,submitted_at)
        values ($1,$2,$3,'hourglassdiamonds.com/concierge','new',$4,'legacy@example.test',false,$5)`,
        [legacyIntakeId, hex('8'), hex('9'), randomUUID(), stamp]);
      await observer.query(`insert into public.continuum_candidates (
        candidate_id,source_system,source_ref,source_timestamp,candidate_type,
        proposed_target,payload,confidence,evidence_basis,candidate_state,review_status,
        created_at,canonical,automatic_apply,parser_version
      ) values ($1,'gmail','gm1|legacy-thread|legacy-message',$2,'note',
        '{"kind":"none"}'::jsonb,'{"kind":"note","text":"Local fixture","contextLayer":null}'::jsonb,
        'high','{"ruleIds":["fixture"],"matchedText":null}'::jsonb,'active','pending',$2,false,false,'fixture-v1')`,
        [hex('e'), stamp]);
      await observer.query(conciergeFreshInstall);

      const legacyAfterMigration = (await observer.query(`select
        (select idempotency_key_hash from public.continuum_website_intakes where intake_id=$1) intake_hash,
        (select record_version from public.continuum_candidates where candidate_id=$2) record_version,
        (select source_ref from public.continuum_candidates where candidate_id=$2) source_ref`,
        [legacyIntakeId, hex('e')])).rows[0];
      assert.deepEqual(legacyAfterMigration, {
        intake_hash: hex('8'), record_version: '1',
        source_ref: 'gm1|legacy-thread|legacy-message',
      });

      const seed = async ({ intakeId, hash, email, identityStatus, personId = null }) => {
        await observer.query(`insert into public.continuum_website_intakes
          (intake_id,idempotency_key_hash,payload_hash,source,identity_status,person_id,email,synthetic,submitted_at)
          values ($1,$2,$3,'hourglassdiamonds.com/concierge',$4,$5,$6,false,$7)`,
          [intakeId, hash, hex('f'), identityStatus, personId, email, stamp]);
      };

      const matchedIntake = randomUUID();
      const existingPerson = randomUUID();
      await seed({ intakeId: matchedIntake, hash: hex('1'), email: '1@example.test',
        identityStatus: 'matched', personId: existingPerson });
      const matchedInput = values({ intakeId: matchedIntake, candidateId: hex('a'), suffix: '1' });

      for (const role of ['anon', 'authenticated']) {
        await observer.query(`set role ${role}`);
        await assert.rejects(observer.query('select * from public.continuum_concierge_ack_outbox'), /permission denied/);
        await assert.rejects(accept(observer, matchedIntake, hex('1'), hex('2'), matchedInput), /permission denied/);
        await assert.rejects(observer.query(`select public.continuum_transition_concierge_ack_v1(
          $1,$2,'sending',1,null,$3,false)`, [matchedInput.acknowledgement.outboxId,
          matchedInput.acknowledgement.idempotencyKey, stamp]), /permission denied/);
        await observer.query('reset role');
      }

      const security = (await observer.query(`select
        c.relrowsecurity, c.relforcerowsecurity,
        has_table_privilege('anon','public.continuum_concierge_ack_outbox','select') as anon_select,
        has_table_privilege('authenticated','public.continuum_concierge_ack_outbox','select') as authenticated_select,
        has_table_privilege('service_role','public.continuum_concierge_ack_outbox','select') as service_select,
        has_table_privilege('service_role','public.continuum_concierge_ack_outbox','insert') as service_insert,
        has_table_privilege('service_role','public.continuum_concierge_ack_outbox','update') as service_update,
        has_table_privilege('service_role','public.continuum_concierge_ack_outbox','delete') as service_delete,
        has_table_privilege('service_role','public.continuum_concierge_ack_outbox','truncate') as service_truncate,
        has_table_privilege('service_role','public.continuum_concierge_ack_outbox','references') as service_references,
        has_table_privilege('service_role','public.continuum_concierge_ack_outbox','trigger') as service_trigger,
        has_table_privilege('service_role','public.continuum_concierge_ack_outbox','maintain') as service_maintain,
        has_function_privilege('public','public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb)','execute') as public_execute,
        has_function_privilege('public','public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean)','execute') as public_transition_execute,
        has_function_privilege('anon','public.continuum_accept_concierge_funnel_v1(uuid,text,text,jsonb,jsonb,jsonb)','execute') as anon_execute,
        has_function_privilege('authenticated','public.continuum_transition_concierge_ack_v1(text,text,text,integer,text,timestamptz,boolean)','execute') as authenticated_transition_execute,
        p.prosecdef, r.rolname as owner, p.proconfig
        from pg_class c
        join pg_proc p on p.proname='continuum_accept_concierge_funnel_v1'
        join pg_roles r on r.oid=p.proowner
        where c.oid='public.continuum_concierge_ack_outbox'::regclass`)).rows[0];
      assert.equal(security.relrowsecurity, true);
      assert.equal(security.relforcerowsecurity, true);
      assert.equal(security.anon_select, false);
      assert.equal(security.authenticated_select, false);
      assert.equal(security.service_select, true);
      assert.equal(security.service_insert, true);
      assert.equal(security.service_update, true);
      assert.equal(security.service_delete, false);
      assert.equal(security.service_truncate, false);
      assert.equal(security.service_references, false);
      assert.equal(security.service_trigger, false);
      assert.equal(security.service_maintain, false);
      assert.equal(security.public_execute, false);
      assert.equal(security.public_transition_execute, false);
      assert.equal(security.anon_execute, false);
      assert.equal(security.authenticated_transition_execute, false);
      assert.equal(security.prosecdef, false);
      assert.equal(security.owner, 'postgres');
      assert.deepEqual(security.proconfig, ['search_path=""']);
      assert.equal(Number((await observer.query(
        "select count(*) as n from pg_policies where schemaname='public' and tablename='continuum_concierge_ack_outbox'"
      )).rows[0].n), 0);
      const outboxIndexes = (await observer.query(`select
          index_class.relname as index_name,
          constraint_row.conname as constraint_name,
          constraint_row.contype as constraint_type,
          pg_get_indexdef(index_row.indexrelid) as definition,
          pg_get_expr(index_row.indpred, index_row.indrelid) as predicate
        from pg_index index_row
        join pg_class table_class on table_class.oid=index_row.indrelid
        join pg_namespace table_namespace on table_namespace.oid=table_class.relnamespace
        join pg_class index_class on index_class.oid=index_row.indexrelid
        left join pg_constraint constraint_row on constraint_row.conindid=index_row.indexrelid
        where table_namespace.nspname='public'
          and table_class.relname='continuum_concierge_ack_outbox'
        order by index_class.relname`)).rows;
      assert.equal(outboxIndexes.length, 11,
        'one primary key, eight UNIQUE constraints, and two explicit partial indexes');
      assert.deepEqual(
        outboxIndexes.filter((index) => index.constraint_type === 'p').map((index) => index.constraint_name),
        ['continuum_concierge_ack_outbox_pkey'],
      );
      assert.equal(outboxIndexes.filter((index) => index.constraint_type === 'u').length, 8);
      assert.equal(outboxIndexes.filter((index) => index.constraint_name !== null).length, 9);
      const founderIndex = outboxIndexes.find(
        (index) => index.index_name === 'continuum_concierge_ack_outbox_founder_idx',
      );
      assert.ok(founderIndex);
      assert.equal(founderIndex.constraint_name, null);
      assert.match(founderIndex.definition, /\(created_at, intake_id\)/);
      for (const state of ['pending_approval', 'ready', 'delivery_unknown', 'failed']) {
        assert.match(founderIndex.predicate, new RegExp(`'${state}'::text`));
      }
      const reconciliationIndex = outboxIndexes.find(
        (index) => index.index_name === 'continuum_concierge_ack_outbox_reconciliation_idx',
      );
      assert.ok(reconciliationIndex);
      assert.equal(reconciliationIndex.constraint_name, null);
      assert.match(reconciliationIndex.definition, /\(updated_at, outbox_id\)/);
      assert.match(reconciliationIndex.predicate, /reconciliation_required/);
      assert.equal(outboxIndexes.filter((index) => index.predicate !== null).length, 2);
      assert.equal(Number((await observer.query(`select count(*) as n
        from pg_constraint con
        join unnest(con.conkey) key(attnum) on true
        where con.conrelid='public.continuum_concierge_ack_outbox'::regclass
          and con.contype='f'
          and not exists (
            select 1 from pg_index idx
            where idx.indrelid=con.conrelid and key.attnum=any(idx.indkey)
          )`)).rows[0].n), 0, 'every new outbox foreign key is covered by an index');

      const noAcknowledgementIntake = randomUUID();
      await seed({ intakeId: noAcknowledgementIntake, hash: hex('6'),
        email: '3@example.test', identityStatus: 'new', personId: randomUUID() });
      await observer.query(`update public.continuum_website_intakes
        set acknowledgement_state='not_expected' where intake_id=$1`, [noAcknowledgementIntake]);
      const noAcknowledgementInput = values({
        intakeId: noAcknowledgementIntake, candidateId: hex('f'), suffix: '3',
      });
      await observer.query('set role service_role');
      await assert.rejects(
        accept(observer, noAcknowledgementIntake, hex('6'), hex('7'), noAcknowledgementInput),
        /website-acknowledgement-not-pending/,
      );
      assert.equal(Number((await observer.query(`select count(*) as n
        from public.continuum_concierge_ack_outbox where intake_id=$1`,
        [noAcknowledgementIntake])).rows[0].n), 0);
      await observer.query('reset role');

      const first = pg.getPgClient();
      const second = pg.getPgClient();
      clients.push(first, second);
      await Promise.all([first.connect(), second.connect()]);
      await Promise.all([first.query('set role service_role'), second.query('set role service_role')]);
      const concurrent = await Promise.all([
        accept(first, matchedIntake, hex('1'), hex('2'), matchedInput),
        accept(second, matchedIntake, hex('1'), hex('2'), matchedInput),
      ]);
      assert.deepEqual(concurrent.map((item) => item.status).sort(), ['already-present', 'created']);
      assert.equal(Number((await observer.query('select count(*) as n from public.continuum_concierge_ack_outbox')).rows[0].n), 1);
      assert.equal(Number((await observer.query('select count(*) as n from public.continuum_candidates')).rows[0].n), 2);
      assert.equal((await observer.query('select record_version from public.continuum_candidates where candidate_id=$1',
        [matchedInput.candidate.candidateId])).rows[0].record_version, '1');
      await assert.rejects(accept(first, matchedIntake, hex('1'), hex('3'), matchedInput), /idempotency-conflict/);
      assert.equal((await observer.query('select person_id from public.continuum_website_intakes where intake_id=$1',
        [matchedIntake])).rows[0].person_id, existingPerson);

      const ambiguousIntake = randomUUID();
      await seed({ intakeId: ambiguousIntake, hash: hex('4'), email: '2@example.test', identityStatus: 'needs_review' });
      const ambiguousInput = values({ intakeId: ambiguousIntake, candidateId: hex('d'), confidence: 'ambiguous', suffix: '2' });
      ambiguousInput.acknowledgement.to = '2@example.test';
      ambiguousInput.acknowledgement.qualification = 'needs_review';
      assert.equal((await accept(first, ambiguousIntake, hex('4'), hex('5'), ambiguousInput)).status, 'created');
      const ambiguousRows = (await observer.query(`select w.identity_status,w.person_id,c.confidence,c.review_status
        from public.continuum_website_intakes w
        join public.continuum_concierge_ack_outbox o using (intake_id)
        join public.continuum_candidates c using (candidate_id)
        where w.intake_id=$1`, [ambiguousIntake])).rows[0];
      assert.deepEqual(ambiguousRows, { identity_status: 'needs_review', person_id: null,
        confidence: 'ambiguous', review_status: 'pending' });

      await observer.query('set role service_role');
      await observer.query(`select public.continuum_transition_concierge_ack_v1(
        $1,$2,'sending',1,null,$3,false)`, [matchedInput.acknowledgement.outboxId,
        matchedInput.acknowledgement.idempotencyKey, stamp]);
      await observer.query(`select public.continuum_transition_concierge_ack_v1(
        $1,$2,'delivery_unknown',1,null,$3,true)`, [matchedInput.acknowledgement.outboxId,
        matchedInput.acknowledgement.idempotencyKey, stamp]);
      await assert.rejects(observer.query(`select public.continuum_transition_concierge_ack_v1(
        $1,$2,'sending',2,null,$3,false)`, [matchedInput.acknowledgement.outboxId,
        matchedInput.acknowledgement.idempotencyKey, stamp]), /acknowledgement-terminal/);

      await Promise.allSettled(clients.map((client) => client.end()));
      clients = [];
      await stopWindows(pg, databaseDir);
      await pg.start();
      observer = pg.getPgClient();
      clients.push(observer);
      await observer.connect();
      await observer.query('set role service_role');
      const durable = (await observer.query(`select o.state,o.attempt_count,o.reconciliation_required,
        o.provider_message_id,o.source_label,c.review_status,c.record_version,c.payload->>'subject' as subject
        from public.continuum_concierge_ack_outbox o
        join public.continuum_candidates c using (candidate_id)
        where o.intake_id=$1`, [matchedIntake])).rows[0];
      assert.deepEqual(durable, {
        state: 'delivery_unknown', attempt_count: 1, reconciliation_required: true,
        provider_message_id: null, source_label: 'Website Concierge', review_status: 'pending', record_version: '1',
        subject: 'Personally review this inquiry',
      });
      assert.equal(Number((await observer.query(
        "select count(*) as n from public.continuum_concierge_ack_outbox where state='sent'"
      )).rows[0].n), 0, 'the local acceptance never records a client-facing send');
    } finally {
      await Promise.allSettled(clients.map((client) => client.end()));
      if (pg.process) await stopWindows(pg, databaseDir);
    }
  });
