import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  discoverAndSuperviseShadowDeployment,
  superviseShadowDeployment,
} from "./continuum-shadow-deployment-orchestrator.mjs";

function fixture(states, options = {}) {
  const events = [];
  let index = 0;
  let deleted = false;
  let now = 0;
  const adapter = {
    async getDeployment() {
      events.push("get-deployment");
      if (deleted) throw Object.assign(new Error("deployment-not-found"), { code: "deployment-not-found" });
      return { state: states[Math.min(index++, states.length - 1)], target: "production", gitCommitSha: "a".repeat(40) };
    },
    async listDeploymentAliases() { events.push("list-aliases"); return options.aliases ?? []; },
    async getProject() {
      events.push("get-project");
      return { currentProductionId: "dpl_baseline", autoAssignCustomDomains: false };
    },
    async getAliasDeploymentId(alias) { events.push(`get-alias:${alias}`); return "dpl_baseline"; },
    async cancelDeployment() { events.push("cancel"); states.push("CANCELED"); },
    async deleteDeployment() { events.push("delete"); deleted = true; },
    async rollbackTo() { events.push("rollback"); },
    async deleteEnvironmentVariable(id) { events.push(`delete-env:${id}`); },
    async setAutoAssignCustomDomains(value) { events.push(`restore-auto:${value}`); },
  };
  const runtime = {
    now: () => now,
    async sleep(ms) {
      events.push(`sleep:${ms}`);
      now += ms;
      if (options.interrupt && !options.interrupted) {
        options.interrupted = true;
        throw new Error("deployment-supervisor-interrupted");
      }
    },
  };
  const input = {
    deploymentId: "dpl_attempt",
    expectedCommitSha: "a".repeat(40),
    baselineDeploymentId: "dpl_baseline",
    publicAliases: ["example.com"],
    attemptEnvIds: ["env_a"],
    originalAutoAssignCustomDomains: true,
    timeoutMs: options.timeoutMs ?? 100,
    cleanupTimeoutMs: 100,
    pollMs: 10,
    settleMs: 5,
  };
  return { adapter, runtime, input, events };
}

describe("Sterling shadow deployment supervisor", () => {
  it("restores settings only after stable READY, zero aliases, and intact public baseline", async () => {
    const f = fixture(["BUILDING", "READY", "READY"]);
    const result = await superviseShadowDeployment(f.input, f.adapter, f.runtime);
    assert.equal(result.status, "ready-unpromoted");
    assert.deepEqual(f.events.slice(-2), ["delete-env:env_a", "restore-auto:true"]);
    assert.ok(f.events.indexOf("list-aliases") < f.events.indexOf("restore-auto:true"));
    assert.ok(f.events.indexOf("get-alias:example.com") < f.events.indexOf("restore-auto:true"));
  });

  it("deletes a failed deployment before restoring settings", async () => {
    const f = fixture(["BUILDING", "ERROR"]);
    await assert.rejects(superviseShadowDeployment(f.input, f.adapter, f.runtime), /terminal-failure/);
    assert.ok(f.events.indexOf("delete") < f.events.indexOf("restore-auto:true"));
    assert.equal(f.events.includes("cancel"), false);
  });

  it("cancels and deletes a timed-out live deployment before restoring settings", async () => {
    const f = fixture(["BUILDING"], { timeoutMs: 0 });
    await assert.rejects(superviseShadowDeployment(f.input, f.adapter, f.runtime), /ready-timeout/);
    assert.ok(f.events.indexOf("cancel") < f.events.indexOf("delete"));
    assert.ok(f.events.indexOf("delete") < f.events.indexOf("restore-auto:true"));
  });

  it("contains an interrupted live deployment before restoring settings", async () => {
    const f = fixture(["BUILDING"], { interrupt: true });
    await assert.rejects(superviseShadowDeployment(f.input, f.adapter, f.runtime), /interrupted/);
    assert.ok(f.events.indexOf("cancel") < f.events.indexOf("delete"));
    assert.ok(f.events.indexOf("delete") < f.events.indexOf("restore-auto:true"));
  });

  it("starts discovery before create and recovers one server-recorded attempt without resubmission", async () => {
    const f = fixture(["READY", "READY"]);
    let discoveries = 0;
    f.adapter.findAttemptDeployments = async () => {
      f.events.push("discover");
      discoveries += 1;
      return discoveries === 1 ? [] : [{ id: "dpl_attempt" }];
    };
    const result = await discoverAndSuperviseShadowDeployment({
      ...f.input,
      attemptId: "attempt-1",
      attemptStartedAtMs: 0,
      discoveryTimeoutMs: 100,
    }, f.adapter, f.runtime);
    assert.equal(result.status, "ready-unpromoted");
    assert.equal(f.events.filter((event) => event === "discover").length, 2);
    assert.equal("createDeployment" in f.adapter, false);
  });

  it("holds automatic assignment disabled when an ambiguous create cannot be reconciled", async () => {
    const f = fixture(["BUILDING"], { timeoutMs: 10 });
    f.adapter.findAttemptDeployments = async () => [];
    await assert.rejects(discoverAndSuperviseShadowDeployment({
      ...f.input,
      attemptId: "attempt-ambiguous",
      attemptStartedAtMs: 0,
      discoveryTimeoutMs: 0,
    }, f.adapter, f.runtime), /safe-hold/);
    assert.equal(f.events.includes("restore-auto:true"), false);
    assert.equal(f.events.some((event) => event.startsWith("delete-env:")), false);
  });
});
