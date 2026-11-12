import { executeLocalConnectorShadow } from "../lib/continuum/today-sterling/local-connector-shadow-executor";

async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function main() {
  const evidenceBytes = await readStdin();
  if (evidenceBytes.length === 0) throw new Error("connector-evidence-stdin-empty");
  const timeoutMs = Number(process.env.CONTINUUM_STERLING_CONNECTOR_EXECUTION_TIMEOUT_MS ?? "300000");
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 600_000) {
    throw new Error("connector-execution-timeout-invalid");
  }
  const result = await executeLocalConnectorShadow({
    evidenceBytes,
    expectedSha256: process.env.CONTINUUM_STERLING_CONNECTOR_EVIDENCE_SHA256?.trim() || null,
    timeoutMs,
    runId: process.env.CONTINUUM_STERLING_OPERATIONAL_SHADOW_EXECUTION_ID,
    sourceSha: process.env.CONTINUUM_SOURCE_COMMIT?.trim() || null,
  });
  const compact = result.ok
    ? { ok: true, evidenceSha256: result.evidenceSha256, receipt: result.receipt }
    : { ok: false, safeCode: result.safeCode, evidenceSha256: result.evidenceSha256, receipt: result.receipt };
  process.stdout.write(`${JSON.stringify(compact)}\n`);
  if (!result.ok) process.exitCode = 1;
}

main().catch((error) => {
  const safeCode = error instanceof Error && [
    "connector-evidence-stdin-empty",
    "connector-execution-timeout-invalid",
  ].includes(error.message) ? error.message : "connector-executor-unavailable";
  process.stderr.write(`${safeCode}\n`);
  process.exitCode = 1;
});
