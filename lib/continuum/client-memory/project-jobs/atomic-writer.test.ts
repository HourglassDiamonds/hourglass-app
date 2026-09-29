import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { it } from "node:test";
import { SupabaseProjectJobWriter } from "./supabase-writer";
import type { ProjectJob } from "./types";
import { projectJobToRow } from "./write-row";

it("Supabase adapter sends one atomic RPC for projectless create and mutation, and propagates failure", async () => {
  let stored: Record<string, unknown> | null = null;
  let fail = false;
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const filters: unknown[][] = [];
  const client = {
    from(table: string) {
      let single = false;
      const query = {
        select() { return this; },
        eq(...args: unknown[]) { filters.push(["eq", ...args]); return this; },
        is(...args: unknown[]) { filters.push(["is", ...args]); return this; },
        in() { return this; },
        maybeSingle() { single = true; return this; },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: table === "continuum_project_jobs" ? (single ? stored : []) : null, error: null }).then(resolve);
        },
      };
      return query;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      if (fail) return { data: null, error: { message: "history-insert-failed" } };
      stored = args.p_job as Record<string, unknown>;
      return { data: { status: args.p_action === "create" ? "created" : "updated", job: stored }, error: null };
    },
  };
  const writer = new SupabaseProjectJobWriter(client as never);
  const created = await writer.createJob({ mutationId: randomUUID(), projectId: null, kind: "required_action", subject: "Prepare plan", waitingOnActor: "founder", actor: "founder" });
  assert.ok(created.ok);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "continuum_write_project_job");
  assert.equal(calls[0].args.p_prior, null);
  assert.ok(filters.some(row => row[0] === "is" && row[1] === "project_id" && row[2] === null));
  const mutationId = randomUUID();
  const result = await writer.mutateJob({ mutationId, jobId: created.job.jobId, action: "resolve", actor: "founder" });
  assert.ok(result.ok);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].args.p_mutation_id, mutationId);
  assert.deepEqual(calls[1].args.p_prior, projectJobToRow(created.job));
  // A rejected transaction must not be reported as canonical success.
  stored = projectJobToRow({ ...created.job } satisfies ProjectJob);
  fail = true;
  assert.equal((await writer.mutateJob({ mutationId: randomUUID(), jobId: created.job.jobId, action: "cancel", actor: "founder" })).ok, false);
});


it("checks persisted requests before returning Supabase retry success, including after later edits", async () => {
  let stored: Record<string, unknown> | null = null;
  const operations = new Map<string, { job_id: unknown; operation: { request: unknown } }>();
  let writes = 0;
  const client = {
    from(table: string) {
      let key = "";
      let single = false;
      return {
        select() { return this; },
        eq(column: string, value: string) { if (column === "mutation_id") key = value; return this; },
        is() { return this; }, in() { return this; },
        maybeSingle() { single = true; return this; },
        then(resolve: (value: unknown) => unknown) {
          const data = table === "continuum_project_job_mutations" ? operations.get(key) ?? null : single ? stored : [];
          return Promise.resolve({ data, error: null }).then(resolve);
        },
      };
    },
    async rpc(_name: string, args: Record<string, unknown>) {
      writes++;
      stored = args.p_job as Record<string, unknown>;
      operations.set(String(args.p_mutation_id), { job_id: stored.job_id, operation: { request: args.p_request } });
      return { data: { status: args.p_action === "create" ? "created" : "updated", job: stored }, error: null };
    },
  };
  const writer = new SupabaseProjectJobWriter(client as never);
  const request = { mutationId: randomUUID(), projectId: null, kind: "required_action", subject: "Plan", waitingOnActor: "founder", actor: "founder" };
  const created = await writer.createJob(request);
  assert.ok(created.ok);
  assert.equal((await writer.createJob(request)).ok, true);
  assert.deepEqual(await writer.createJob({ ...request, detail: "Changed" }), { ok: false, reason: "invalid-input", code: "idempotency-conflict" });
  const mutation = { mutationId: randomUUID(), jobId: created.job.jobId, actor: "founder", action: "update", subject: "Revised plan" };
  assert.equal((await writer.mutateJob(mutation)).ok, true);
  assert.equal((await writer.mutateJob(mutation)).ok, true);
  assert.deepEqual(await writer.mutateJob({ ...mutation, subject: "Other" }), { ok: false, reason: "invalid-input", code: "idempotency-conflict" });
  assert.equal((await writer.createJob(request)).ok, true);
  assert.equal(writes, 2);
  assert.equal(operations.size, 2);
  // Historical rows without an operation snapshot cannot prove idempotency.
  operations.set(request.mutationId, { job_id: created.job.jobId, operation: { request: null } });
  assert.deepEqual(await writer.createJob(request), { ok: false, reason: "invalid-input", code: "idempotency-conflict" });
  assert.equal(writes, 2);
});
