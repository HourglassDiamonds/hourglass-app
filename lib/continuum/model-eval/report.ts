import type { EvalReport } from "./types";

export function formatTerminalReport(report: EvalReport): string {
  const lines = [`Continuum model evaluation — ${report.fixtureCount} fixtures`, ""];
  for (const fixtureId of [...new Set(report.results.map((row) => row.fixtureId))]) {
    const rows = report.results.filter((row) => row.fixtureId === fixtureId);
    lines.push(fixtureId);
    for (const row of rows) {
      const tools = row.toolNames.length ? row.toolNames.join(",") : "—";
      lines.push(`  ${row.model.padEnd(14)} ${row.checks.passed ? "PASS" : "FAIL"}  ${String(row.latencyMs).padStart(6)}ms  tokens ${row.inputTokens ?? "—"}/${row.outputTokens ?? "—"}  tools ${row.toolCount} [${tools}]`);
      if (!row.checks.passed) lines.push(`    checks inference=${row.checks.inferenceSucceeded} grounded=${row.checks.groundedCorrect} tools=${row.checks.expectedTools} unsupported=${row.checks.unsupportedClaim} structured=${row.checks.structuredOutputValid} noWrites=${row.checks.noCanonicalWrites}`);
    }
  }
  lines.push("", "Deterministic checks only; no universal quality score is calculated.", "Human review fields are present in JSON for correctness, judgment, usefulness, and trustworthiness.");
  return lines.join("\n");
}
