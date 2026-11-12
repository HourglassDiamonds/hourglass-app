import assert from "node:assert/strict";
import { access, mkdir, readdir, writeFile } from "node:fs/promises";
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
    const result = await executeLocalConnectorShadow({ evidenceBytes: SYNTHETIC, timeoutMs: 10_000 }, {
      startWatchdog: () => undefined,
      runChild: async ({ evidencePath }) => {
        await access(evidencePath);
        return { exitCode: 0, stdout: JSON.stringify({ contract: "sterling-operational-shadow-v11-sanitized-result-v1",
          generatedBoard: [], comparator: { passed: true } }), stderr: "", timedOut: false };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.tempDirectoryDeleted, true);
    assert.deepEqual((await leftovers()).filter((name) => !before.has(name)), []);
    assert.doesNotMatch(JSON.stringify(result), /SYNTHETIC-CORRESPONDENCE-BODY|synthetic@example\.test/);
  });

  it("cleans up after validation/model failure and timeout with sanitized errors", async () => {
    for (const child of [
      { exitCode: 1, stdout: "", stderr: "connector-mailbox-mismatch", timedOut: false },
      { exitCode: 1, stdout: "", stderr: "raw provider failure", timedOut: false },
      { exitCode: 1, stdout: "", stderr: "", timedOut: true },
      { exitCode: 0, stdout: JSON.stringify({ plainText: "SYNTHETIC-CORRESPONDENCE-BODY" }), stderr: "", timedOut: false },
    ]) {
      const result = await executeLocalConnectorShadow({ evidenceBytes: SYNTHETIC, timeoutMs: 10_000 }, {
        startWatchdog: () => undefined,
        runChild: async () => child,
      });
      assert.equal(result.ok, false);
      assert.equal(result.tempDirectoryDeleted, true);
      assert.doesNotMatch(JSON.stringify(result), /raw provider failure|SYNTHETIC-CORRESPONDENCE-BODY|synthetic@example\.test/);
    }
  });

  it("rejects an input hash mismatch before creating temporary evidence", async () => {
    const before = await leftovers();
    const result = await executeLocalConnectorShadow({ evidenceBytes: SYNTHETIC,
      expectedSha256: "0".repeat(64), timeoutMs: 10_000 });
    assert.equal(result.ok, false);
    assert.equal(result.ok ? "" : result.safeCode, "evidence-input-hash-mismatch");
    assert.match(result.evidenceSha256 ?? "", /^[a-f0-9]{64}$/);
    assert.equal(result.tempDirectoryDeleted, true);
    assert.deepEqual(await leftovers(), before);
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
