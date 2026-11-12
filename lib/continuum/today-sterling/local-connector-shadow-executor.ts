import { createHash, randomBytes } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { constants, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export const CONNECTOR_TEMP_PREFIX = "continuum-sterling-shadow-";
const OWNER_FILE = ".continuum-evidence-owner.json";

type ChildResult = { exitCode: number; stdout: string; stderr: string; timedOut: boolean };

export type ConnectorExecutionReceipt = {
  contract: "sterling-connector-shadow-execution-receipt-v1";
  runId: string;
  sourceSha: string | null;
  startedAt: string;
  completedAt: string | null;
  stage: "initialized" | "evidence_persisted" | "model_execution_started" | "result_persisted" | "completed" | "failed";
  process: { exitCode: number | null; timedOut: boolean | null };
  model: { requestId: string | null; responseId: string | null };
  result: { path: string | null; byteCount: number | null; sha256: string | null };
  completion: { assembler: boolean; validator: boolean; comparator: boolean };
  evidence: { threadCount: number | null; messageCount: number | null; limitationCount: number | null };
  cleanup: { rawEvidenceDirectoryDeleted: boolean | null };
  safeCode: string | null;
};

export type LocalConnectorExecutorResult =
  | { ok: true; evidenceSha256: string; receipt: ConnectorExecutionReceipt; tempDirectoryDeleted: true }
  | { ok: false; safeCode: string; evidenceSha256: string | null; receipt: ConnectorExecutionReceipt | null;
      tempDirectoryDeleted: boolean };

type ExecutorDependencies = {
  runChild?: (input: { evidencePath: string; timeoutMs: number }) => Promise<ChildResult>;
  startWatchdog?: (input: { directory: string; token: string; parentPid: number; deadlineMs: number }) => void;
};

function isOwnedTempDirectory(directory: string): boolean {
  const root = resolve(tmpdir());
  const target = resolve(directory);
  const child = relative(root, target);
  return isAbsolute(target) && child !== "" && child !== ".." && !child.startsWith(`..${sep}`) &&
    basename(target).startsWith(CONNECTOR_TEMP_PREFIX);
}
async function removeOwnedDirectory(directory: string, token: string): Promise<boolean> {
  if (!isOwnedTempDirectory(directory)) return false;
  try {
    const owner = JSON.parse(await readFile(join(directory, OWNER_FILE), "utf8")) as { token?: unknown };
    if (owner.token !== token) return false;
    await rm(directory, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

async function restrictDirectory(directory: string): Promise<void> {
  if (process.platform !== "win32") {
    const handle = await open(directory, constants.O_RDONLY);
    try { await handle.chmod(0o700); } finally { await handle.close(); }
    return;
  }
  const { stdout } = await execFileAsync("whoami", ["/user", "/fo", "csv", "/nh"], { windowsHide: true });
  const sid = stdout.match(/S-\d-(?:\d+-)+\d+/)?.[0];
  if (!sid) throw new Error("temporary-directory-acl-identity-unavailable");
  await execFileAsync("icacls", [directory, "/inheritance:r", "/grant:r", `*${sid}:(OI)(CI)F`], { windowsHide: true });
}

async function atomicWrite(directory: string, filename: string, bytes: Uint8Array): Promise<string> {
  const pending = join(directory, `${filename}.${randomBytes(8).toString("hex")}.pending`);
  const destination = join(directory, filename);
  const handle = await open(pending, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(pending, destination);
  return destination;
}

async function atomicJson(directory: string, filename: string, value: unknown): Promise<{ path: string; bytes: Buffer }> {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  return { path: await atomicWrite(directory, filename, bytes), bytes };
}

function evidenceDigest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function sanitizedJson(stdout: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(stdout); } catch { throw new Error("shadow-output-not-json"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shadow-output-invalid");
  const serialized = JSON.stringify(parsed);
  if (/"(?:plainText|snippet|fromRaw|fromEmail|to|cc|rawPrompt|rawResponse|apiKey|refreshToken|credential)"\s*:/i.test(serialized) ||
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serialized)) {
    throw new Error("shadow-output-sensitive-content");
  }
  return parsed as Record<string, unknown>;
}

function resultMetrics(result: Record<string, unknown>) {
  const scope = result.scope && typeof result.scope === "object" ? result.scope as Record<string, unknown> : null;
  const board = Array.isArray(result.generatedBoard) ? result.generatedBoard : null;
  const semantic = result.semantic && typeof result.semantic === "object" ? result.semantic as Record<string, unknown> : null;
  const comparator = result.comparator && typeof result.comparator === "object" ? result.comparator as Record<string, unknown> : null;
  return {
    threadCount: typeof scope?.threadCount === "number" ? scope.threadCount : null,
    limitationCount: Array.isArray(result.evidenceLimitations) ? result.evidenceLimitations.length : null,
    assembler: board !== null,
    validator: semantic?.validationAccepted === true,
    comparator: comparator !== null,
  };
}

function evidenceMetrics(bytes: Uint8Array): { threadCount: number | null; messageCount: number | null } {
  try {
    const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as { threads?: Array<{ messages?: unknown[] }> };
    return Array.isArray(parsed.threads) ? {
      threadCount: parsed.threads.length,
      messageCount: parsed.threads.reduce((sum, thread) =>
        sum + (Array.isArray(thread.messages) ? thread.messages.length : 0), 0),
    } : { threadCount: null, messageCount: null };
  } catch { return { threadCount: null, messageCount: null }; }
}

function safeRunId(value: string | undefined): string {
  const candidate = value?.trim();
  return candidate && /^[A-Za-z0-9._-]{1,128}$/.test(candidate)
    ? candidate
    : `local-${Date.now()}-${randomBytes(8).toString("hex")}`;
}

function defaultResultsRoot(): string {
  const local = process.env.LOCALAPPDATA?.trim();
  if (!local) throw new Error("local-results-root-unavailable");
  return join(local, "Continuum", "sterling-shadow-results");
}

export async function runConnectorShadowChild(input: {
  evidencePath: string;
  timeoutMs: number;
}): Promise<ChildResult> {
  const projectRoot = process.cwd();
  const tsxCli = resolve(projectRoot, "node_modules/tsx/dist/cli.mjs");
  const script = resolve(projectRoot, "scripts/continuum-sterling-today-shadow.ts");
  const evidence = await readFile(input.evidencePath);
  return await new Promise<ChildResult>((resolveResult) => {
    const child = spawn(process.execPath, [
      "--conditions=react-server",
      tsxCli,
      script,
      "--with-model",
      "--november-11-operational-reconciliation",
      "--connector-json-stdin",
    ], { cwd: projectRoot, env: process.env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, Math.max(1, input.timeoutMs));
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", () => {
      clearTimeout(timer);
      resolveResult({ exitCode: 1, stdout: "", stderr: "shadow-process-unavailable", timedOut });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolveResult({ exitCode: code ?? 1, stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"), timedOut });
    });
    child.stdin.end(evidence);
  });
}

export function startConnectorCleanupWatchdog(input: {
  directory: string;
  token: string;
  parentPid: number;
  deadlineMs: number;
}): void {
  const script = resolve(process.cwd(), "scripts/continuum-sterling-evidence-cleanup-watchdog.mjs");
  const child = spawn(process.execPath, [script, input.directory, input.token, String(input.parentPid), String(input.deadlineMs)], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

export async function executeLocalConnectorShadow(input: {
  evidenceBytes: Uint8Array;
  expectedSha256?: string | null;
  timeoutMs: number;
  cleanupDeadlineMs?: number;
  tempRoot?: string;
  resultsRoot?: string;
  runId?: string;
  sourceSha?: string | null;
}, dependencies: ExecutorDependencies = {}): Promise<LocalConnectorExecutorResult> {
  const digest = evidenceDigest(input.evidenceBytes);
  if (input.expectedSha256 && input.expectedSha256.toLowerCase() !== digest) {
    return { ok: false, safeCode: "evidence-input-hash-mismatch", evidenceSha256: digest, receipt: null,
      tempDirectoryDeleted: true };
  }
  const runId = safeRunId(input.runId ?? process.env.CONTINUUM_STERLING_OPERATIONAL_SHADOW_EXECUTION_ID);
  const startedAt = new Date().toISOString();
  const resultsRoot = resolve(input.resultsRoot ?? defaultResultsRoot());
  await mkdir(resultsRoot, { recursive: true, mode: 0o700 });
  const resultsDirectory = join(resultsRoot, runId);
  await mkdir(resultsDirectory, { recursive: false, mode: 0o700 });
  await restrictDirectory(resultsDirectory);
  const evidenceCounts = evidenceMetrics(input.evidenceBytes);
  let receipt: ConnectorExecutionReceipt = {
    contract: "sterling-connector-shadow-execution-receipt-v1", runId,
    sourceSha: input.sourceSha ?? process.env.CONTINUUM_SOURCE_COMMIT?.trim() ?? null,
    startedAt, completedAt: null, stage: "initialized",
    process: { exitCode: null, timedOut: null }, model: { requestId: null, responseId: null },
    result: { path: null, byteCount: null, sha256: null },
    completion: { assembler: false, validator: false, comparator: false },
    evidence: { ...evidenceCounts, limitationCount: null },
    cleanup: { rawEvidenceDirectoryDeleted: null }, safeCode: null,
  };
  const persistReceipt = async () => { await atomicJson(resultsDirectory, "receipt.json", receipt); };
  await persistReceipt();
  const root = resolve(input.tempRoot ?? tmpdir());
  await mkdir(root, { recursive: true });
  const directory = join(root, `${CONNECTOR_TEMP_PREFIX}${randomBytes(16).toString("hex")}`);
  const token = randomBytes(32).toString("hex");
  let cleanupComplete = false;
  try {
    await mkdir(directory, { recursive: false, mode: 0o700 });
    if (!isOwnedTempDirectory(directory)) throw new Error("temporary-directory-outside-local-temp");
    await writeFile(join(directory, OWNER_FILE), JSON.stringify({ token, createdAt: new Date().toISOString() }),
      { encoding: "utf8", flag: "wx", mode: 0o600 });
    await restrictDirectory(directory);
    const deadlineMs = Date.now() + Math.max(60_000, input.cleanupDeadlineMs ?? input.timeoutMs + 120_000);
    (dependencies.startWatchdog ?? startConnectorCleanupWatchdog)({
      directory,
      token,
      parentPid: process.pid,
      deadlineMs,
    });
    const evidencePath = await atomicWrite(directory, "evidence.json", input.evidenceBytes);
    const persisted = await readFile(evidencePath);
    if (evidenceDigest(persisted) !== digest) throw new Error("evidence-persisted-hash-mismatch");
    receipt = { ...receipt, stage: "evidence_persisted" };
    await persistReceipt();
    receipt = { ...receipt, stage: "model_execution_started" };
    await persistReceipt();
    const child = await (dependencies.runChild ?? runConnectorShadowChild)({ evidencePath, timeoutMs: input.timeoutMs });
    receipt = { ...receipt, process: { exitCode: child.exitCode, timedOut: child.timedOut } };
    await persistReceipt();
    if (child.timedOut) throw new Error("shadow-execution-timeout");
    if (child.exitCode !== 0 && child.exitCode !== 2) throw new Error("shadow-execution-failed");
    const result = sanitizedJson(child.stdout);
    const saved = await atomicJson(resultsDirectory, "sanitized-result.json", result);
    const metrics = resultMetrics(result);
    receipt = { ...receipt, stage: "result_persisted",
      result: { path: saved.path, byteCount: saved.bytes.length, sha256: evidenceDigest(saved.bytes) },
      completion: { assembler: metrics.assembler, validator: metrics.validator, comparator: metrics.comparator },
      evidence: { threadCount: metrics.threadCount, messageCount: receipt.evidence.messageCount,
        limitationCount: metrics.limitationCount } };
    await persistReceipt();
    cleanupComplete = await removeOwnedDirectory(directory, token);
    if (!cleanupComplete) throw new Error("temporary-evidence-cleanup-unconfirmed");
    receipt = { ...receipt, stage: "completed", completedAt: new Date().toISOString(),
      cleanup: { rawEvidenceDirectoryDeleted: true } };
    await persistReceipt();
    return { ok: true, evidenceSha256: digest, receipt, tempDirectoryDeleted: true };
  } catch (error) {
    cleanupComplete = await removeOwnedDirectory(directory, token);
    const safeCode = error instanceof Error && [
      "temporary-directory-acl-identity-unavailable",
      "temporary-directory-outside-local-temp",
      "evidence-persisted-hash-mismatch",
      "shadow-execution-timeout",
      "shadow-execution-failed",
      "shadow-output-not-json",
      "shadow-output-invalid",
      "shadow-output-sensitive-content", "temporary-evidence-cleanup-unconfirmed",
    ].includes(error.message) ? error.message : "local-shadow-execution-unavailable";
    receipt = { ...receipt, stage: "failed", completedAt: new Date().toISOString(), safeCode,
      cleanup: { rawEvidenceDirectoryDeleted: cleanupComplete } };
    await persistReceipt().catch(() => undefined);
    return { ok: false, safeCode, evidenceSha256: digest, receipt, tempDirectoryDeleted: cleanupComplete };
  } finally {
    if (!cleanupComplete) await removeOwnedDirectory(directory, token).catch(() => false);
  }
}
