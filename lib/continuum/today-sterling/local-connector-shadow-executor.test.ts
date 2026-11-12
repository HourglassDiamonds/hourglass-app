import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { randomBytes } from "node:crypto";
import {
  CONNECTOR_TEMP_PREFIX,
  executeLocalConnectorShadow,
  startConnectorCleanupWatchdog,
} from "./local-connector-shadow-executor";

const SYNTHETIC = Buffer.from(JSON.stringify({ plainText: "SYNTHETIC-CORRESPONDENCE-BODY",
  fromEmail: "synthetic@example.test" }));

async function leftovers() {
  return (await readdir(tmpdir())).filter((name) => name.startsWith(CONNECTOR_TEMP_PREFIX));
}

describe("bounded local connector executor", () => {
  it("atomically transfers synthetic evidence and deletes its exact directory", async () => {
    const before = new Set(await leftovers());
    const resultsRoot = await mkdtemp(join(tmpdir(), "sterling-results-test-"));
    const result = await executeLocalConnectorShadow({ evidenceBytes: SYNTHETIC, timeoutMs: 10_000,
      resultsRoot, runId: "normal-completion", sourceSha: "a".repeat(40) }, {
      startWatchdog: () => undefined,
      runChild: async ({ evidencePath }) => {
        await access(evidencePath);
        return { exitCode: 0, stdout: JSON.stringify({ contract: "sterling-operational-shadow-v11-sanitized-result-v1",
          generatedBoard: [], comparator: { passed: true } }), stderr: "", timedOut: false };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.tempDirectoryDeleted, true);
    assert.equal(result.ok && result.receipt.stage, "completed");
    assert.equal(result.ok && result.receipt.completion.comparator, true);
    assert.match(result.ok ? result.receipt.result.sha256 ?? "" : "", /^[a-f0-9]{64}$/);
    assert.equal(JSON.parse(await readFile(join(resultsRoot, "normal-completion", "receipt.json"), "utf8")).stage,
      "completed");
    assert.deepEqual((await leftovers()).filter((name) => !before.has(name)), []);
    assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC-CORRESPONDENCE-BODY|synthetic@example\.test/);
    await rm(resultsRoot, { recursive: true, force: true });
  });

  it("persists oversized sanitized output before returning a compact receipt", async () => {
    const resultsRoot = await mkdtemp(join(tmpdir(), "sterling-results-large-"));
    const large = { contract: "sterling-operational-shadow-v11-sanitized-result-v1",
      scope: { threadCount: 23 }, generatedBoard: Array.from({ length: 4_000 }, (_, index) => ({
        workUnitId: `synthetic-${index}`, nextAction: "synthetic safe action".repeat(8),
      })), evidenceLimitations: [], semantic: { validationAccepted: true }, comparator: { passed: true } };
    const result = await executeLocalConnectorShadow({ evidenceBytes: SYNTHETIC, timeoutMs: 10_000,
      resultsRoot, runId: "oversized" }, { startWatchdog: () => undefined,
      runChild: async () => ({ exitCode: 0, stdout: JSON.stringify(large), stderr: "", timedOut: false }) });
    assert.equal(result.ok, true);
    assert.ok(result.ok && (result.receipt.result.byteCount ?? 0) > 500_000);
    assert.ok(JSON.stringify(result).length < 2_500);
    const persisted = await readFile(join(resultsRoot, "oversized", "sanitized-result.json"), "utf8");
    assert.equal(JSON.parse(persisted).generatedBoard.length, 4_000);
    await rm(resultsRoot, { recursive: true, force: true });
  });

  it("cleans up after validation/model failure and timeout with sanitized errors", async () => {
    for (const child of [
      { exitCode: 1, stdout: "", stderr: "connector-mailbox-mismatch", timedOut: false },
      { exitCode: 1, stdout: "", stderr: "raw provider failure", timedOut: false },
      { exitCode: 1, stdout: "", stderr: "", timedOut: true },
      { exitCode: 0, stdout: JSON.stringify({ plainText: "SYNTHETIC-CORRESPONDENCE-BODY" }), stderr: "", timedOut: false },
    ]) {
      const resultsRoot = await mkdtemp(join(tmpdir(), "sterling-results-failure-"));
      const result = await executeLocalConnectorShadow({ evidenceBytes: SYNTHETIC, timeoutMs: 10_000,
        resultsRoot, runId: "failed-run" }, {
        startWatchdog: () => undefined,
        runChild: async () => child,
      });
      assert.equal(result.ok, false);
      assert.equal(result.tempDirectoryDeleted, true);
      assert.equal(result.receipt?.stage, "failed");
      assert.equal(result.receipt?.result.path, null);
      assert.equal(JSON.parse(await readFile(join(resultsRoot, "failed-run", "receipt.json"), "utf8")).stage,
        "failed");
      assert.doesNotMatch(JSON.stringify(result), /raw provider failure|SYNTHETIC-CORRESPONDENCE-BODY|synthetic@example\.test/);
      await rm(resultsRoot, { recursive: true, force: true });
    }
  });

  it("rejects an input hash mismatch before creating temporary evidence", async () => {
    const before = await leftovers();
    const resultsRoot = await mkdtemp(join(tmpdir(), "sterling-results-hash-"));
    const result = await executeLocalConnectorShadow({ evidenceBytes: SYNTHETIC,
      expectedSha256: "0".repeat(64), timeoutMs: 10_000, resultsRoot });
    assert.equal(result.ok, false);
    assert.equal(result.ok ? "" : result.safeCode, "evidence-input-hash-mismatch");
    assert.match(result.evidenceSha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(result.tempDirectoryDeleted, true);
    assert.deepEqual(await leftovers(), before);
    await rm(resultsRoot, { recursive: true, force: true });
  });

  it("independent watchdog deletes only an exact manifest-owned directory after controller loss", async () => {
    const token = randomBytes(32).toString("hex");
    const directory = join(tmpdir(), `${CONNECTOR_TEMP_PREFIX}${randomBytes(16).toString("hex")}`);
    await mkdir(directory, { mode: 0o700 });
    await writeFile(join(directory, ".continuum-evidence-owner.json"), JSON.stringify({ token }), "utf8");
    await writeFile(join(directory, "evidence.json"), SYNTHETIC);
    startConnectorCleanupWatchdog({ directory, token, parentPid: 2_147_483_000, deadlineMs: Date.now() + 5_000 });
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try { await access(directory); } catch { return; }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail("cleanup watchdog did not remove the manifest-owned directory");
  });
});
