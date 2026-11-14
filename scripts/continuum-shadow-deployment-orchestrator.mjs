#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { renameSync, writeFileSync } from "node:fs";

const LIVE_STATES = new Set(["INITIALIZING", "QUEUED", "BUILDING"]);
const FAILURE_STATES = new Set(["ERROR", "CANCELED", "BLOCKED"]);

function stateOf(deployment) {
  return String(deployment?.state ?? deployment?.readyState ?? "UNKNOWN").toUpperCase();
}

function notFound(error) {
  return error?.code === "deployment-not-found";
}

async function verifyPublicBaseline(adapter, input) {
  const project = await adapter.getProject();
  if (project.autoAssignCustomDomains !== false) {
    throw new Error("automatic-domain-assignment-not-disabled");
  }
  if (project.currentProductionId !== input.baselineDeploymentId) {
    throw new Error("public-current-drift");
  }
  for (const alias of input.publicAliases) {
    const owner = await adapter.getAliasDeploymentId(alias);
    if (owner !== input.baselineDeploymentId) {
      throw new Error(`public-alias-drift:${alias}`);
    }
  }
}

async function deploymentOrNull(adapter, deploymentId) {
  try {
    return await adapter.getDeployment(deploymentId);
  } catch (error) {
    if (notFound(error)) return null;
    throw error;
  }
}

async function containAttempt(adapter, input, runtime) {
  let deployment = await deploymentOrNull(adapter, input.deploymentId);
  if (deployment && LIVE_STATES.has(stateOf(deployment))) {
    await adapter.cancelDeployment(input.deploymentId);
  }

  const deadline = runtime.now() + input.cleanupTimeoutMs;
  while ((deployment = await deploymentOrNull(adapter, input.deploymentId))) {
    const state = stateOf(deployment);
    if (LIVE_STATES.has(state)) {
      if (runtime.now() >= deadline) throw new Error("deployment-cancel-timeout");
      await runtime.sleep(input.pollMs);
      continue;
    }
    if (state === "READY") {
      await adapter.rollbackTo(input.baselineDeploymentId);
    }
    await adapter.deleteDeployment(input.deploymentId);
    break;
  }

  while (await deploymentOrNull(adapter, input.deploymentId)) {
    if (runtime.now() >= deadline) throw new Error("deployment-delete-timeout");
    await runtime.sleep(input.pollMs);
  }
  await verifyPublicBaseline(adapter, input);
}

async function restoreTemporaryConfiguration(adapter, input) {
  for (const envId of input.attemptEnvIds) {
    await adapter.deleteEnvironmentVariable(envId);
  }
  await adapter.setAutoAssignCustomDomains(input.originalAutoAssignCustomDomains);
}

export async function superviseShadowDeployment(input, adapter, runtime = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    input.signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("deployment-supervisor-interrupted"), { name: "AbortError" }));
    }, { once: true });
  }),
}) {
  const deadline = runtime.now() + input.timeoutMs;
  try {
    await verifyPublicBaseline(adapter, input);
    let deployment;
    for (;;) {
      if (input.signal?.aborted) throw new Error("deployment-supervisor-interrupted");
      deployment = await adapter.getDeployment(input.deploymentId);
      const state = stateOf(deployment);
      if (state === "READY") break;
      if (FAILURE_STATES.has(state)) throw new Error(`deployment-terminal-failure:${state}`);
      if (!LIVE_STATES.has(state)) throw new Error(`deployment-unexpected-state:${state}`);
      if (runtime.now() >= deadline) throw new Error("deployment-ready-timeout");
      await runtime.sleep(input.pollMs);
    }

    await runtime.sleep(input.settleMs);
    deployment = await adapter.getDeployment(input.deploymentId);
    if (stateOf(deployment) !== "READY") throw new Error("deployment-not-stably-ready");
    if (deployment.target !== "production") throw new Error("deployment-target-mismatch");
    if (String(deployment.gitCommitSha ?? "").toLowerCase() !== input.expectedCommitSha) {
      throw new Error("deployment-source-mismatch");
    }

    const aliases = await adapter.listDeploymentAliases(input.deploymentId);
    if (aliases.length !== 0) throw new Error("deployment-was-promoted");
    await verifyPublicBaseline(adapter, input);

    await restoreTemporaryConfiguration(adapter, input);
    return { status: "ready-unpromoted", deploymentId: input.deploymentId };
  } catch (error) {
    await containAttempt(adapter, input, runtime);
    await restoreTemporaryConfiguration(adapter, input);
    throw error;
  }
}

export async function discoverAndSuperviseShadowDeployment(input, adapter, runtime) {
  const deadline = runtime.now() + input.discoveryTimeoutMs;
  for (;;) {
    if (input.signal?.aborted) {
      throw Object.assign(new Error("attempt-discovery-interrupted-safe-hold"), { safeHold: true });
    }
    const matches = await adapter.findAttemptDeployments({
      attemptId: input.attemptId,
      expectedCommitSha: input.expectedCommitSha,
      startedAtMs: input.attemptStartedAtMs,
    });
    if (matches.length > 1) {
      throw Object.assign(new Error("attempt-discovery-multiple-safe-hold"), { safeHold: true });
    }
    if (matches.length === 1) {
      return superviseShadowDeployment(
        { ...input, deploymentId: matches[0].id },
        adapter,
        runtime,
      );
    }
    if (runtime.now() >= deadline) {
      throw Object.assign(new Error("attempt-discovery-timeout-safe-hold"), { safeHold: true });
    }
    await runtime.sleep(input.pollMs);
  }
}

function cliAdapter(options) {
  const query = `teamId=${encodeURIComponent(options.teamId)}`;
  function api(path, method = "GET", body) {
    const args = ["api", path, "-X", method, "--raw"];
    if (body !== undefined) args.push("--input", "-");
    if (method === "DELETE") args.push("--dangerously-skip-permissions");
    const result = spawnSync(options.vercelPath, args, {
      input: body === undefined ? undefined : JSON.stringify(body),
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0) {
      const safe = `${result.stderr ?? ""}${result.stdout ?? ""}`;
      const error = new Error(safe.includes("404") ? "deployment-not-found" : "vercel-api-failed");
      if (safe.includes("404")) error.code = "deployment-not-found";
      throw error;
    }
    const text = String(result.stdout ?? "").trim();
    return text ? JSON.parse(text) : null;
  }
  return {
    async findAttemptDeployments(input) {
      const row = api(
        `/v7/deployments?projectId=${options.projectId}` +
        `&sha=${input.expectedCommitSha}&since=${input.startedAtMs}&limit=20&${query}`,
      );
      return (row.deployments ?? []).filter((deployment) =>
        deployment.meta?.continuumShadowAttemptId === input.attemptId &&
        String(deployment.meta?.githubCommitSha ?? deployment.meta?.gitCommitSha ?? "").toLowerCase() ===
          input.expectedCommitSha,
      ).map((deployment) => ({ id: deployment.uid ?? deployment.id }));
    },
    async getDeployment(id) {
      const row = api(`/v13/deployments/${id}?${query}`);
      return {
        state: row.state ?? row.readyState,
        target: row.target,
        gitCommitSha: row.meta?.githubCommitSha ?? row.meta?.gitCommitSha,
      };
    },
    async listDeploymentAliases(id) {
      return api(`/v2/deployments/${id}/aliases?${query}`)?.aliases ?? [];
    },
    async getProject() {
      const row = api(`/v9/projects/${options.projectId}?${query}`);
      return {
        currentProductionId: row.targets?.production?.id ?? null,
        autoAssignCustomDomains: row.autoAssignCustomDomains,
      };
    },
    async getAliasDeploymentId(alias) {
      return api(`/v4/aliases/${encodeURIComponent(alias)}?projectId=${options.projectId}&${query}`)?.deploymentId ?? null;
    },
    async cancelDeployment(id) {
      api(`/v12/deployments/${id}/cancel?${query}`, "PATCH", {});
    },
    async deleteDeployment(id) {
      api(`/v13/deployments/${id}?${query}`, "DELETE");
    },
    async rollbackTo(id) {
      api(`/v1/projects/${options.projectId}/rollback/${id}?${query}`, "POST", {});
    },
    async deleteEnvironmentVariable(id) {
      api(`/v9/projects/${options.projectId}/env/${id}?${query}`, "DELETE");
    },
    async setAutoAssignCustomDomains(value) {
      api(`/v9/projects/${options.projectId}?${query}`, "PATCH", { autoAssignCustomDomains: value });
    },
  };
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error("invalid-arguments");
    const list = values.get(key) ?? [];
    list.push(value);
    values.set(key, list);
  }
  const one = (key) => values.get(key)?.at(-1);
  const required = (key) => one(key) ?? (() => { throw new Error(`missing:${key}`); })();
  return {
    deploymentId: one("--deployment-id"),
    attemptId: one("--attempt-id"),
    attemptStartedAtMs: Number(one("--attempt-started-at-ms") ?? Date.now()),
    discoveryTimeoutMs: Number(one("--discovery-timeout-ms") ?? 1_200_000),
    manifestPath: one("--manifest-path"),
    expectedCommitSha: required("--expected-sha").toLowerCase(),
    baselineDeploymentId: required("--baseline-deployment-id"),
    publicAliases: values.get("--public-alias") ?? [],
    attemptEnvIds: values.get("--attempt-env-id") ?? [],
    originalAutoAssignCustomDomains: required("--original-auto-assign") === "true",
    timeoutMs: Number(one("--timeout-ms") ?? 1_200_000),
    cleanupTimeoutMs: Number(one("--cleanup-timeout-ms") ?? 180_000),
    pollMs: Number(one("--poll-ms") ?? 5_000),
    settleMs: Number(one("--settle-ms") ?? 10_000),
    projectId: required("--project-id"),
    teamId: required("--team-id"),
    vercelPath: required("--vercel-path"),
  };
}

if (import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href) {
  const input = parseArgs(process.argv.slice(2));
  if (!input.deploymentId && !input.attemptId) throw new Error("missing-deployment-or-attempt-id");
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  try {
    if (input.attemptId && input.manifestPath) {
      const manifest = {
        contract: "continuum-shadow-deployment-attempt-v1",
        attemptId: input.attemptId,
        expectedCommitSha: input.expectedCommitSha,
        baselineDeploymentId: input.baselineDeploymentId,
        startedAtMs: input.attemptStartedAtMs,
        stage: "supervisor_started_before_create",
      };
      const temporary = `${input.manifestPath}.tmp`;
      writeFileSync(temporary, `${JSON.stringify(manifest)}\n`, { encoding: "utf8", mode: 0o600 });
      renameSync(temporary, input.manifestPath);
    }
    const supervisedInput = { ...input, signal: controller.signal };
    const result = input.deploymentId
      ? await superviseShadowDeployment(supervisedInput, cliAdapter(input))
      : await discoverAndSuperviseShadowDeployment(supervisedInput, cliAdapter(input), {
          now: () => Date.now(),
          sleep: (ms) => new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, ms);
            controller.signal.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(Object.assign(new Error("attempt-discovery-interrupted-safe-hold"), { safeHold: true }));
            }, { once: true });
          }),
        });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: error.safeHold ? "safe-hold" : "contained", error: error.message })}\n`);
    process.exitCode = 1;
  }
}
