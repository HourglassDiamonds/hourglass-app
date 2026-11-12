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

export type LocalConnectorExecutorResult =
  | { ok: true; evidenceSha256: string; sanitizedResult: Record<string, unknown>; tempDirectoryDeleted: true }
  | { ok: false; safeCode: string; evidenceSha256: string | null; tempDirectoryDeleted: boolean };

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
}, dependencies: ExecutorDependencies = {}): Promise<LocalConnectorExecutorResult> {
  const digest = evidenceDigest(input.evidenceBytes);
  if (input.expectedSha256 && input.expectedSha256.toLowerCase() !== digest) {
    return { ok: false, safeCode: "evidence-input-hash-mismatch", evidenceSha256: digest, tempDirectoryDeleted: true };
  }
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
    const child = await (dependencies.runChild ?? runConnectorShadowChild)({ evidencePath, timeoutMs: input.timeoutMs });
    if (child.timedOut) throw new Error("shadow-execution-timeout");
    if (child.exitCode !== 0 && child.exitCode !== 2) throw new Error("shadow-execution-failed");
    const result = sanitizedJson(child.stdout);
    cleanupComplete = await removeOwnedDirectory(directory, token);
    return cleanupComplete
      ? { ok: true, evidenceSha256: digest, sanitizedResult: result, tempDirectoryDeleted: true }
      : { ok: false, safeCode: "temporary-evidence-cleanup-unconfirmed", evidenceSha256: digest,
        tempDirectoryDeleted: false };
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
      "shadow-output-sensitive-content",
    ].includes(error.message) ? error.message : "local-shadow-execution-unavailable";
    return { ok: false, safeCode, evidenceSha256: digest, tempDirectoryDeleted: cleanupComplete };
  } finally {
    if (!cleanupComplete) await removeOwnedDirectory(directory, token).catch(() => false);
  }
}
