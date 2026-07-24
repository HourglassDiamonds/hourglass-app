/**
 * Render Chief of Staff founder brief email (HTML + text).
 * Readable, capped priorities, honest degradation — no secrets or raw internals.
 */

import type { AgentRun } from "../types";
import { redactSecretsAndPii } from "../redaction";

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

export function renderFounderBriefEmail(input: {
  run: AgentRun;
  cadenceId: string;
  cadenceWindow: string;
  degraded: boolean;
}): RenderedAgentOsEmail {
  const { run, cadenceId, cadenceWindow, degraded } = input;
  const titles = run.brief.surfacedPriorityTitles.slice(0, 5);
  const period = `${run.reportingPeriod.start} — ${run.reportingPeriod.end}`;
  const statusLabel = degraded
    ? `${run.runStatus} (degraded / partial evidence)`
    : run.runStatus;

  const subject = degraded
    ? `Hourglass Agent OS · Degraded founder brief · ${cadenceWindow}`
    : `Hourglass Agent OS · Founder brief · ${cadenceWindow}`;

  const priorityLis = titles
    .map(
      (t, i) =>
        `<li style="margin:0 0 10px;font-size:14px;line-height:1.65;color:#4a443e;"><strong>${i + 1}.</strong> ${escapeHtml(redactSecretsAndPii(t))}</li>`,
    )
    .join("");

  const gaps = run.brief.missingOrUnreliableData.slice(0, 6);
  const gapLis = gaps
    .map(
      (g) =>
        `<li style="margin:0 0 8px;font-size:13px;line-height:1.55;color:#6a635c;">${escapeHtml(redactSecretsAndPii(g))}</li>`,
    )
    .join("");

  const execNotes = run.executiveStatuses
    .filter((e) => e.status !== "completed")
    .map(
      (e) =>
        `${e.executiveId}: ${e.status}${e.note ? ` — ${redactSecretsAndPii(e.note)}` : ""}`,
    )
    .slice(0, 6);

  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px 20px;background:#efe8de;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#f7f3ee;border:1px solid #e4dbcf;">
      <tr>
        <td style="padding:36px 32px 8px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8176;">Hourglass Diamonds · Internal · Agent OS</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1816;font-family:Georgia,'Times New Roman',serif;">Founder Brief</h1>
          <p style="margin:10px 0 0;font-size:12px;color:#6a635c;">${escapeHtml(period)}</p>
          <p style="margin:6px 0 0;font-size:12px;color:#6a635c;">Cadence ${escapeHtml(cadenceId)} · window ${escapeHtml(cadenceWindow)} · status ${escapeHtml(statusLabel)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 24px;">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Highest-ROI action</p>
          <p style="margin:0;font-size:15px;line-height:1.75;color:#3d3832;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(redactSecretsAndPii(run.brief.highestRoiAction || "None this cycle"))}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 24px;">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Priorities (max 5)</p>
          ${
            titles.length
              ? `<ul style="margin:0;padding:0 0 0 18px;">${priorityLis}</ul>`
              : `<p style="margin:0;font-size:14px;color:#6a635c;">No named priorities this cycle.</p>`
          }
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 24px;">
          <p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Why it matters</p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#3d3832;">${escapeHtml(redactSecretsAndPii(run.brief.whyItMatters || ""))}</p>
        </td>
      </tr>
      ${
        gaps.length
          ? `<tr><td style="padding:0 32px 24px;"><p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Source gaps (not deterioration)</p><ul style="margin:0;padding:0 0 0 18px;">${gapLis}</ul></td></tr>`
          : ""
      }
      ${
        execNotes.length
          ? `<tr><td style="padding:0 32px 24px;"><p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">Degraded areas</p><p style="margin:0;font-size:13px;line-height:1.6;color:#6a635c;">${escapeHtml(execNotes.join(" · "))}</p></td></tr>`
          : ""
      }
      <tr>
        <td style="padding:8px 32px 36px;font-size:11px;color:#9a9084;">
          Internal run ${escapeHtml(run.runId)} · Agent OS ${escapeHtml(run.agentOsVersion)}. Not for external distribution.
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Hourglass Agent OS — Founder Brief`,
    `Period: ${period}`,
    `Cadence: ${cadenceId} (${cadenceWindow})`,
    `Status: ${statusLabel}`,
    ``,
    `Highest-ROI: ${redactSecretsAndPii(run.brief.highestRoiAction || "None")}`,
    ``,
    `Priorities:`,
    ...titles.map((t, i) => `${i + 1}. ${redactSecretsAndPii(t)}`),
    ``,
    `Why it matters: ${redactSecretsAndPii(run.brief.whyItMatters || "")}`,
    gaps.length
      ? `\nSource gaps (not deterioration):\n${gaps.map((g) => `- ${redactSecretsAndPii(g)}`).join("\n")}`
      : "",
    execNotes.length ? `\nDegraded areas:\n${execNotes.map((n) => `- ${n}`).join("\n")}` : "",
    ``,
    `Run: ${run.runId}`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return { subject, html, text };
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
