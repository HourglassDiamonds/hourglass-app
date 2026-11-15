import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  discoverAndSuperviseShadowDeployment,
  superviseShadowDeployment,
} from "./continuum-shadow-deployment-orchestrator.mjs";
import { readFileSync } from "node:fs";

function fixture(states, options = {}) {
  const events = [];
  let index = 0;
  let deleted = false;
  let now = 0;
  const adapter = {
    async getDeployment(id) {
      events.push("get-deployment");
      if (deleted) throw Object.assign(new Error("deployment-not-found"), { code: "deployment-not-found" });
      if (id === "dpl_preview") {
        return {
          state: "READY",
          target: null,
          gitCommitSha: "a".repeat(40),
          gitCommitRef: "codex/continuum-controlled-release",
          projectId: "prj_hourglass",
        };
      }
      return {
        state: states[Math.min(index++, states.length - 1)],
        target: "production",
        gitCommitSha: "a".repeat(40),
        gitCommitRef: "codex/continuum-controlled-release",
        projectId: "prj_hourglass",
      };
    },
    async listDeploymentAliases() {
      events.push("list-aliases");
      if (options.aliasRestored) return [];
      return options.aliases ?? [];
    },
    async getProject() {
      events.push("get-project");
      return {
        currentProductionId: "dpl_baseline",
        autoAssignCustomDomains: false,
        ssoProtection: { enabled: true, deploymentType: "all_except_custom_domains" },
      };
    },
    async getAliasDeploymentId(alias) {
      events.push(`get-alias:${alias}`);
      if (alias === "branch.example" && options.aliasRestored) return "dpl_preview";
      return "dpl_baseline";
    },
    async cancelDeployment() { events.push("cancel"); states.push("CANCELED"); },
    async deleteDeployment() { events.push("delete"); deleted = true; },
    async rollbackTo() { events.push("rollback"); },
    async assignAlias(id, alias) {
      events.push(`assign-alias:${id}:${alias}`);
      options.aliasRestored = true;
    },
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
    aliasRestoreTimeoutMs: 50,
    projectId: "prj_hourglass",
    protectedBranchAlias: "branch.example",
    automaticPreviewDeploymentId: "dpl_preview",
    expectedBranch: "codex/continuum-controlled-release",
  };
  return { adapter, runtime, input, events };
}

describe("Sterling shadow deployment supervisor", () => {
  it("supports the shell-free Vercel JavaScript entrypoint on Windows", () => {
    const source = readFileSync("scripts/continuum-shadow-deployment-orchestrator.mjs", "utf8");
    assert.match(source, /process\.execPath/);
    assert.match(source, /\[options\.vercelCliJs, \.\.\.args\]/);
    assert.match(source, /--vercel-cli-js/);
  });
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

  it("deletes an alias-bearing READY attempt without rolling back an intact public baseline", async () => {
    const f = fixture(["READY", "READY"], { aliases: [{ alias: "unexpected.example" }] });
    await assert.rejects(superviseShadowDeployment(f.input, f.adapter, f.runtime), /deployment-was-promoted/);
    assert.equal(f.events.includes("rollback"), false);
    assert.ok(f.events.indexOf("delete") < f.events.indexOf("restore-auto:true"));
  });

  it("returns only the exact protected branch alias to the verified automatic Preview", async () => {
    const f = fixture(["READY", "READY"], { aliases: [{ alias: "branch.example" }] });
    const result = await superviseShadowDeployment(f.input, f.adapter, f.runtime);
    assert.equal(result.status, "ready-unpromoted");
    assert.ok(f.events.includes("assign-alias:dpl_preview:branch.example"));
    assert.ok(f.events.indexOf("assign-alias:dpl_preview:branch.example") < f.events.indexOf("restore-auto:true"));
    assert.equal(f.events.filter((event) => event === "list-aliases").length >= 2, true);
  });

  it("rejects the known branch alias when the automatic Preview identity is wrong", async () => {
    const f = fixture(["READY", "READY"], { aliases: [{ alias: "branch.example" }] });
    const original = f.adapter.getDeployment;
    f.adapter.getDeployment = async (id) => {
      const row = await original(id);
      return id === "dpl_preview" ? { ...row, gitCommitRef: "main" } : row;
    };
    await assert.rejects(superviseShadowDeployment(f.input, f.adapter, f.runtime), /automatic-preview-identity-mismatch/);
    assert.equal(f.events.some((event) => event.startsWith("assign-alias:")), false);
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
