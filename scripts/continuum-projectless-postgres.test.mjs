/** Local PostgreSQL regression. Install embedded-postgres@18.4.0-beta.17 outside
 * the repo and set EMBEDDED_POSTGRES_MODULE to its dist/index.js file URL.
 * On Windows also set POSTGRES_CTL to the bundled native/bin/pg_ctl.exe.
 * Creates a fresh loopback-only cluster; never connects to Supabase or replays old SQL.
 * Separate PostgreSQL backends and observed lock waits prove concurrent retries.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { test } from 'node:test';
const { default: EmbeddedPostgres } = await import(process.env.EMBEDDED_POSTGRES_MODULE || 'embedded-postgres');
const foundationMigration = await readFile(new URL('../supabase/migrations/20260929113152_projectless_founder_work.sql', import.meta.url), 'utf8');
const attentionMigration = await readFile(new URL('../supabase/migrations/20260930010000_attention_persistence.sql', import.meta.url), 'utf8');
const fixture = `
create role anon; create role authenticated; create role service_role;
create table public.continuum_entities (id uuid primary key, kind text not null);
create table public.continuum_project_profiles (project_id uuid primary key references public.continuum_entities(id));
create table public.continuum_person_profiles (person_id uuid primary key references public.continuum_entities(id));
create table public.continuum_relationships (from_entity_id uuid, to_entity_id uuid, kind text, status text);
create table public.continuum_project_jobs (
 job_id uuid primary key, project_id uuid not null references public.continuum_project_profiles(project_id) on delete restrict,
 kind text not null, subject text not null, detail text, waiting_on_actor text not null,
 associated_person_id uuid references public.continuum_person_profiles(person_id) on delete restrict,
 state text not null check (state in ('open','snoozed','resolved','cancelled')),
 due_at timestamptz, deferred_until timestamptz, resolved_at timestamptz, cancelled_at timestamptz,
 created_at timestamptz not null, updated_at timestamptz not null, created_by text not null,
 source_system text not null, source_ref text, created_mutation_id uuid not null unique,
 check (state <> 'snoozed' or deferred_until is not null),
 check (state <> 'resolved' or resolved_at is not null),
 check (state <> 'cancelled' or cancelled_at is not null)
);
create table public.continuum_project_job_mutations (
 mutation_id uuid primary key, job_id uuid not null references public.continuum_project_jobs(job_id) on delete restrict,
 project_id uuid not null references public.continuum_project_profiles(project_id) on delete restrict,
 action text not null constraint continuum_project_job_mutations_action_check
   check (action in ('create','resolve','cancel','snooze','unsnooze','update')),
 prior_state text, new_state text not null, changed_at timestamptz not null,
 changed_by text not null, source_system text not null check (source_system in ('concierge-manual','continuum'))
);
alter table public.continuum_project_jobs enable row level security;
alter table public.continuum_project_job_mutations enable row level security;
grant usage on schema public to service_role;
grant select on all tables in schema public to service_role;
grant insert, update on public.continuum_project_jobs to service_role;
grant insert on public.continuum_project_job_mutations to service_role;
alter role service_role bypassrls;
`;
const row = () => ({ job_id: randomUUID(), project_id: null, kind: 'required_action', subject: 'Prepare plan', detail: null,
 waiting_on_actor: 'founder', associated_person_id: null, state: 'open', due_at: null, deferred_until: null,
 resolved_at: null, cancelled_at: null, created_at: '2026-09-29T12:00:00.000Z', updated_at: '2026-09-29T12:00:00.000Z',
 created_by: 'founder', source_system: 'continuum', source_ref: 'capture:item', created_mutation_id: randomUUID() });
const attentionMetadata = (originalWording = 'tomorrow at 9 AM') => ({
 version: 1, timingPrecision: 'exact-instant', timezone: 'America/New_York', originalWording,
 referenceInstant: '2026-09-29T12:00:00.000Z', originalLocalDateTime: '2026-09-30T09:00:00',
 conditionPolicy: 'review-only', assumptions: [],
});
const attentionRow = mode => ({
 ...row(),
 attention_mode: mode,
 activation_at: mode === 'reminder' ? '2026-09-30T13:00:00.000Z' : null,
 checkpoint_at: mode === 'watching' ? '2026-10-01T13:00:00.000Z' : null,
 attention_metadata: mode === 'action' ? null : attentionMetadata(),
});

test('transactional writes, immutable operation retries, real concurrent sessions, permissions and FKs', { timeout: 120000 }, async () => {
 const portProbe = createServer();
 await new Promise(resolve => portProbe.listen(0, '127.0.0.1', resolve));
 const port = portProbe.address().port;
 await new Promise(resolve => portProbe.close(resolve));
 const databaseDir = await mkdtemp(join(tmpdir(), 'continuum-operation-pg-'));
 const pg = new EmbeddedPostgres({ databaseDir, port, user: 'postgres', password: randomUUID(),
   persistent: true, postgresFlags: ['-h', '127.0.0.1'], onLog() {}, onError() {} });
 const clients = [];
 try {
   await pg.initialise();
   await pg.start();
   const client = pg.getPgClient();
   clients.push(client);
  await client.connect();
  const db = { query: (...args) => client.query(...args), exec: sql => client.query(sql) };
  await db.exec(fixture);
  await db.exec(foundationMigration);
  const write = async (job, id = job.created_mutation_id, action = 'create', prior = null, actor = 'founder', request = null, session = client) =>
   (await session.query('select public.continuum_write_project_job($1::jsonb,$2::uuid,$3,$4,$5::jsonb,$6::jsonb) as result',
       [JSON.stringify(job), id, action, actor, prior ? JSON.stringify(prior) : null, request ? JSON.stringify(request) : null])).rows[0].result;
   const count = async table => Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n);

  // Persist a real v1 operation before replacing the foundation RPC, then prove
  // that the final v2 RPC accepts only its default Action/null attention shape.
  const legacyAction = row();
  await db.exec('set role service_role');
  assert.equal((await write(legacyAction)).status, 'created');
  await db.exec('reset role');
  await db.exec(attentionMigration);
  await db.exec('set role service_role');
  const legacyRetry = await write({
    ...legacyAction, attention_mode: 'action', activation_at: null,
    checkpoint_at: null, attention_metadata: null,
  });
  assert.equal(legacyRetry.status, 'already-present');
  assert.equal(legacyRetry.job.attention_mode, 'action');
  assert.equal((await db.query('select operation->>\'version\' as version from public.continuum_project_job_mutations where mutation_id=$1',
    [legacyAction.created_mutation_id])).rows[0].version, '1');
  for (const changedAttention of [
    { attention_mode: 'action', activation_at: null, checkpoint_at: null, attention_metadata: attentionMetadata() },
    { attention_mode: 'reminder', activation_at: '2026-09-30T13:00:00.000Z', checkpoint_at: null, attention_metadata: attentionMetadata() },
    { attention_mode: 'watching', activation_at: null, checkpoint_at: '2026-10-01T13:00:00.000Z', attention_metadata: attentionMetadata() },
  ]) {
    await assert.rejects(write({ ...legacyAction, ...changedAttention }), /idempotency-conflict/);
  }
  await db.exec('reset role');
  await db.query('delete from public.continuum_project_job_mutations where mutation_id=$1', [legacyAction.created_mutation_id]);
  await db.query('delete from public.continuum_project_jobs where job_id=$1', [legacyAction.job_id]);
  assert.equal(await count('continuum_project_jobs'), 0);
  assert.equal(await count('continuum_project_job_mutations'), 0);

  const rejectHistory = `create function public.reject_test_history() returns trigger language plpgsql as $$ begin raise exception 'test-history-failure'; end $$;
    create trigger reject_history before insert on public.continuum_project_job_mutations for each row execute function public.reject_test_history();`;
  await db.exec(rejectHistory);
  const job = row();
  await assert.rejects(write(job), /test-history-failure/);
  assert.equal(await count('continuum_project_jobs'), 0);
  assert.equal(await count('continuum_project_job_mutations'), 0);
  await db.exec('drop trigger reject_history on public.continuum_project_job_mutations');
  await db.exec('set role service_role');
  const created = await write(job);
  assert.equal(created.status, 'created');
  assert.equal(created.job.project_id, null);
  assert.equal((await write(job)).status, 'already-present');
   const createPatches = [
     { job_id: randomUUID() }, { subject: 'Other subject' }, { detail: 'Other detail' },
     { project_id: randomUUID() }, { associated_person_id: randomUUID() }, { created_by: 'other' },
     { due_at: '2026-10-01T12:00:00Z' }, { deferred_until: '2026-10-02T12:00:00Z' },
     { source_system: 'concierge-manual' }, { source_ref: 'capture:other' }, { kind: 'commitment' },
     { waiting_on_actor: 'vendor' }, { state: 'cancelled' }, { cancelled_at: '2026-10-01T12:00:00Z' },
     { resolved_at: '2026-10-01T12:00:00Z' }, { created_at: '2026-10-01T12:00:00Z' },
     { updated_at: '2026-10-01T12:00:00Z' }, { created_mutation_id: randomUUID() },
   ];
   for (const patch of createPatches) {
     await assert.rejects(write({ ...job, ...patch }, job.created_mutation_id), /idempotency-conflict/);
     assert.deepEqual((await db.query('select to_jsonb(j) as job from public.continuum_project_jobs j')).rows[0].job, created.job);
     assert.equal(await count('continuum_project_job_mutations'), 1);
   }
   await assert.rejects(write(job, job.created_mutation_id, 'create', null, 'other'), /idempotency-conflict/);
  assert.equal(await count('continuum_project_job_mutations'), 1);
  const mutationId = randomUUID();
  const next = { ...created.job, state: 'resolved', resolved_at: '2026-09-29T13:00:00Z', updated_at: '2026-09-29T13:00:00Z' };
  await db.exec('reset role; create trigger reject_history before insert on public.continuum_project_job_mutations for each row execute function public.reject_test_history(); set role service_role');
  await assert.rejects(write(next, mutationId, 'resolve', created.job), /test-history-failure/);
  assert.equal((await db.query('select state from public.continuum_project_jobs')).rows[0].state, 'open');
  assert.equal(await count('continuum_project_job_mutations'), 1);
  await db.exec('reset role; drop trigger reject_history on public.continuum_project_job_mutations; set role service_role');
  assert.equal((await write(next, mutationId, 'resolve', created.job)).status, 'updated');
  assert.equal((await write(next, mutationId, 'resolve', created.job)).status, 'already-present');
  assert.equal(await count('continuum_project_job_mutations'), 2);
  const persistedNext = (await db.query('select to_jsonb(j) as job from public.continuum_project_jobs j')).rows[0].job;
   for (const patch of createPatches) {
     await assert.rejects(write({ ...next, ...patch }, mutationId, 'resolve', created.job), /idempotency-conflict/);
     assert.deepEqual((await db.query('select to_jsonb(j) as job from public.continuum_project_jobs j')).rows[0].job, persistedNext);
     assert.equal(await count('continuum_project_job_mutations'), 2);
   }
   await assert.rejects(write(next, mutationId, 'resolve', { ...created.job, detail: 'wrong prior' }), /idempotency-conflict/);
   await assert.rejects(write(next, randomUUID(), 'resolve', created.job), /job-write-conflict/);
  await assert.rejects(write(next, mutationId, 'cancel', created.job), /idempotency-conflict/);
  await assert.rejects(write({ ...row(), project_id: randomUUID() }), /project-not-found/);
  await db.exec('reset role');
  const projectId = randomUUID();
  await db.query("insert into public.continuum_entities values ($1,'project')", [projectId]);
  await db.query('insert into public.continuum_project_profiles values ($1)', [projectId]);
  await write({ ...row(), project_id: projectId });
  await assert.rejects(db.query('delete from public.continuum_project_profiles where project_id=$1', [projectId]), /foreign key/);
  for (const role of ['anon', 'authenticated']) {
   await db.exec(`set role ${role}`);
   await assert.rejects(write(row()), /permission denied/);
   await db.exec('reset role');
  }
  assert.equal(Number((await db.query("select count(*) as n from public.continuum_project_job_mutations where project_id is null")).rows[0].n), 2);

   // The final RPC writes v2 operation snapshots containing the complete
   // attention shape. Exact retries succeed; changed schedules never alias.
   await db.exec('set role service_role');
   for (const mode of ['action', 'reminder', 'watching']) {
     const candidate = attentionRow(mode);
     const jobsBefore = await count('continuum_project_jobs');
     const historyBefore = await count('continuum_project_job_mutations');
     const createdAttention = await write(candidate);
     assert.equal(createdAttention.status, 'created');
     assert.equal(createdAttention.job.attention_mode, mode);
     assert.equal((await write(candidate)).status, 'already-present');
     const operation = (await db.query('select operation from public.continuum_project_job_mutations where mutation_id=$1',
       [candidate.created_mutation_id])).rows[0].operation;
     assert.equal(operation.version, 2);
     assert.equal(operation.canonical.attention_mode, mode);
     assert.equal(operation.canonical.activation_at && Date.parse(operation.canonical.activation_at),
       candidate.activation_at && Date.parse(candidate.activation_at));
     assert.equal(operation.canonical.checkpoint_at && Date.parse(operation.canonical.checkpoint_at),
       candidate.checkpoint_at && Date.parse(candidate.checkpoint_at));
     assert.deepEqual(operation.canonical.attention_metadata, candidate.attention_metadata);
     const changed = mode === 'action'
       ? { attention_mode: 'reminder', activation_at: '2026-10-02T13:00:00.000Z', attention_metadata: attentionMetadata('Friday at 9 AM') }
       : mode === 'reminder'
         ? { activation_at: '2026-10-02T13:00:00.000Z' }
         : { checkpoint_at: '2026-10-02T13:00:00.000Z' };
     await assert.rejects(write({ ...candidate, ...changed }), /idempotency-conflict/);
     assert.equal(await count('continuum_project_jobs'), jobsBefore + 1);
     assert.equal(await count('continuum_project_job_mutations'), historyBefore + 1);
   }
   await db.exec('reset role');

   // Real backends: hold the first operation uncommitted, start its competitor,
   // and observe the advisory lock wait before releasing the first transaction.
   await db.exec('reset role');
   const first = pg.getPgClient();
   const second = pg.getPgClient();
   clients.push(first, second);
   await Promise.all([first.connect(), second.connect()]);
   const firstPid = (await first.query('select pg_backend_pid() as pid')).rows[0].pid;
   const secondPid = (await second.query('select pg_backend_pid() as pid')).rows[0].pid;
   assert.notEqual(firstPid, secondPid);
   await first.query("set statement_timeout='15s'; set role service_role");
   await second.query("set statement_timeout='15s'; set role service_role");
   for (const attentionMode of ['action', 'reminder', 'watching']) {
   for (const applicationRequest of [false, true]) {
   for (const conflicting of [false, true]) {
     const original = attentionRow(attentionMode);
     const jobsBefore = await count('continuum_project_jobs');
     const historyBefore = await count('continuum_project_job_mutations');
     const request = applicationRequest ? { operation: 'create', subject: original.subject, detail: original.detail,
       actor: 'founder', attentionMode, activationAt: original.activation_at,
       checkpointAt: original.checkpoint_at, attentionMetadata: original.attention_metadata } : null;
     await first.query('begin');
     const winner = await write(original, original.created_mutation_id, 'create', null, 'founder', request, first);
     const contender = { ...original,
       ...(applicationRequest ? { job_id: randomUUID(), created_at: '2026-09-29T12:00:01Z', updated_at: '2026-09-29T12:00:01Z' } : {}),
       ...(conflicting && attentionMode === 'action' ? { detail: 'different operation' } : {}),
       ...(conflicting && attentionMode === 'reminder' ? { activation_at: '2026-10-02T13:00:00.000Z' } : {}),
       ...(conflicting && attentionMode === 'watching' ? { checkpoint_at: '2026-10-02T13:00:00.000Z' } : {}) };
     // Hold request constant on purpose: changed canonical content must still
     // conflict even if a buggy service caller sends the old request snapshot.
     const pending = write(contender, original.created_mutation_id, 'create', null, 'founder', request, second)
       .then(value => ({ value }), error => ({ error }));
     try {
       const deadline = Date.now() + 10000;
       while (true) {
         const blockers = (await client.query('select pg_blocking_pids($1) as pids', [secondPid])).rows[0].pids;
         if (blockers.includes(firstPid)) break;
         assert.ok(Date.now() < deadline, 'second backend must be observed waiting on first');
         await nextTurn();
       }
       // Neither canonical row nor history is visible before the first commit.
       assert.equal(await count('continuum_project_jobs'), jobsBefore);
       assert.equal(await count('continuum_project_job_mutations'), historyBefore);
       await first.query('commit');
       const result = await pending;
       if (conflicting) assert.match(result.error?.message ?? '', /idempotency-conflict/);
       else { assert.equal(result.value?.status, 'already-present'); assert.deepEqual(result.value.job, winner.job); }
       assert.equal(await count('continuum_project_jobs'), jobsBefore + 1);
       assert.equal(await count('continuum_project_job_mutations'), historyBefore + 1);
       assert.deepEqual((await client.query('select to_jsonb(j) as job from public.continuum_project_jobs j where job_id=$1', [original.job_id])).rows[0].job, winner.job);
     } finally { await first.query('rollback'); await pending; }
   }
   }
   }
 } finally {
   await Promise.allSettled(clients.map(client => client.end()));
   if (process.platform === 'win32' && process.env.POSTGRES_CTL && pg.process) {
     // embedded-postgres uses taskkill on Windows, which can leave a newly
     // spawned PG worker holding output pipes. Ask PostgreSQL to stop gracefully.
     const child = pg.process;
     const exited = child.exitCode === null ? once(child, 'exit') : Promise.resolve();
     await promisify(execFile)(process.env.POSTGRES_CTL,
       ['-D', databaseDir, 'stop', '-m', 'fast', '-w'], { windowsHide: true });
     await exited;
     // Prevent the package's exit hook from waiting on an already exited child.
     pg.process = undefined;
   } else {
     await pg.stop();
   }
 }
});
