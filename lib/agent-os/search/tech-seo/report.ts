/**
 * Markdown report formatter — returns strings only (no filesystem writes).
 */

import {
  EVIDENCE_TABLE_COLUMNS,
  REQUIRED_REPORT_SECTIONS,
  TECH_SEO_AREAS,
  type TechSeoCloseoutJson,
  type TechSeoEvidenceRow,
  type TechSeoVerdict,
} from "./types";

export function computeVerdict(
  rows: TechSeoEvidenceRow[],
  evidenceGaps: string[],
  liveHttpRequested: boolean,
): TechSeoVerdict {
  const hasP0 = rows.some((r) => r.severity === "P0");
  const hasP1 = rows.some((r) => r.severity === "P1");
  const hasP2 = rows.some((r) => r.severity === "P2");

  // If live HTTP was requested but every probe unknown and many gaps — blocked
  const onlyUnknownLive =
    liveHttpRequested &&
    evidenceGaps.some((g) => /UNKNOWN|INSUFFICIENT EVIDENCE/i.test(g)) &&
    !hasP0 &&
    !hasP1 &&
    rows.filter((r) => r.area === "Redirects/404s").every((r) =>
      /UNKNOWN|skipped|Live HTTP skipped/i.test(r.observedState),
    );

  if (onlyUnknownLive && evidenceGaps.length > 0 && !hasP2) {
    // Still may have repo INFO — not fully blocked unless repo also empty of signal
  }

  if (hasP0 || hasP1) return "MATERIAL ISSUES FOUND";
  if (hasP2) return "CLEAN WITH MINOR ISSUES";

  // Heavy evidence gaps without material issues
  if (
    evidenceGaps.some((g) => /Authenticated GSC data unavailable/i.test(g)) &&
    !liveHttpRequested
  ) {
    // GSC gap alone does not block a clean technical repo audit
    return "CLEAN";
  }

  return "CLEAN";
}

export function buildRankedNextFixes(rows: TechSeoEvidenceRow[]): string[] {
  const actionable = rows.filter(
    (r) =>
      r.severity === "P0" ||
      r.severity === "P1" ||
      r.severity === "P2",
  );
  const rank = { P0: 0, P1: 1, P2: 2, INFO: 3 } as const;
  actionable.sort(
    (a, b) => rank[a.severity] - rank[b.severity] || a.area.localeCompare(b.area),
  );
  return actionable.map(
    (r) =>
      `[${r.severity}] ${r.area} · ${r.urlOrFile} — ${r.recommendedAction}`,
  );
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function formatEvidenceTable(rows: TechSeoEvidenceRow[]): string {
  const header = `| ${EVIDENCE_TABLE_COLUMNS.join(" | ")} |`;
  const sep = `| ${EVIDENCE_TABLE_COLUMNS.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) =>
    `| ${escapeCell(r.area)} | ${escapeCell(r.urlOrFile)} | ${escapeCell(r.observedState)} | ${escapeCell(r.expectedState)} | ${r.severity} | ${escapeCell(r.evidence)} | ${escapeCell(r.recommendedAction)} |`,
  );
  return [header, sep, ...body].join("\n");
}

export function formatTechSeoMarkdown(report: TechSeoCloseoutJson): string {
  const lines: string[] = [];
  lines.push(`# ${report.auditId} — ${report.auditName}`);
  lines.push("");
  lines.push(`- **Specialist:** ${report.specialist}`);
  lines.push(`- **Executive:** ${report.originatingExecutive}`);
  lines.push(`- **Mode:** ${report.mode}`);
  lines.push(`- **Generated:** ${report.generatedAt}`);
  lines.push(`- **Intended canonical host:** ${report.intendedCanonicalHost}`);
  lines.push(`- **Executive verdict:** **${report.verdict}**`);
  lines.push("");
  lines.push("## Evidence table");
  lines.push("");
  lines.push(formatEvidenceTable(report.evidenceRows));
  lines.push("");

  for (const section of REQUIRED_REPORT_SECTIONS) {
    lines.push(`## ${section}`);
    lines.push("");
    if (section === "Ranked next contained fixes") {
      if (report.rankedNextFixes.length === 0) {
        lines.push("- None — no evidence-supported P0–P2 fixes ranked.");
      } else {
        for (const fix of report.rankedNextFixes) {
          lines.push(`- ${fix}`);
        }
      }
      lines.push("");
      continue;
    }

    const areaRows = report.evidenceRows.filter((r) => r.area === section);
    // Map section names that equal areas
    const mapped =
      areaRows.length > 0
        ? areaRows
        : report.evidenceRows.filter((r) =>
            TECH_SEO_AREAS.includes(r.area as (typeof TECH_SEO_AREAS)[number]),
          );

    const rowsForSection =
      section === "Robots/indexability"
        ? report.evidenceRows.filter((r) => r.area === "Robots/indexability")
        : report.evidenceRows.filter((r) => r.area === section);

    if (rowsForSection.length === 0) {
      lines.push("_No rows for this section._");
    } else {
      for (const r of rowsForSection) {
        lines.push(
          `- **${r.severity}** \`${r.urlOrFile}\` — observed: ${r.observedState}`,
        );
        lines.push(`  - Expected: ${r.expectedState}`);
        lines.push(`  - Evidence: ${r.evidence}`);
        lines.push(`  - Action: ${r.recommendedAction} _(tier: ${r.permissionTier})_`);
      }
    }
    lines.push("");
    void mapped;
  }

  lines.push("## Facts vs inferences");
  lines.push("");
  lines.push("### Facts");
  for (const f of report.facts) lines.push(`- ${f}`);
  lines.push("");
  lines.push("### Inferences");
  if (report.inferences.length === 0) {
    lines.push("- None recorded.");
  } else {
    for (const i of report.inferences) lines.push(`- ${i}`);
  }
  lines.push("");
  lines.push("## Evidence gaps");
  lines.push("");
  if (report.evidenceGaps.length === 0) {
    lines.push("- None.");
  } else {
    for (const g of report.evidenceGaps) lines.push(`- ${g}`);
  }
  lines.push("");
  lines.push("## GSC readiness snapshot");
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(report.gscReadiness, null, 2));
  lines.push("```");
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push(
    "_Audit only. No site source was modified. No deploy/push/GBP/GSC mutations._",
  );

  return lines.join("\n");
}

export function assertReportContract(markdown: string): string[] {
  const missing: string[] = [];
  for (const section of REQUIRED_REPORT_SECTIONS) {
    if (!markdown.includes(`## ${section}`)) {
      missing.push(`section:${section}`);
    }
  }
  for (const col of EVIDENCE_TABLE_COLUMNS) {
    if (!markdown.includes(col)) {
      missing.push(`column:${col}`);
    }
  }
  return missing;
}
