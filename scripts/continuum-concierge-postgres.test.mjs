/**
 * Disposable loopback-only PostgreSQL acceptance for Concierge P0.5.
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

const [candidateSchema, conciergeMigration] = await Promise.all([
  readFile(new URL('../lib/supabase/continuum-candidates-schema.sql', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/migrations/20261104145814_continuum_concierge_funnel_persistence.sql', import.meta.url), 'utf8'),
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
  attribution jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null
);
alter table public.continuum_website_intakes enable row level security;
revoke all on public.continuum_website_intakes from public, anon, authenticated;
grant select, insert, update on public.continuum_website_intakes to service_role;
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
      await observer.query(conciergeMigration);

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
      assert.equal(Number((await observer.query('select count(*) as n from public.continuum_candidates')).rows[0].n), 1);
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
        o.provider_message_id,o.source_label,c.review_status,c.payload->>'subject' as subject
        from public.continuum_concierge_ack_outbox o
        join public.continuum_candidates c using (candidate_id)
        where o.intake_id=$1`, [matchedIntake])).rows[0];
      assert.deepEqual(durable, {
        state: 'delivery_unknown', attempt_count: 1, reconciliation_required: true,
        provider_message_id: null, source_label: 'Website Concierge', review_status: 'pending',
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
