/**
 * Render Chief of Staff founder brief email (HTML + text).
 * Daily: concise morning operating brief.
 * Weekly: polished weekly brief — no engineering diagnostics.
 */

import type { AgentRun } from "../types";
import { redactSecretsAndPii } from "../redaction";
import {
  buildDataConfidenceNote,
  cleanFounderFacingAction,
  dailyTodayCall,
  dedupePrioritiesAgainstHighestRoi,
  filterFounderFacingBlockers,
  filterGenuineFounderDecisions,
  formatFounderLocalDateLabel,
  formatWeeklyFounderRangeLabel,
  formatWeeklyRangeLabel,
  isVagueMetricWithoutMagnitude,
  localDateFromCadenceWindow,
  resolveBriefCadenceIntent,
  sanitizeFounderFacingNarrative,
  summarizeFounderAction,
  toFounderFacingPriorityAction,
  weeklyExecutiveSummary,
  weeklyRangeFromCadenceWindow,
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
  return filterFounderFacingBlockers(
    blocked.filter(
      (b) =>
        b &&
        !/^none$/i.test(b.trim()) &&
        !/not yet operational/i.test(b),
    ),
  );
}

function materialDecisions(
  decisions: string[],
  intent: "daily" | "weekly",
): string[] {
  const base = decisions.filter(
    (d) =>
      d &&
      !/^none required/i.test(d.trim()) &&
      !/^none$/i.test(d.trim()),
  );
  if (intent === "weekly") {
    const genuine = filterGenuineFounderDecisions(base);
    return genuine;
  }
  return base.filter((d) => !/highest-roi action above/i.test(d));
}

function opportunityToWatch(run: AgentRun): string | null {
  const structured = run.brief.opportunityToWatch?.trim();
  if (structured && !isVagueMetricWithoutMagnitude(structured)) {
    return structured;
  }
  const wait = run.brief.canSafelyWait.find(
    (w) =>
      w &&
      !/^none$/i.test(w.trim()) &&
      !/deferred/i.test(w) &&
      !/full set in JSON/i.test(w) &&
      !isVagueMetricWithoutMagnitude(w) &&
      w.length < 280,
  );
  if (wait) return wait;
  const watch = run.brief.needsAttentionToday.find(
    (t) =>
      t &&
      !/^see highest/i.test(t) &&
      !/^none$/i.test(t) &&
      !run.brief.surfacedPriorityTitles.includes(t) &&
      !isVagueMetricWithoutMagnitude(t),
  );
  return watch ?? null;
}

function sectionHeading(label: string): string {
  return `<p style="margin:0 0 10px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">${escapeHtml(label)}</p>`;
}

export function renderFounderBriefEmail(input: {
  run: AgentRun;
  cadenceId: string;
  cadenceWindow: string;
  degraded: boolean;
  allClear?: boolean;
}): RenderedAgentOsEmail {
  const { run, cadenceId, cadenceWindow, degraded } = input;
  const intent = resolveBriefCadenceIntent(cadenceId);

  if (intent === "weekly") {
    if (input.allClear) {
      return renderWeeklyAllClearEmail({ run, cadenceWindow, degraded });
    }
    return renderWeeklyFounderBriefEmail({ run, cadenceWindow, degraded });
  }
  if (input.allClear) {
    return renderDailyAllClearEmail({ run, cadenceWindow, degraded });
  }
  return renderDailyMorningBriefEmail({ run, cadenceWindow, degraded });
}

function renderDailyAllClearEmail(input: {
  run: AgentRun;
  cadenceWindow: string;
  degraded: boolean;
}): RenderedAgentOsEmail {
  const { run, cadenceWindow, degraded } = input;
  const localDate = localDateFromCadenceWindow(
    cadenceWindow,
    run.generatedAt,
  );
  const dailyLabel = formatFounderLocalDateLabel(localDate);
  const subject = degraded
    ? `Hourglass Morning Brief · Partial data · ${dailyLabel}`
    : `Hourglass Morning Brief · ${dailyLabel}`;
  const call = "No material founder priorities require action today.";
  const watchNoAction = (run.brief.watchNoActionItems ?? []).filter(
    (line) => line && !/^none$/i.test(line.trim()),
  );
  const watch = opportunityToWatch(run);
  const confidence = buildDataConfidenceNote({
    missingOrUnreliableData: run.brief.missingOrUnreliableData,
    executiveNotes: [],
    briefEvidenceQuality: run.briefEvidenceQuality,
    criticalFailure: false,
    intent: "daily",
  });

  const watchHtml =
    watchNoAction.length > 0
      ? `<tr><td style="padding:0 32px 24px;">${sectionHeading("Watch")}<ul style="margin:0;padding:0 0 0 18px;">${watchNoAction
          .map(
            (line) =>
              `<li style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#4a443e;">${escapeHtml(redactSecretsAndPii(line))}</li>`,
          )
          .join("")}</ul></td></tr>`
      : watch
        ? `<tr><td style="padding:0 32px 24px;">${sectionHeading("Watch")}<p style="margin:0;font-size:14px;line-height:1.7;color:#3d3832;">${escapeHtml(redactSecretsAndPii(watch))}</p></td></tr>`
        : "";

  const confidenceHtml = confidence.renderInFounderEmail
    ? `<tr><td style="padding:0 32px 20px;">${sectionHeading("Systems")}<p style="margin:0;font-size:13px;line-height:1.6;color:#6a635c;">${escapeHtml(redactSecretsAndPii(confidence.summary))}</p></td></tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px 12px;background:#efe8de;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;margin:0 auto;background:#f7f3ee;border:1px solid #e4dbcf;">
      <tr>
        <td style="padding:28px 24px 8px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8176;">Hourglass Diamonds · Internal</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1816;font-family:Georgia,'Times New Roman',serif;">Morning Brief</h1>
          <p style="margin:10px 0 0;font-size:12px;color:#6a635c;">${escapeHtml(dailyLabel)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          <p style="margin:0;font-size:15px;line-height:1.75;color:#3d3832;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(call)}</p>
        </td>
      </tr>
      ${watchHtml}
      ${confidenceHtml}
    </table>
  </body>
</html>`;

  const textParts = [
    `Hourglass Morning Brief · ${dailyLabel}`,
    ``,
    call,
  ];
  if (watchNoAction.length) {
    textParts.push(``, `Watch:`, ...watchNoAction.map((l) => `- ${redactSecretsAndPii(l)}`));
  } else if (watch) {
    textParts.push(``, `Watch: ${redactSecretsAndPii(watch)}`);
  }
  if (confidence.renderInFounderEmail) {
    textParts.push(``, `Systems: ${redactSecretsAndPii(confidence.summary)}`);
  }

  return { subject, html, text: textParts.join("\n") };
}

function renderWeeklyAllClearEmail(input: {
  run: AgentRun;
  cadenceWindow: string;
  degraded: boolean;
}): RenderedAgentOsEmail {
  const { run, cadenceWindow, degraded } = input;
  const range = weeklyRangeFromCadenceWindow(cadenceWindow, run.reportingPeriod);
  const founderRange = formatWeeklyFounderRangeLabel(range.start, range.end);
  const subject = degraded
    ? `Hourglass Weekly Brief · Partial data · ${founderRange}`
    : `Hourglass Weekly Brief · ${founderRange}`;
  const summary =
    "No major strategic change this week. No material founder priorities require action.";
  const confidence = buildDataConfidenceNote({
    missingOrUnreliableData: run.brief.missingOrUnreliableData,
    executiveNotes: [],
    briefEvidenceQuality: run.briefEvidenceQuality,
    criticalFailure: false,
    intent: "weekly",
  });
  const confidenceHtml = confidence.renderInFounderEmail
    ? `<tr><td style="padding:0 32px 28px;">${sectionHeading("Systems")}<p style="margin:0;font-size:13px;line-height:1.6;color:#6a635c;">${escapeHtml(redactSecretsAndPii(confidence.summary))}</p></td></tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px 20px;background:#efe8de;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#f7f3ee;border:1px solid #e4dbcf;">
      <tr>
        <td style="padding:36px 32px 8px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8176;">Hourglass Diamonds · Internal</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1816;font-family:Georgia,'Times New Roman',serif;">Weekly Brief</h1>
          <p style="margin:10px 0 0;font-size:12px;color:#6a635c;">${escapeHtml(founderRange)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 24px;">
          <p style="margin:0;font-size:15px;line-height:1.75;color:#3d3832;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(summary)}</p>
        </td>
      </tr>
      ${confidenceHtml}
    </table>
  </body>
</html>`;

  const textParts = [
    `Hourglass Weekly Brief · ${founderRange}`,
    ``,
    summary,
  ];
  if (confidence.renderInFounderEmail) {
    textParts.push(``, `Systems: ${redactSecretsAndPii(confidence.summary)}`);
  }
  return { subject, html, text: textParts.join("\n") };
}

function renderDailyMorningBriefEmail(input: {
  run: AgentRun;
  cadenceWindow: string;
  degraded: boolean;
}): RenderedAgentOsEmail {
  const { run, cadenceWindow, degraded } = input;
  const localDate = localDateFromCadenceWindow(
    cadenceWindow,
    run.generatedAt,
  );
  const dailyLabel = formatFounderLocalDateLabel(localDate);
  const highestRoi = summarizeFounderAction(
    cleanFounderFacingAction(run.brief.highestRoiAction || ""),
    280,
  );
  const todayCall = dailyTodayCall({
    whyItMatters: run.brief.whyItMatters,
    highestRoiAction: highestRoi,
    sprintOrientation: run.brief.sprintOrientation,
    dayOrientation: run.brief.dayOrientation,
    whatChanged: run.brief.whatChanged,
  });
  const titles = dedupePrioritiesAgainstHighestRoi(
    run.brief.surfacedPriorityTitles,
    highestRoi,
    3,
    { rewriteForFounder: false },
  );
  // Daily named slots are founder-now only. Do not backfill from anomalies,
  // needsAttention, or sprint leftover copy merely to fill the list.
  const priorities = titles.slice(0, 3);
  const decisions = materialDecisions(run.brief.founderDecisionNeeded, "daily");
  const blockers = materialBlockers(run.brief.blocked);
  const watch = opportunityToWatch(run);
  const confidence = buildDataConfidenceNote({
    missingOrUnreliableData: run.brief.missingOrUnreliableData,
    executiveNotes: [],
    briefEvidenceQuality: run.briefEvidenceQuality,
    criticalFailure:
      run.briefEvidenceQuality === "failed" ||
      run.briefEvidenceQuality === "none-blocked" ||
      run.runStatus === "failed",
    intent: "daily",
  });

  const subject = degraded
    ? `Hourglass Morning Brief · Partial data · ${dailyLabel}`
    : `Hourglass Morning Brief · ${dailyLabel}`;

  const priorityLis = priorities
    .map(
      (t, i) =>
        `<li style="margin:0 0 10px;font-size:14px;line-height:1.65;color:#4a443e;"><strong>${i + 1}.</strong> ${escapeHtml(redactSecretsAndPii(t))}</li>`,
    )
    .join("");

  const decisionsHtml =
    decisions.length > 0
      ? `<tr><td style="padding:0 32px 24px;">${sectionHeading("Decisions / approvals needed")}<ul style="margin:0;padding:0 0 0 18px;">${decisions
          .map(
            (d) =>
              `<li style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#4a443e;">${escapeHtml(redactSecretsAndPii(d))}</li>`,
          )
          .join("")}</ul></td></tr>`
      : "";

  const blockersHtml =
    blockers.length > 0
      ? `<tr><td style="padding:0 32px 24px;">${sectionHeading("Risks / blockers")}<ul style="margin:0;padding:0 0 0 18px;">${blockers
          .map(
            (b) =>
              `<li style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#4a443e;">${escapeHtml(redactSecretsAndPii(b))}</li>`,
          )
          .join("")}</ul></td></tr>`
      : "";

  const watchNoAction = (run.brief.watchNoActionItems ?? []).filter(
    (line) => line && !/^none$/i.test(line.trim()),
  );
  const watchNoActionHtml =
    watchNoAction.length > 0
      ? `<tr><td style="padding:0 32px 24px;">${sectionHeading("Watch / no action")}<ul style="margin:0;padding:0 0 0 18px;">${watchNoAction
          .map(
            (line) =>
              `<li style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#4a443e;">${escapeHtml(redactSecretsAndPii(line))}</li>`,
          )
          .join("")}</ul></td></tr>`
      : "";

  const watchHtml = watch
    ? `<tr><td style="padding:0 32px 24px;">${sectionHeading("Opportunity to watch")}<p style="margin:0;font-size:14px;line-height:1.7;color:#3d3832;">${escapeHtml(redactSecretsAndPii(watch))}</p></td></tr>`
    : "";

  const clientItems = run.brief.clientAttentionItems ?? [];
  const clientAttentionHtml =
    clientItems.length > 0
      ? `<tr><td style="padding:0 24px 24px;">${sectionHeading("Client Attention")}<ol style="margin:0;padding:0 0 0 18px;">${clientItems
          .slice(0, 2)
          .map(
            (item) =>
              `<li style="margin:0 0 10px;font-size:14px;line-height:1.65;color:#4a443e;"><strong>${escapeHtml(redactSecretsAndPii(item.title))}</strong> — ${escapeHtml(redactSecretsAndPii(item.summary))} ${escapeHtml(redactSecretsAndPii(item.action))}</li>`,
          )
          .join("")}</ol></td></tr>`
      : "";

  const confidenceHtml = confidence.renderInFounderEmail
    ? `<tr><td style="padding:0 32px 20px;">${sectionHeading("Data confidence")}<p style="margin:0;font-size:13px;line-height:1.6;color:#6a635c;"><strong>${escapeHtml(confidence.level)}</strong> — ${escapeHtml(redactSecretsAndPii(confidence.summary))}</p>${
        confidence.showDetails && confidence.detailLines.length
          ? `<ul style="margin:10px 0 0;padding:0 0 0 18px;">${confidence.detailLines
              .map(
                (l) =>
                  `<li style="margin:0 0 6px;font-size:12px;line-height:1.5;color:#6a635c;">${escapeHtml(redactSecretsAndPii(l))}</li>`,
              )
              .join("")}</ul>`
          : ""
      }</td></tr>`
    : "";

  const prioritiesHtml = priorities.length
    ? `<ul style="margin:0;padding:0 0 0 18px;">${priorityLis}</ul>`
    : highestRoi && !/^no durable/i.test(highestRoi)
      ? `<p style="margin:0;font-size:14px;line-height:1.65;color:#4a443e;">1. ${escapeHtml(redactSecretsAndPii(summarizeFounderAction(highestRoi.split(".")[0] ?? highestRoi, 160)))}</p>`
      : `<p style="margin:0;font-size:14px;color:#6a635c;">Carry-forward priorities unavailable — brief should not have been sent.</p>`;

  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px 12px;background:#efe8de;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;margin:0 auto;background:#f7f3ee;border:1px solid #e4dbcf;">
      <tr>
        <td style="padding:28px 24px 8px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8176;">Hourglass Diamonds · Internal</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1816;font-family:Georgia,'Times New Roman',serif;">Morning Brief</h1>
          <p style="margin:10px 0 0;font-size:12px;color:#6a635c;">${escapeHtml(dailyLabel)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          ${sectionHeading("Today’s call")}
          <p style="margin:0;font-size:15px;line-height:1.75;color:#3d3832;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(redactSecretsAndPii(todayCall || ""))}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          ${sectionHeading("Highest-ROI move")}
          <p style="margin:0;font-size:15px;line-height:1.75;color:#3d3832;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(redactSecretsAndPii(highestRoi))}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 24px 24px;">
          ${sectionHeading("Top priorities")}
          ${prioritiesHtml}
        </td>
      </tr>
      ${clientAttentionHtml}
      ${decisionsHtml}
      ${blockersHtml}
      ${watchNoActionHtml}
      ${watchHtml}
      ${confidenceHtml}
    </table>
  </body>
</html>`;

  const textParts: string[] = [
    `Hourglass Morning Brief · ${dailyLabel}`,
    `Date: ${dailyLabel}`,
    ``,
    `Today’s call: ${redactSecretsAndPii(todayCall || "")}`,
    ``,
    `Highest-ROI: ${redactSecretsAndPii(highestRoi)}`,
    ``,
    `Priorities:`,
    ...(priorities.length
      ? priorities.map((t, i) => `${i + 1}. ${redactSecretsAndPii(t)}`)
      : [`1. ${redactSecretsAndPii(summarizeFounderAction(highestRoi.split(".")[0] ?? highestRoi, 160))}`]),
  ];
  if (clientItems.length) {
    textParts.push(
      ``,
      `Client Attention:`,
      ...clientItems
        .slice(0, 2)
        .map(
          (item, i) =>
            `${i + 1}. ${redactSecretsAndPii(item.title)} — ${redactSecretsAndPii(item.summary)} ${redactSecretsAndPii(item.action)}`,
        ),
    );
  }
  if (decisions.length) {
    textParts.push(``, `Decisions:`, ...decisions.map((d) => `- ${redactSecretsAndPii(d)}`));
  }
  if (blockers.length) {
    textParts.push(``, `Blockers:`, ...blockers.map((b) => `- ${redactSecretsAndPii(b)}`));
  }
  if (watchNoAction.length) {
    textParts.push(
      ``,
      `Watch / no action:`,
      ...watchNoAction.map((line) => `- ${redactSecretsAndPii(line)}`),
    );
  }
  if (watch) {
    textParts.push(``, `Watch: ${redactSecretsAndPii(watch)}`);
  }
  if (confidence.renderInFounderEmail) {
    textParts.push(
      ``,
      `Data confidence: ${confidence.level} — ${redactSecretsAndPii(confidence.summary)}`,
    );
  }

  return { subject, html, text: textParts.join("\n") };
}

function renderWeeklyFounderBriefEmail(input: {
  run: AgentRun;
  cadenceWindow: string;
  degraded: boolean;
}): RenderedAgentOsEmail {
  const { run, cadenceWindow, degraded } = input;
  const range = weeklyRangeFromCadenceWindow(cadenceWindow, run.reportingPeriod);
  const founderRange = formatWeeklyFounderRangeLabel(range.start, range.end);
  const isoRange = formatWeeklyRangeLabel(range.start, range.end);

  const highestRoi = summarizeFounderAction(
    cleanFounderFacingAction(run.brief.highestRoiAction || ""),
    320,
  );
  const rawWhatChanged = run.brief.whatChanged?.trim() ?? "";
  const whatChangedUsable =
    rawWhatChanged &&
    !/reconstructed|persisted|delivery ledger|fixture|week:\d{4}-w\d{2}/i.test(
      rawWhatChanged,
    )
      ? summarizeFounderAction(
          sanitizeFounderFacingNarrative(rawWhatChanged),
          320,
        )
      : null;
  const executiveSummary = weeklyExecutiveSummary({
    whyItMatters: sanitizeFounderFacingNarrative(run.brief.whyItMatters),
    whatChanged: whatChangedUsable ?? "",
    highestRoiAction: highestRoi,
    weakEvidence:
      run.briefEvidenceQuality === "partial-degraded" ||
      run.briefEvidenceQuality === "none-blocked" ||
      run.brief.missingOrUnreliableData.some((g) =>
        /ga4|gsc|failed|unavailable/i.test(g),
      ),
  });
  const whatChanged = whatChangedUsable;

  const titles = dedupePrioritiesAgainstHighestRoi(
    run.brief.surfacedPriorityTitles.map((t) =>
      toFounderFacingPriorityAction(t),
    ),
    highestRoi,
    5,
  );
  const decisions = materialDecisions(run.brief.founderDecisionNeeded, "weekly");
  const blockers = materialBlockers(run.brief.blocked);

  const confidence = buildDataConfidenceNote({
    missingOrUnreliableData: run.brief.missingOrUnreliableData,
    executiveNotes: [],
    briefEvidenceQuality: run.briefEvidenceQuality,
    criticalFailure:
      run.briefEvidenceQuality === "failed" ||
      run.briefEvidenceQuality === "none-blocked" ||
      run.runStatus === "failed",
    intent: "weekly",
  });

  const subject = degraded
    ? `Hourglass Weekly Brief · Partial data · ${founderRange}`
    : `Hourglass Weekly Brief · ${founderRange}`;

  const priorityLis = titles
    .map(
      (t, i) =>
        `<li style="margin:0 0 10px;font-size:14px;line-height:1.65;color:#4a443e;"><strong>${i + 1}.</strong> ${escapeHtml(redactSecretsAndPii(t))}</li>`,
    )
    .join("");

  const decisionsHtml =
    decisions.length > 0
      ? `<tr><td style="padding:0 32px 24px;">${sectionHeading("Decisions / approvals needed")}<ul style="margin:0;padding:0 0 0 18px;">${decisions
          .map(
            (d) =>
              `<li style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#4a443e;">${escapeHtml(redactSecretsAndPii(d))}</li>`,
          )
          .join("")}</ul></td></tr>`
      : `<tr><td style="padding:0 32px 24px;">${sectionHeading("Decisions / approvals needed")}<p style="margin:0;font-size:14px;line-height:1.65;color:#4a443e;">No founder approvals required this week.</p></td></tr>`;

  const blockersHtml =
    blockers.length > 0
      ? `<tr><td style="padding:0 32px 24px;">${sectionHeading("Risks / blockers")}<ul style="margin:0;padding:0 0 0 18px;">${blockers
          .map(
            (b) =>
              `<li style="margin:0 0 8px;font-size:14px;line-height:1.65;color:#4a443e;">${escapeHtml(redactSecretsAndPii(b))}</li>`,
          )
          .join("")}</ul></td></tr>`
      : "";

  const confidenceHtml = `<tr><td style="padding:0 32px 28px;">${sectionHeading("Data confidence")}<p style="margin:0;font-size:13px;line-height:1.6;color:#6a635c;"><strong>${escapeHtml(confidence.level)}</strong> — ${escapeHtml(redactSecretsAndPii(confidence.summary))}</p></td></tr>`;

  const whatChangedHtml = whatChanged
    ? `<tr>
        <td style="padding:0 32px 24px;">
          ${sectionHeading("What changed this week")}
          <p style="margin:0;font-size:14px;line-height:1.7;color:#3d3832;">${escapeHtml(redactSecretsAndPii(whatChanged))}</p>
        </td>
      </tr>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:32px 20px;background:#efe8de;">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#f7f3ee;border:1px solid #e4dbcf;">
      <tr>
        <td style="padding:36px 32px 8px;">
          <p style="margin:0 0 6px;font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#8a8176;">Hourglass Diamonds · Internal · Agent OS</p>
          <h1 style="margin:0;font-size:22px;font-weight:400;color:#1a1816;font-family:Georgia,'Times New Roman',serif;">Weekly Brief</h1>
          <p style="margin:10px 0 0;font-size:12px;color:#6a635c;">${escapeHtml(founderRange)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 24px;">
          ${sectionHeading("Executive summary")}
          <p style="margin:0;font-size:15px;line-height:1.75;color:#3d3832;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(redactSecretsAndPii(executiveSummary))}</p>
        </td>
      </tr>
      ${whatChangedHtml}
      <tr>
        <td style="padding:0 32px 24px;">
          ${sectionHeading("Highest-ROI action")}
          <p style="margin:0;font-size:15px;line-height:1.75;color:#3d3832;font-family:Georgia,'Times New Roman',serif;">${escapeHtml(redactSecretsAndPii(highestRoi))}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:0 32px 24px;">
          ${sectionHeading("Priorities for the coming week")}
          ${
            titles.length
              ? `<ul style="margin:0;padding:0 0 0 18px;">${priorityLis}</ul>`
              : `<p style="margin:0;font-size:14px;color:#6a635c;">No additional priorities beyond the highest-ROI action.</p>`
          }
        </td>
      </tr>
      ${decisionsHtml}
      ${blockersHtml}
      ${confidenceHtml}
    </table>
  </body>
</html>`;

  const textParts: string[] = [
    `Hourglass Weekly Brief · ${founderRange}`,
    `Period: ${isoRange}`,
    ``,
    `Executive summary: ${redactSecretsAndPii(executiveSummary)}`,
  ];
  if (whatChanged) {
    textParts.push(
      ``,
      `What changed this week: ${redactSecretsAndPii(whatChanged)}`,
    );
  }
  textParts.push(
    ``,
    `Highest-ROI action: ${redactSecretsAndPii(highestRoi)}`,
    ``,
    `Priorities for the coming week:`,
    ...(titles.length
      ? titles.map((t, i) => `${i + 1}. ${redactSecretsAndPii(t)}`)
      : ["(none beyond the highest-ROI action)"]),
    ``,
    `Decisions / approvals needed:`,
    ...(decisions.length
      ? decisions.map((d) => `- ${redactSecretsAndPii(d)}`)
      : ["- No founder approvals required this week."]),
  );
  if (blockers.length) {
    textParts.push(
      ``,
      `Risks / blockers:`,
      ...blockers.map((b) => `- ${redactSecretsAndPii(b)}`),
    );
  }
  textParts.push(
    ``,
    `Data confidence: ${confidence.level} — ${redactSecretsAndPii(confidence.summary)}`,
  );

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
