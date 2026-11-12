import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { randomBytes } from "node:crypto";
import { hashEmail } from "../client-memory/hashes";
import { NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS } from "./operational-reconciliation-scope";
import {
  CONNECTOR_TEMP_PREFIX,
  executeLocalConnectorShadow,
  startConnectorCleanupWatchdog,
} from "./local-connector-shadow-executor";

const SYNTHETIC = Buffer.from(JSON.stringify({ plainText: "SYNTHETIC-CORRESPONDENCE-BODY",
  fromEmail: "synthetic@example.test" }));

function syntheticEnvelope(large = false) {
  const now = new Date().toISOString();
  return Buffer.from(JSON.stringify({ version: "continuum-gmail-connector-evidence-v1",
    mailbox: { emailHash: hashEmail("synthetic@example.test"), verifiedAt: now,
      verificationSource: "gmail_connector_profile" }, retrieval: { startedAt: now, completedAt: now },
    threads: NOVEMBER_11_OPERATIONAL_RECONCILIATION_THREAD_IDS.map((threadId, index) => ({ threadId,
      retrievedAt: now, coverage: { status: "complete", basis: "provider_complete", pageCount: 1,
        returnedMessageCount: 1, nextPageTokenPresent: false }, messages: [{ threadId,
        messageId: `synthetic-${index}`, sentAt: now, fromRaw: null, fromEmail: null, to: [], cc: [],
        subject: "Synthetic", plainText: large && index === 0 ? "z".repeat(400_000) : "Synthetic body",
        bodyExtractionStatus: "decoded_plaintext", snippet: null, attachments: [] }] })) }), "utf8");
}

async function leftovers() {
  return (await readdir(tmpdir())).filter((name) => name.startsWith(CONNECTOR_TEMP_PREFIX));
}

describe("bounded local connector executor", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  it("atomically transfers synthetic evidence and deletes its exact directory", async () => {
    const before = new Set(await leftovers());
    const resultsRoot = await mkdtemp(join(tmpdir(), "sterling-results-test-"));
    const result = await executeLocalConnectorShadow({ evidenceBytes: SYNTHETIC, timeoutMs: 10_000,
      resultsRoot, runId: "normal-completion", sourceSha: "a".repeat(40) }, {
      startWatchdog: () => undefined,
      runChild: async ({ evidencePath }) => {
        await access(evidencePath);
        return { exitCode: 0, signal: null, stdout: JSON.stringify({
          contract: "sterling-operational-shadow-v11-sanitized-result-v1",
          generatedBoard: [], comparator: { passed: true } }), stderr: "", timedOut: false, stdinError: false };
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
      runChild: async () => ({ exitCode: 0, signal: null, stdout: JSON.stringify(large), stderr: "",
        timedOut: false, stdinError: false }) });
    assert.equal(result.ok, true);
    assert.ok(result.ok && (result.receipt.result.byteCount ?? 0) > 500_000);
    assert.ok(JSON.stringify(result).length < 2_500);
    const persisted = await readFile(join(resultsRoot, "oversized", "sanitized-result.json"), "utf8");
    assert.equal(JSON.parse(persisted).generatedBoard.length, 4_000);
    await rm(resultsRoot, { recursive: true, force: true });
  });

  it("cleans up after validation/model failure and timeout with sanitized errors", async () => {
    for (const child of [
      { exitCode: 1, signal: null, stdout: "", stderr: "connector-mailbox-mismatch", timedOut: false, stdinError: false },
      { exitCode: 1, signal: null, stdout: "", stderr: "raw provider failure", timedOut: false, stdinError: false },
      { exitCode: 1, signal: "SIGTERM" as const, stdout: "", stderr: "", timedOut: true, stdinError: false },
      { exitCode: 0, signal: null, stdout: JSON.stringify({ plainText: "SYNTHETIC-CORRESPONDENCE-BODY" }),
        stderr: "", timedOut: false, stdinError: false },
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

  it("runs the real parent/child launcher with large stdin, fake model transport, comparator, and durable output", async () => {
    const resultsRoot = await mkdtemp(join(tmpdir(), "sterling-results-e2e-"));
    const prior = { node: process.env.NODE_ENV, scenario: process.env.CONTINUUM_STERLING_TEST_CHILD_SCENARIO,
      founder: process.env.CONTINUUM_GMAIL_FOUNDER_EMAIL };
    mutableEnv.NODE_ENV = "test"; process.env.CONTINUUM_STERLING_TEST_CHILD_SCENARIO = "oversized_success";
    process.env.CONTINUUM_GMAIL_FOUNDER_EMAIL = "synthetic@example.test";
    try {
      const result = await executeLocalConnectorShadow({ evidenceBytes: syntheticEnvelope(true), timeoutMs: 30_000,
        resultsRoot, runId: "real-launcher-success" }, { startWatchdog: () => undefined });
      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.ok && result.receipt.completion.comparator, true);
      assert.ok(result.ok && (result.receipt.result.byteCount ?? 0) > 500_000);
      assert.deepEqual(result.ok ? result.receipt.stageHistory.map((row) => row.stage) : [], [
        "initialized", "evidence_persisted", "child_launched", "input_transferred", "envelope_validated",
        "assembly_completed", "evidence_gate_evaluated", "model_request_dispatched", "model_response_received",
        "validation_comparison_completed", "sanitized_result_persisted", "completed",
      ]);
    } finally {
      if (prior.node === undefined) delete mutableEnv.NODE_ENV; else mutableEnv.NODE_ENV = prior.node;
      if (prior.scenario === undefined) delete process.env.CONTINUUM_STERLING_TEST_CHILD_SCENARIO;
      else process.env.CONTINUUM_STERLING_TEST_CHILD_SCENARIO = prior.scenario;
      if (prior.founder === undefined) delete process.env.CONTINUUM_GMAIL_FOUNDER_EMAIL;
      else process.env.CONTINUUM_GMAIL_FOUNDER_EMAIL = prior.founder;
      await rm(resultsRoot, { recursive: true, force: true });
    }
  });

  it("records early rejection, premature exit, broken stdin, and model timeout without false success", async () => {
    const prior = { node: process.env.NODE_ENV, scenario: process.env.CONTINUUM_STERLING_TEST_CHILD_SCENARIO,
      founder: process.env.CONTINUUM_GMAIL_FOUNDER_EMAIL };
    mutableEnv.NODE_ENV = "test"; process.env.CONTINUUM_GMAIL_FOUNDER_EMAIL = "synthetic@example.test";
    try {
      for (const scenario of ["early_rejection", "premature_exit", "broken_stdin", "model_timeout"] as const) {
        const resultsRoot = await mkdtemp(join(tmpdir(), `sterling-results-${scenario}-`));
        process.env.CONTINUUM_STERLING_TEST_CHILD_SCENARIO = scenario;
        const result = await executeLocalConnectorShadow({ evidenceBytes: syntheticEnvelope(true),
          timeoutMs: scenario === "model_timeout" ? 750 : 30_000, resultsRoot, runId: scenario },
        { startWatchdog: () => undefined });
        assert.equal(result.ok, false, scenario);
        assert.equal(result.receipt?.stage, "failed", scenario);
        assert.equal(result.receipt?.result.path, null, scenario);
        assert.equal(result.receipt?.completion.comparator, false, scenario);
        if (scenario === "broken_stdin") assert.equal(result.receipt?.process.stdinError, true);
        if (scenario === "model_timeout") assert.equal(result.receipt?.process.timedOut, true);
        await rm(resultsRoot, { recursive: true, force: true });
      }
    } finally {
      if (prior.node === undefined) delete mutableEnv.NODE_ENV; else mutableEnv.NODE_ENV = prior.node;
      if (prior.scenario === undefined) delete process.env.CONTINUUM_STERLING_TEST_CHILD_SCENARIO;
      else process.env.CONTINUUM_STERLING_TEST_CHILD_SCENARIO = prior.scenario;
      if (prior.founder === undefined) delete process.env.CONTINUUM_GMAIL_FOUNDER_EMAIL;
      else process.env.CONTINUUM_GMAIL_FOUNDER_EMAIL = prior.founder;
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
