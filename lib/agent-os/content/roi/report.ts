/**
 * Human-readable Content ROI inspection report (CLI / audits).
 */

import type { ContentRoiSnapshot } from "./types";

export function formatContentRoiReport(snapshot: ContentRoiSnapshot): string {
  const lines: string[] = [];
  lines.push("# Content ROI Prioritization — Inspection");
  lines.push("");
  lines.push(`- Status: ${snapshot.status}`);
  lines.push(`- Questions scored: ${snapshot.questionAssessments.length}`);
  lines.push(`- Packages: ${snapshot.packages.length}`);
  lines.push(
    `- Founder-facing packages: ${snapshot.founderFacingPackages.length}`,
  );
  lines.push("");
  lines.push("## Weights");
  for (const [k, v] of Object.entries(snapshot.weights)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push("");
  if (snapshot.editorialSequenceNote) {
    lines.push("## Canonical editorial sequence");
    lines.push(snapshot.editorialSequenceNote);
    lines.push("");
  }
  lines.push("## Reserved Conversation cycles");
  for (const c of snapshot.reservedCycles) {
    lines.push(
      `${c.position}. ${c.conversationTitle} → Taste: ${c.tasteTitle}`,
    );
  }
  lines.push("");
  lines.push(
    `## Reserve-backlog topics (${snapshot.reserveBacklogTopics.length})`,
  );
  for (const t of snapshot.reserveBacklogTopics) {
    lines.push(`- ${t.title} (${t.id})`);
  }
  lines.push("");
  lines.push("## Top 10 post-sequence editorial packages");
  snapshot.top10Packages.forEach((p, i) => {
    lines.push(
      `${i + 1}. [${p.overallRoi}] ${p.workingTitle} — ${p.primaryFormat} (${p.productionEffort})`,
    );
    lines.push(`   ${p.reasoningSummary}`);
  });
  lines.push("");
  lines.push("## Top 25 post-sequence topics");
  snapshot.top25Topics.forEach((p, i) => {
    lines.push(
      `${i + 1}. [${p.overallRoi}] ${p.workingTitle} — ${p.primaryFormat}`,
    );
  });
  lines.push("");
  lines.push("## Recommended sequence after reserved three");
  snapshot.postSequenceOrder.slice(0, 12).forEach((s) => {
    lines.push(
      `${s.order}. ${s.workingTitle} (${s.primaryFormat}, ${s.balanceTag}, ROI ${s.overallRoi})`,
    );
  });
  lines.push("");
  lines.push("## Taste pairings (when assigned)");
  for (const p of [...snapshot.reservedCycles.map((c) => ({
    title: c.conversationTitle,
    taste: c.tasteTitle,
  })), ...snapshot.top10Packages
    .filter((p) => p.tasteAngle)
    .map((p) => ({ title: p.workingTitle, taste: p.tasteAngle! }))]) {
    lines.push(`- ${p.title} → ${p.taste}`);
  }
  lines.push("");
  lines.push(`## FAQ-only (${snapshot.faqOnly.length})`);
  snapshot.faqOnly.slice(0, 15).forEach((q) => {
    lines.push(`- ${q.canonicalQuestion}`);
  });
  lines.push("");
  lines.push(`## Sales-support-only (${snapshot.salesSupportOnly.length})`);
  snapshot.salesSupportOnly.slice(0, 15).forEach((q) => {
    lines.push(`- ${q.canonicalQuestion}`);
  });
  lines.push("");
  lines.push(`## Low-ROI uncovered (${snapshot.lowRoiUncovered.length})`);
  snapshot.lowRoiUncovered.slice(0, 15).forEach((q) => {
    lines.push(`- [${q.scores.overall}] ${q.canonicalQuestion}`);
  });
  lines.push("");
  lines.push(`## Evidence-needed (${snapshot.evidenceNeeded.length})`);
  snapshot.evidenceNeeded.slice(0, 15).forEach((q) => {
    lines.push(`- ${q.canonicalQuestion}`);
  });
  lines.push("");
  lines.push("## Backlog candidates (not auto-inserted)");
  for (const b of snapshot.backlogCandidates) {
    lines.push(
      `- [${b.status}] ${b.title} — next: ${b.nextAction}`,
    );
  }
  return lines.join("\n");
}
