/**
 * Real disposable PostgreSQL coverage for first-party Website Intake.
 *
 * Install embedded-postgres outside this repository and set
 * EMBEDDED_POSTGRES_MODULE to its dist/index.js file URL. On Windows also set
 * POSTGRES_CTL to the package's native/bin/pg_ctl.exe. The harness creates a
 * fresh loopback-only cluster and applies only the canonical prerequisite chain
 * named below. It never connects to Supabase or any persistent database.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { test } from 'node:test';
import { promisify } from 'node:util';

const { default: EmbeddedPostgres } = await import(
  process.env.EMBEDDED_POSTGRES_MODULE || 'embedded-postgres'
);

const migrationFiles = [
  '20260929113152_projectless_founder_work.sql',
  '20260930010000_attention_persistence.sql',
  '20260930020000_website_inquiry_intake.sql',
];
const migrations = await Promise.all(migrationFiles.map((name) =>
  readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8')));

// Minimum production-shaped prerequisite schema. The three migrations under
// test remain unmodified and are applied in their canonical order below.
const fixture = `
create role anon;
create role authenticated;
create role service_role;

create table public.continuum_entities (
  id uuid primary key,
  kind text not null check (kind in ('person','project','other')),
  created_at timestamptz not null default now(),
  created_by text not null
);
create table public.continuum_external_identities (
  id uuid primary key,
  entity_id uuid references public.continuum_entities(id),
  source_system text not null,
  identity_kind text not null check (identity_kind in ('hubspot_contact_id','email_hash','phone_hash','google_contact_id')),
  identifier text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create unique index continuum_external_identities_active_uq
  on public.continuum_external_identities(source_system, identity_kind, identifier)
  where revoked_at is null;
create table public.continuum_person_profiles (
  person_id uuid primary key references public.continuum_entities(id),
  display_name text not null,
  given_name text,
  family_name text,
  organization_name text,
  email text,
  phone text,
  street_address text,
  city text,
  state text,
  country text,
  postal_code text,
  roles text[] not null default '{}',
  source_system text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.continuum_project_profiles (
  project_id uuid primary key references public.continuum_entities(id)
);
create table public.continuum_relationships (
  from_entity_id uuid,
  to_entity_id uuid,
  kind text,
  status text
);
create table public.continuum_identity_reviews (
  id uuid primary key,
  status text not null check (status in ('open','resolved','suppressed')),
  reason_code text not null,
  left_person_id uuid references public.continuum_entities(id),
  right_person_id uuid references public.continuum_entities(id),
  import_row_key text,
  issue_text text,
  resolution_text text,
  source_system text not null,
  created_at timestamptz not null default now()
);
create unique index continuum_identity_reviews_import_reason_uq
  on public.continuum_identity_reviews(source_system, import_row_key, reason_code)
  where import_row_key is not null;
create table public.continuum_project_jobs (
  job_id uuid primary key,
  project_id uuid not null references public.continuum_project_profiles(project_id) on delete restrict,
  kind text not null,
  subject text not null,
  detail text,
  waiting_on_actor text not null,
  associated_person_id uuid references public.continuum_person_profiles(person_id) on delete restrict,
  state text not null check (state in ('open','snoozed','resolved','cancelled')),
  due_at timestamptz,
  deferred_until timestamptz,
  resolved_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  created_by text not null,
  source_system text not null,
  source_ref text,
  created_mutation_id uuid not null unique,
  check (state <> 'snoozed' or deferred_until is not null),
  check (state <> 'resolved' or resolved_at is not null),
  check (state <> 'cancelled' or cancelled_at is not null)
);
create table public.continuum_project_job_mutations (
  mutation_id uuid primary key,
  job_id uuid not null references public.continuum_project_jobs(job_id) on delete restrict,
  project_id uuid not null references public.continuum_project_profiles(project_id) on delete restrict,
  action text not null constraint continuum_project_job_mutations_action_check
    check (action in ('create','resolve','cancel','snooze','unsnooze','update')),
  prior_state text,
  new_state text not null,
  changed_at timestamptz not null,
  changed_by text not null,
  source_system text not null check (source_system in ('concierge-manual','continuum'))
);

alter table public.continuum_entities enable row level security;
alter table public.continuum_external_identities enable row level security;
alter table public.continuum_person_profiles enable row level security;
alter table public.continuum_identity_reviews enable row level security;
alter table public.continuum_project_jobs enable row level security;
alter table public.continuum_project_job_mutations enable row level security;
grant usage on schema public to service_role;
grant select, insert, update on table
  public.continuum_entities,
  public.continuum_external_identities,
  public.continuum_person_profiles,
  public.continuum_identity_reviews,
  public.continuum_project_jobs,
  public.continuum_project_job_mutations
to service_role;
alter role service_role bypassrls;
`;

const digest = (character) => character.repeat(64);

function command(overrides = {}) {
  const ids = {
    intakeId: randomUUID(),
    personId: randomUUID(),
    emailIdentityId: randomUUID(),
    phoneIdentityId: randomUUID(),
    identityReviewId: randomUUID(),
    jobId: randomUUID(),
    jobMutationId: randomUUID(),
  };
  return {
    ...ids,
    idempotencyKeyHash: digest('a'),
    payloadHash: digest('b'),
    payload: {
      full_name: 'Alex Example',
      given_name: 'Alex',
      family_name: 'Example',
      email: 'alex@example.com',
      email_hash: digest('c'),
      phone: '2125550100',
      phone_hash: digest('d'),
      preferred_contact_method: 'email',
      category: 'engagement_ring',
      project_type: 'Engagement Ring',
      shape_interest: 'Oval',
      design_direction: 'Quiet Elegance',
      ring_presence: 'Balanced',
      timeline: 'Flexible',
      budget_range: 'Prefer to Discuss',
      inspiration_notes: 'A private, bounded note.',
      attribution: { utm_source: 'organic' },
      source: 'hourglassdiamonds.com/concierge',
      acknowledgement_expected: false,
      synthetic: false,
      submitted_at: '2026-09-30T14:00:00.000Z',
    },
    ...overrides,
    payload: { ...command.payload, ...overrides.payload },
  };
}
command.payload = {
  full_name: 'Alex Example', given_name: 'Alex', family_name: 'Example',
  email: 'alex@example.com', email_hash: digest('c'), phone: '2125550100',
  phone_hash: digest('d'), preferred_contact_method: 'email',
  category: 'engagement_ring', project_type: 'Engagement Ring', shape_interest: 'Oval',
  design_direction: 'Quiet Elegance', ring_presence: 'Balanced', timeline: 'Flexible',
  budget_range: 'Prefer to Discuss', inspiration_notes: 'A private, bounded note.',
  attribution: { utm_source: 'organic' }, source: 'hourglassdiamonds.com/concierge',
  acknowledgement_expected: false, synthetic: false, submitted_at: '2026-09-30T14:00:00.000Z',
};

const ingestSql = `select public.continuum_ingest_website_inquiry(
  $1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8,$9,$10::jsonb
) as result`;

async function ingest(session, value) {
  const parameters = [
    value.intakeId, value.personId, value.emailIdentityId, value.phoneIdentityId,
    value.identityReviewId, value.jobId, value.jobMutationId,
    value.idempotencyKeyHash, value.payloadHash, JSON.stringify(value.payload),
  ];
  return (await session.query(ingestSql, parameters)).rows[0].result;
}

test('Website Intake real PostgreSQL concurrency, atomicity, security, and Attention compatibility',
  { timeout: 120000 }, async () => {
    const portProbe = createServer();
    await new Promise((resolve) => portProbe.listen(0, '127.0.0.1', resolve));
    const port = portProbe.address().port;
    await new Promise((resolve) => portProbe.close(resolve));
    const databaseDir = await mkdtemp(join(tmpdir(), 'continuum-website-intake-pg-'));
    const pg = new EmbeddedPostgres({
      databaseDir,
      port,
      user: 'postgres',
      password: randomUUID(),
      persistent: true,
      postgresFlags: ['-h', '127.0.0.1'],
      onLog() {},
      onError() {},
    });
    const clients = [];

    try {
      await pg.initialise();
      await pg.start();
      const observer = pg.getPgClient();
      clients.push(observer);
      await observer.connect();
      await observer.query(fixture);
      for (const migration of migrations) await observer.query(migration);

      const count = async (table, session = observer) => Number((await session.query(
        `select count(*) as n from public.${table}`)).rows[0].n);
      const snapshotCounts = async () => {
        const result = {};
        for (const table of [
          'continuum_website_intakes', 'continuum_entities', 'continuum_person_profiles',
          'continuum_external_identities', 'continuum_identity_reviews',
          'continuum_project_jobs', 'continuum_project_job_mutations',
        ]) result[table] = await count(table);
        return result;
      };

      // Browser roles have neither table nor RPC access. The same calls below
      // succeed under service_role, proving intended execution authority.
      for (const role of ['anon', 'authenticated']) {
        await observer.query(`set role ${role}`);
        await assert.rejects(observer.query('select * from public.continuum_website_intakes'), /permission denied/);
        await assert.rejects(ingest(observer, command()), /permission denied/);
        await assert.rejects(observer.query(
          "select public.continuum_record_website_intake_hubspot($1,'failed',null,null,'denied')",
          [randomUUID()]), /permission denied/);
        await observer.query('reset role');
      }
      await observer.query('set role service_role');

      // Exact replay: one intake, one Person, one Action Job, and one immutable
      // v2 mutation. Replaying converges onto those same durable rows.
      const exact = command();
      const first = await ingest(observer, exact);
      const replay = await ingest(observer, exact);
      assert.equal(first.status, 'created');
      assert.equal(first.identity_status, 'new');
      assert.equal(replay.status, 'already-present');
      assert.equal(replay.intake_id, first.intake_id);
      assert.equal(replay.person_id, first.person_id);
      assert.equal(replay.job_id, first.job_id);
      assert.equal(await count('continuum_website_intakes'), 1);
      assert.equal(await count('continuum_person_profiles'), 1);
      assert.equal(await count('continuum_project_jobs'), 1);
      assert.equal(await count('continuum_project_job_mutations'), 1);
      const exactJob = (await observer.query(
        'select * from public.continuum_project_jobs where job_id=$1', [exact.jobId])).rows[0];
      assert.equal(exactJob.project_id, null);
      assert.equal(exactJob.kind, 'required_action');
      assert.equal(exactJob.attention_mode, 'action');
      assert.equal(exactJob.activation_at, null);
      assert.equal(exactJob.checkpoint_at, null);
      assert.equal(exactJob.attention_metadata, null);
      const exactMutation = (await observer.query(
        'select * from public.continuum_project_job_mutations where mutation_id=$1',
        [exact.jobMutationId])).rows[0];
      assert.equal(exactMutation.action, 'create');
      assert.equal(exactMutation.operation.version, 2);
      assert.equal(exactMutation.operation.canonical.attention_mode, 'action');

      // A reused submission identity with a conflicting payload hash fails
      // before any additional write survives.
      const beforeConflict = await snapshotCounts();
      await assert.rejects(ingest(observer, {
        ...exact,
        payloadHash: digest('e'),
        payload: { ...exact.payload, inspiration_notes: 'conflicting replay' },
      }), /idempotency-conflict/);
      assert.deepEqual(await snapshotCounts(), beforeConflict);

      const firstSession = pg.getPgClient();
      const secondSession = pg.getPgClient();
      clients.push(firstSession, secondSession);
      await Promise.all([firstSession.connect(), secondSession.connect()]);
      const firstPid = (await firstSession.query('select pg_backend_pid() as pid')).rows[0].pid;
      const secondPid = (await secondSession.query('select pg_backend_pid() as pid')).rows[0].pid;
      assert.notEqual(firstPid, secondPid);
      await firstSession.query("set statement_timeout='15s'; set role service_role");
      await secondSession.query("set statement_timeout='15s'; set role service_role");

      const waitUntilBlocked = async () => {
        const deadline = Date.now() + 10000;
        while (true) {
          const blockers = (await observer.query(
            'select pg_blocking_pids($1) as pids', [secondPid])).rows[0].pids;
          if (blockers.includes(firstPid)) return;
          assert.ok(Date.now() < deadline, 'second backend must be observed waiting on the first');
          await nextTurn();
        }
      };

      // Same submission on genuinely separate sessions: the second request is
      // observed waiting on the first transaction's advisory lock, then replays.
      const concurrentReplay = command({
        idempotencyKeyHash: digest('f'),
        payloadHash: digest('1'),
        payload: { email_hash: digest('2'), phone_hash: digest('3') },
      });
      const replayCounts = await snapshotCounts();
      await firstSession.query('begin');
      const concurrentWinner = await ingest(firstSession, concurrentReplay);
      const concurrentPending = ingest(secondSession, concurrentReplay)
        .then((value) => ({ value }), (error) => ({ error }));
      try {
        await waitUntilBlocked();
        assert.deepEqual(await snapshotCounts(), replayCounts);
        await firstSession.query('commit');
        const result = await concurrentPending;
        assert.equal(result.error, undefined);
        assert.equal(result.value.status, 'already-present');
        assert.equal(result.value.job_id, concurrentWinner.job_id);
      } finally {
        await firstSession.query('rollback');
        await concurrentPending;
      }
      assert.equal(await count('continuum_website_intakes'), replayCounts.continuum_website_intakes + 1);
      assert.equal(await count('continuum_project_jobs'), replayCounts.continuum_project_jobs + 1);
      assert.equal(await count('continuum_project_job_mutations'), replayCounts.continuum_project_job_mutations + 1);

      // Different submission keys claiming the same genuinely new identity also
      // serialize. The second request attaches to the first Person; no duplicate
      // Person or active email/phone identity can be minted.
      const sharedEmailHash = digest('4');
      const sharedPhoneHash = digest('5');
      const identityOne = command({
        idempotencyKeyHash: digest('6'), payloadHash: digest('7'),
        payload: { email: 'shared@example.com', email_hash: sharedEmailHash,
          phone: '6465550100', phone_hash: sharedPhoneHash },
      });
      const identityTwo = command({
        idempotencyKeyHash: digest('8'), payloadHash: digest('9'),
        payload: { email: 'shared@example.com', email_hash: sharedEmailHash,
          phone: '6465550100', phone_hash: sharedPhoneHash, submitted_at: '2026-09-30T14:00:01.000Z' },
      });
      const identityCounts = await snapshotCounts();
      await firstSession.query('begin');
      const identityWinner = await ingest(firstSession, identityOne);
      const identityPending = ingest(secondSession, identityTwo)
        .then((value) => ({ value }), (error) => ({ error }));
      try {
        await waitUntilBlocked();
        assert.deepEqual(await snapshotCounts(), identityCounts);
        await firstSession.query('commit');
        const result = await identityPending;
        assert.equal(result.error, undefined);
        assert.equal(result.value.identity_status, 'matched');
        assert.equal(result.value.person_id, identityWinner.person_id);
      } finally {
        await firstSession.query('rollback');
        await identityPending;
      }
      assert.equal(await count('continuum_person_profiles'), identityCounts.continuum_person_profiles + 1);
      assert.equal(await count('continuum_external_identities'), identityCounts.continuum_external_identities + 2);
      assert.equal(await count('continuum_website_intakes'), identityCounts.continuum_website_intakes + 2);

      // Cross-key ambiguity preserves the intake and creates review state, but
      // deliberately attaches neither conflicting Person to the Action Job.
      const seedPerson = async (personId, name) => {
        await observer.query(
          "insert into public.continuum_entities(id,kind,created_by) values ($1,'person','test')",
          [personId]);
        await observer.query(
          `insert into public.continuum_person_profiles
           (person_id,display_name,roles,source_system) values ($1,$2,'{prospect}','continuum')`,
          [personId, name]);
      };
      const emailPerson = randomUUID();
      const phonePerson = randomUUID();
      await seedPerson(emailPerson, 'Email Person');
      await seedPerson(phonePerson, 'Phone Person');
      const ambiguousEmailHash = digest('a');
      const ambiguousPhoneHash = digest('b');
      await observer.query(
        `insert into public.continuum_external_identities
          (id,entity_id,source_system,identity_kind,identifier)
         values ($1,$2,'continuum','email_hash',$3),($4,$5,'continuum','phone_hash',$6)`,
        [randomUUID(), emailPerson, ambiguousEmailHash, randomUUID(), phonePerson, ambiguousPhoneHash]);
      const ambiguous = command({
        idempotencyKeyHash: digest('0'), payloadHash: digest('c'),
        payload: { email_hash: ambiguousEmailHash, phone_hash: ambiguousPhoneHash },
      });
      const ambiguousResult = await ingest(observer, ambiguous);
      assert.equal(ambiguousResult.identity_status, 'needs_review');
      assert.equal(ambiguousResult.person_id, null);
      const ambiguousIntake = (await observer.query(
        'select * from public.continuum_website_intakes where intake_id=$1',
        [ambiguous.intakeId])).rows[0];
      assert.equal(ambiguousIntake.status, 'needs_review');
      assert.equal(ambiguousIntake.person_id, null);
      assert.equal(ambiguousIntake.identity_review_id, ambiguous.identityReviewId);
      const review = (await observer.query(
        'select * from public.continuum_identity_reviews where id=$1',
        [ambiguous.identityReviewId])).rows[0];
      assert.equal(review.reason_code, 'REVIEW_CROSS_KEY_CONFLICT');
      const ambiguousJob = (await observer.query(
        'select * from public.continuum_project_jobs where job_id=$1',
        [ambiguous.jobId])).rows[0];
      assert.equal(ambiguousJob.associated_person_id, null);

      // Force a failure at the final intake-ledger insert. PostgreSQL must roll
      // back the newly-created Person, identities, Job, and mutation/history.
      await observer.query('reset role');
      await observer.query(`
        create function public.reject_website_intake_test() returns trigger
        language plpgsql as $$ begin raise exception 'test-intake-ledger-failure'; end $$;
        create trigger reject_website_intake before insert on public.continuum_website_intakes
        for each row execute function public.reject_website_intake_test();
      `);
      await observer.query('set role service_role');
      const atomicCounts = await snapshotCounts();
      const atomic = command({
        idempotencyKeyHash: digest('d'), payloadHash: digest('e'),
        payload: { email: 'rollback@example.com', email_hash: digest('f'),
          phone: '9175550100', phone_hash: digest('1') },
      });
      await assert.rejects(ingest(observer, atomic), /test-intake-ledger-failure/);
      assert.deepEqual(await snapshotCounts(), atomicCounts);
      await observer.query('reset role');
      await observer.query('drop trigger reject_website_intake on public.continuum_website_intakes');
      await observer.query('drop function public.reject_website_intake_test()');
      await observer.query('set role service_role');

      // Synthetic health is ledger-only: no Person, identity, review, Job,
      // mutation, or HubSpot delivery state is created.
      const syntheticCounts = await snapshotCounts();
      const synthetic = command({
        idempotencyKeyHash: digest('2'), payloadHash: digest('3'),
        payload: {
          full_name: 'Continuum Intake Health', given_name: 'Continuum', family_name: 'Health',
          email: 'continuum-health@healthcheck.invalid', email_hash: digest('4'),
          phone: '', phone_hash: null, inspiration_notes: '', attribution: { health: true },
          synthetic: true,
        },
      });
      const syntheticResult = await ingest(observer, synthetic);
      assert.equal(syntheticResult.identity_status, 'synthetic');
      assert.equal(syntheticResult.person_id, null);
      assert.equal(syntheticResult.job_id, null);
      assert.equal(syntheticResult.hubspot_status, 'skipped');
      const afterSynthetic = await snapshotCounts();
      assert.equal(afterSynthetic.continuum_website_intakes, syntheticCounts.continuum_website_intakes + 1);
      for (const table of Object.keys(syntheticCounts).filter((name) => name !== 'continuum_website_intakes')) {
        assert.equal(afterSynthetic[table], syntheticCounts[table]);
      }

      // HubSpot outcome evidence and Continuum acceptance never claim that an
      // acknowledgement was sent. Only HubSpot fields change through this RPC.
      const acknowledged = command({
        idempotencyKeyHash: digest('5'), payloadHash: digest('6'),
        payload: { email: 'ack@example.com', email_hash: digest('7'),
          phone: '', phone_hash: null, acknowledgement_expected: true },
      });
      const acknowledgedResult = await ingest(observer, acknowledged);
      assert.equal(acknowledgedResult.status, 'created');
      assert.equal((await observer.query(
        'select acknowledgement_state from public.continuum_website_intakes where intake_id=$1',
        [acknowledged.intakeId])).rows[0].acknowledgement_state, 'pending');
      await observer.query(
        "select public.continuum_record_website_intake_hubspot($1,'succeeded','contact-1','deal-1',null)",
        [acknowledged.intakeId]);
      let outcome = (await observer.query(
        'select acknowledgement_state,hubspot_status,hubspot_contact_id,hubspot_deal_id from public.continuum_website_intakes where intake_id=$1',
        [acknowledged.intakeId])).rows[0];
      assert.deepEqual(outcome, {
        acknowledgement_state: 'pending', hubspot_status: 'succeeded',
        hubspot_contact_id: 'contact-1', hubspot_deal_id: 'deal-1',
      });
      assert.equal((await ingest(observer, acknowledged)).status, 'already-present');
      assert.equal((await observer.query(
        'select acknowledgement_state from public.continuum_website_intakes where intake_id=$1',
        [acknowledged.intakeId])).rows[0].acknowledgement_state, 'pending');
      await observer.query(
        "select public.continuum_record_website_intake_hubspot($1,'failed',null,null,'provider-failure')",
        [acknowledged.intakeId]);
      outcome = (await observer.query(
        'select acknowledgement_state,hubspot_status,hubspot_error_code from public.continuum_website_intakes where intake_id=$1',
        [acknowledged.intakeId])).rows[0];
      assert.deepEqual(outcome, {
        acknowledgement_state: 'pending', hubspot_status: 'failed', hubspot_error_code: 'provider-failure',
      });

      assert.equal(Number((await observer.query(
        "select count(*) as n from public.continuum_project_jobs where source_ref like 'website-intake:%' and attention_mode <> 'action'"
      )).rows[0].n), 0);
      assert.equal(Number((await observer.query(
        "select count(*) as n from public.continuum_project_jobs where source_ref like 'website-intake:%' and (activation_at is not null or checkpoint_at is not null or attention_metadata is not null)"
      )).rows[0].n), 0);
    } finally {
      await Promise.allSettled(clients.map((client) => client.end()));
      if (process.platform === 'win32' && process.env.POSTGRES_CTL && pg.process) {
        const child = pg.process;
        const exited = child.exitCode === null ? once(child, 'exit') : Promise.resolve();
        await promisify(execFile)(process.env.POSTGRES_CTL,
          ['-D', databaseDir, 'stop', '-m', 'fast', '-w'], { windowsHide: true });
        await exited;
        pg.process = undefined;
      } else {
        await pg.stop();
      }
    }
  });
