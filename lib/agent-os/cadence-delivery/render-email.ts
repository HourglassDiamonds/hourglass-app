/**
 * Render Chief of Staff founder brief email (HTML + text).
 * Daily: concise morning operating brief. Weekly: performance-review framing.
 * Readable, capped priorities, honest but compact data confidence.
 */

import type { AgentRun } from "../types";
import { redactSecretsAndPii } from "../redaction";
import {
  buildDataConfidenceNote,
  cleanFounderFacingAction,
  dailyTodayCall,
  formatFounderLocalDateLabel,
  formatWeeklyRangeLabel,
  localDateFromCadenceWindow,
  resolveBriefCadenceIntent,
} from "../brief-quality";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type RenderedAgentOsEmail = {
  subject: string;
  html: string;
  text: string;
};

function materialBlockers(blocked: string[]): string[] {
  return blocked.filter(
    (b) =>
      b &&
      !/^none$/i.test(b.trim()) &&
      !/not yet operational/i.test(b),
  );
}

function materialDecisions(decisions: string[]): string[] {
  return decisions.filter(
    (d) =>
      d &&
      !/^none required/i.test(d.trim()) &&
      !/^none$/i.test(d.trim()),
  );
}

function opportunityToWatch(run: AgentRun): string | null {
  const wait = run.brief.canSafelyWait.find(
    (w) => w && !/^none$/i.test(w.trim()) && !/deferred/i.test(w),
  );
  if (wait && wait.length < 180) return wait;
  const watch = run.brief.needsAttentionToday.find(
    (t) =>
      t &&
      !/^see highest/i.test(t) &&
      !/^none$/i.test(t) &&
      !run.brief.surfacedPriorityTitles.includes(t),
  );
  return watch ?? null;
}

export function renderFounderBriefEmail(input: {
  run: AgentRun;
  cadenceId: string;
  cadenceWindow: string;
  degraded: boolean;
}): RenderedAgentOsEmail {
  const { run, cadenceId, cadenceWindow, degraded } = input;
  const intent = resolveBriefCadenceIntent(cadenceId);
  const titles = run.brief.surfacedPriorityTitles.slice(0, 5);
  const localDate = localDateFromCadenceWindow(
    cadenceWindow,
    run.generatedAt,
  );
  const dailyLabel = formatFounderLocalDateLabel(localDate);
  const weeklyPeriod = formatWeeklyRangeLabel(
    run.reportingPeriod.start,
    run.reportingPeriod.end,
  );

  const heading =
    intent === "daily" ? "Morning Brief" : "Founder Brief";
  const periodLine =
    intent === "daily" ? dailyLabel : weeklyPeriod;

  const subject =
    intent === "daily"
      ? degraded
        ? `Hourglass Morning Brief · Partial data · ${dailyLabel}`
        : `Hourglass Morning Brief · ${dailyLabel}`
      : degraded
        ? `Hourglass Agent OS · Degraded founder brief · ${cadenceWindow}`
        : `Hourglass Agent OS · Founder brief · ${cadenceWindow}`;

  const highestRoi = cleanFounderFacingAction(
    run.brief.highestRoiAction || "None this cycle",
  );
  const todayCall =
    intent === "daily"
      ? dailyTodayCall({
          whyItMatters: run.brief.whyItMatters,
          highestRoiAction: highestRoi,
        })
      : run.brief.whyItMatters;

  const priorityLis = titles
    .map(
      (t, i) =>
        `<li style="margin:0 0 10px;font-size:14px;line-height:1.65;color:#4a443e;"><strong>${i + 1}.</strong> ${escapeHtml(redactSecretsAndPii(t))}</li>`,
    )
    .join("");

  const decisions = materialDecisions(run.brief.founderDecisionNeeded);
  const blockers = materialBlockers(run.brief.blocked);
  const watch = intent === "daily" ? opportunityToWatch(run) : null;

  const execNotes = run.executiveStatuses
    .filter((e) => e.status !== "completed")
    .map(
      (e) =>
        `${e.executiveId}: ${e.status}${e.note ? ` — ${redactSecretsAndPii(e.note)}` : ""}`,
    )
    .slice(0, 6);

  const confidence = buildDataConfidenceNote({
    missingOrUnreliableData: run.brief.missingOrUnreliableData,
    executiveNotes: intent === "weekly" ? execNotes : [],
    briefEvidenceQuality: run.briefEvidenceQuality,
    criticalFailure:
      run.briefEvidenceQuality === "failed" ||
      run.briefEvidenceQuality === "none-blocked" ||
      run.runStatus === "failed",
  });

  const confidenceHtml =
    intent === "daily"
      ? `<tr><td style="padding:0 32px 20px;"><p style="margin:0 0 8px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Data confidence</p><p style="margin:0;font-size:13px;line-height:1.6;color:#6a635c;"><strong>${escapeHtml(confidence.level)}</strong> — ${escapeHtml(redactSecretsAndPii(confidence.summary))}</p>${
          confidence.showDetails && confidence.detailLines.length
            ? `<ul style="margin:10px 0 0;padding:0 0 0 18px;">${confidence.detailLines
                .map(
                  (l) =>
                    `<li style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#6a635c;">${escapeHtml(redactSecretsAndPii(l))}</li>`,
                )
                .join("")}</ul>`
            : ""
        }</td></tr>`
      : [
          run.brief.missingOrUnreliableData.length
            ? `<tr><td style="padding:0 32px 24px;"><p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Source gaps (not deterioration)</p><ul style="margin:0;padding:0 0 0 18px;">${run.brief.missingOrUnreliableData
                .slice(0, 6)
                .map(
                  (g) =>
                    `<li style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#6a635c;">${escapeHtml(redactSecretsAndPii(g))}</li>`,
                )
                .join("")}</ul></td></tr>`
            : "",
          execNotes.length
            ? `<tr><td style="padding:0 32px 24px;"><p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Degraded areas</p><p style="margin:0;font-size:13px;line-height:1.6;color:#6a635c;">${escapeHtml(execNotes.join(" · "))}</p></td></tr>`
            : "",
        ].join("");

  const decisionsHtml =
    decisions.length > 0
      ? `<tr><td style="padding:0 32px 24px;"><p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Decisions / approvals needed</p><ul style="margin:0;padding:0 0 0 18px;">${decisions
          .map(
            (d) =>
              `<li style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#4a443e;">${escapeHtml(redactSecretsAndPii(d))}</li>`,
          )
          .join("")}</ul></td></tr>`
      : "";

  const blockersHtml =
    blockers.length > 0
      ? `<tr><td style="padding:0 32px 24px;"><p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Risks / blockers</p><ul style="margin:0;padding:0 0 0 18px;">${blockers
          .map(
            (b) =>
              `<li style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#4a443e;">${escapeHtml(redactSecretsAndPii(b))}</li>`,
          )
          .join("")}</ul></td></tr>`
      : "";

  const watchHtml =
    watch
      ? `<tr><td style="padding:0 32px 24px;"><p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Opportunity to watch</p><p style="margin:0;font-size:14px;line-height:1.7;color:#3d3832;">${escapeHtml(redactSecretsAndPii(watch))}</p></td></tr>`
      : "";

  const metaLine =
    intent === "daily"
      ? ``
      : `<p style="margin:6px 0 0;font-size:12px;color:#6a635c;">Cadence ${escapeHtml(cadenceId)} · window ${escapeHtml(cadenceWindow)}${degraded ? ` · ${escapeHtml(run.runStatus)}` : ""}</p>`;

  const highestLabel =
    intent === "daily" ? "Highest-ROI move" : "Highest-ROI action";
  const prioritiesLabel =
    intent === "daily" ? "Top priorities" : "Priorities (max 5)";

  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px 20px;background:#efe8de;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#f7f3ee;border:1px solid #e4dbcf;">
      <tr>
        <td style="padding:36px 32px 8px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8176;">Hourglass Diamonds · Internal · Agent OS</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1816;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(heading)}</h1>
          <p style="margin:10px 0 0;font-size:12px;color:#6a635c;">${escapeHtml(periodLine)}</p>
          ${metaLine}
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 24px;">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">${intent === "daily" ? "Today’s call" : "Why it matters"}</p>
          <p style="margin:0;font-size:15px;line-height:1.75;color:#3d3832;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(redactSecretsAndPii(todayCall || ""))}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 24px;">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">${escapeHtml(highestLabel)}</p>
          <p style="margin:0;font-size:15px;line-height:1.75;color:#3d3832;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(redactSecretsAndPii(highestRoi))}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 24px;">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">${escapeHtml(prioritiesLabel)}</p>
          ${
            titles.length
              ? `<ul style="margin:0;padding:0 0 0 18px;">${priorityLis}</ul>`
              : `<p style="margin:0;font-size:14px;color:#6a635c;">No named priorities this cycle.</p>`
          }
        </td>
      </tr>
      ${decisionsHtml}
      ${blockersHtml}
      ${watchHtml}
      ${
        intent === "weekly"
          ? `<tr><td style="padding:0 32px 24px;"><p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Why it matters</p><p style="margin:0;font-size:14px;line-height:1.7;color:#3d3832;">${escapeHtml(redactSecretsAndPii(run.brief.whyItMatters || ""))}</p></td></tr>`
          : ""
      }
      ${confidenceHtml}
      <tr>
        <td style="padding:8px 32px 36px;font-size:11px;color:#9a9084;">
          Internal run ${escapeHtml(run.runId)} · Agent OS ${escapeHtml(run.agentOsVersion)}. Not for external distribution.
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textParts: string[] = [
    intent === "daily"
      ? `Hourglass Morning Brief · ${dailyLabel}`
      : `Hourglass Agent OS — Founder Brief`,
    intent === "daily" ? `Date: ${dailyLabel}` : `Period: ${weeklyPeriod}`,
  ];
  if (intent === "weekly") {
    textParts.push(`Cadence: ${cadenceId} (${cadenceWindow})`);
    if (degraded) textParts.push(`Status: ${run.runStatus} (degraded)`);
  }
  textParts.push(
    ``,
    intent === "daily" ? `Today’s call: ${redactSecretsAndPii(todayCall || "")}` : `Why it matters: ${redactSecretsAndPii(run.brief.whyItMatters || "")}`,
    ``,
    `Highest-ROI: ${redactSecretsAndPii(highestRoi)}`,
    ``,
    `Priorities:`,
    ...titles.map((t, i) => `${i + 1}. ${redactSecretsAndPii(t)}`),
  );
  if (decisions.length) {
    textParts.push(``, `Decisions:`, ...decisions.map((d) => `- ${redactSecretsAndPii(d)}`));
  }
  if (blockers.length) {
    textParts.push(``, `Blockers:`, ...blockers.map((b) => `- ${redactSecretsAndPii(b)}`));
  }
  if (watch) {
    textParts.push(``, `Watch: ${redactSecretsAndPii(watch)}`);
  }
  if (intent === "daily") {
    textParts.push(
      ``,
      `Data confidence: ${confidence.level} — ${redactSecretsAndPii(confidence.summary)}`,
    );
    if (confidence.showDetails) {
      for (const l of confidence.detailLines) {
        textParts.push(`- ${redactSecretsAndPii(l)}`);
      }
    }
  } else {
    if (run.brief.missingOrUnreliableData.length) {
      textParts.push(
        ``,
        `Source gaps:`,
        ...run.brief.missingOrUnreliableData
          .slice(0, 6)
          .map((g) => `- ${redactSecretsAndPii(g)}`),
      );
    }
    if (execNotes.length) {
      textParts.push(``, `Degraded areas:`, ...execNotes.map((n) => `- ${n}`));
    }
  }
  textParts.push(``, `Run: ${run.runId}`);

  return { subject, html, text: textParts.join("\n") };
}

export function renderFailureAlertEmail(input: {
  cadenceId: string;
  cadenceWindow: string;
  runId: string | null;
  runStatus: string;
  reason: string;
}): RenderedAgentOsEmail {
  const subject = `Hourglass Agent OS · Failure alert · ${input.cadenceWindow}`;
  const safeReason = redactSecretsAndPii(input.reason)
    .replace(/\bat\s+[\w.<>$]+\s*\([^)]*\)/g, "[frame]")
    .replace(/\bsk_live_[A-Za-z0-9]+/gi, "[REDACTED_KEY]")
    .slice(0, 500);
  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px 20px;background:#efe8de;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#f7f3ee;border:1px solid #e4dbcf;">
      <tr>
        <td style="padding:36px 32px 28px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8176;">Hourglass Diamonds · Internal · Agent OS</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1816;font-family:Georgia,'Times New Roman',serif;">Failure alert</h1>
          <p style="margin:12px 0 0;font-size:14px;line-height:1.7;color:#3d3832;">This is <strong>not</strong> a successful founder brief.</p>
          <p style="margin:16px 0 0;font-size:13px;color:#6a635c;">Cadence ${escapeHtml(input.cadenceId)} · window ${escapeHtml(input.cadenceWindow)} · status ${escapeHtml(input.runStatus)}</p>
          <p style="margin:16px 0 0;font-size:14px;line-height:1.7;color:#3d3832;">${escapeHtml(safeReason)}</p>
          <p style="margin:24px 0 0;font-size:11px;color:#9a9084;">Run ${escapeHtml(input.runId ?? "n/a")}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  const text = [
    `Hourglass Agent OS — Failure alert (NOT a founder brief)`,
    `Cadence: ${input.cadenceId} (${input.cadenceWindow})`,
    `Status: ${input.runStatus}`,
    `Reason: ${safeReason}`,
    `Run: ${input.runId ?? "n/a"}`,
  ].join("\n");
  return { subject, html, text };
}
