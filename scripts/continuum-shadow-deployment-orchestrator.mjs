#!/usr/bin/env node

import { spawnSync } from "node:child_process";

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
    deploymentId: required("--deployment-id"),
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
  const controller = new AbortController();
  process.once("SIGINT", () => controller.abort());
  process.once("SIGTERM", () => controller.abort());
  try {
    const result = await superviseShadowDeployment(
      { ...input, signal: controller.signal },
      cliAdapter(input),
    );
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ status: "contained", error: error.message })}\n`);
    process.exitCode = 1;
  }
}
