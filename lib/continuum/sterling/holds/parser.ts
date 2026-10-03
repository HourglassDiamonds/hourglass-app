import type { ProjectJob } from "@/lib/continuum/client-memory/project-jobs/types";
import type { SterlingTruth } from "../types";
import type { ConditionalHoldCondition, HoldScope } from "./types";

export type ConditionalHoldParseResult =
  | { kind: "proposal"; job: ProjectJob; condition: ConditionalHoldCondition; reason: string; proposedState: string }
  | { kind: "clarification"; message: string };

export function parseConditionalHold(query: string, truth: SterlingTruth, now: Date): ConditionalHoldParseResult {
  const text = query.trim();
  if (!/\b(?:hold(?: off)?|pause|snooze|wait (?:until|for)|keep .* off|leave .* alone|resume .* (?:when|after|once)|don'?t (?:show|surface|bug))\b/i.test(text)) {
    return { kind: "clarification", message: "Tell me which active job to hold and the observable condition that should end the hold." };
  }
  const job = resolveJob(text, truth);
  if (!job) return { kind: "clarification", message: "Which active job should I hold? Name the client, project, or action so I do not hide the wrong work." };
  const today = truth.today.find((row) => row.id === job.jobId || row.projectId === job.projectId) ?? null;
  const scope: HoldScope = { projectId: job.projectId, personLabel: today?.personName ?? null, threadId: threadFrom(job.sourceRef), cadId: cadFrom(text) };

  if (/\b(?:text|sms|message)\b/i.test(text)) {
    return { kind: "clarification", message: "I cannot observe your SMS/text activity. I can hold this until you manually confirm you contacted them, or until the next observable email to them." };
  }
  if (/\b(?:payment|paid|clears?|settles?)\b/i.test(text)) {
    return { kind: "clarification", message: "Payment clearing is not an observable Continuum event yet. I can use a specific time or require your manual confirmation instead." };
  }
  const resumeAt = parseResumeTime(text, now);
  if (resumeAt) return {
    kind: "proposal", job,
    condition: { kind: "until_time", resumeAt, timezone: "America/New_York" },
    reason: text, proposedState: `Held until ${resumeAt}; then ready for founder resume confirmation.`,
  };
  if (/\b(?:cad|render|drawing|source file)\b.*\b(?:arrives?|lands?|delivered|comes in)\b/i.test(text)) {
    if (!scope.projectId && !scope.threadId && !scope.cadId) return { kind: "clarification", message: "Which project, thread, or CAD identifier should the incoming file match?" };
    return { kind: "proposal", job, condition: { kind: "until_source_event", scope, semanticClass: "vendor_delivers_artifact", observableSources: ["gmail", "concierge_form"] }, reason: text, proposedState: "Held until a newer, exactly scoped CAD/source-file delivery is observed; then ready for founder resume confirmation." };
  }
  if (/\b(?:reply|replies|responds?|response|hear back)\b/i.test(text)) {
    if (!scope.projectId && !scope.threadId && !scope.personLabel) return { kind: "clarification", message: "Whose reply, and for which project or thread?" };
    return { kind: "proposal", job, condition: { kind: "until_external_reply", scope, observableSources: ["gmail", "concierge_form"] }, reason: text, proposedState: "Held until a newer, blocking external reply is observed; then ready for founder resume confirmation." };
  }
  if (/\b(?:i|we)\s+(?:email|contact|reach out|follow up)\b/i.test(text)) {
    if (!scope.projectId && !scope.threadId && !scope.personLabel) return { kind: "clarification", message: "Who should be contacted, and for which project?" };
    return { kind: "proposal", job, condition: { kind: "until_founder_contact", scope, observableSources: ["gmail", "founder_note"] }, reason: text, proposedState: "Held until a newer founder email/contact event is observed; then ready for founder resume confirmation." };
  }
  return { kind: "clarification", message: "What observable event should end the hold? I can watch a specific email reply, CAD delivery, founder email, or time." };
}

function resolveJob(query: string, truth: SterlingTruth): ProjectJob | null {
  const unresolved = truth.openJobs.filter((job) => job.state === "open" || job.state === "snoozed");
  const scored = unresolved.map((job) => {
    const today = truth.today.find((row) => row.id === job.jobId || (job.projectId && row.projectId === job.projectId));
    const labels = [job.jobId, job.subject, job.detail, today?.personName, today?.projectTitle].filter(Boolean).join(" ").toLowerCase();
    const tokens = labels.split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
    return { job, score: tokens.filter((token) => new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(query)).length };
  }).sort((a, b) => b.score - a.score);
  if (scored[0]?.score && scored[0].score > (scored[1]?.score ?? 0)) return scored[0].job;
  return unresolved.length === 1 && !/\b(?:this|that)\b/i.test(query) ? unresolved[0]! : null;
}

function parseResumeTime(text: string, now: Date): string | null {
  const local = localParts(now, "America/New_York");
  let addDays: number | null = null; let hour = 9;
  if (/\btomorrow\b/i.test(text)) addDays = 1;
  const weekday = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].findIndex((day) => new RegExp(`\\b${day}\\b`, "i").test(text));
  if (weekday >= 0) { const current = new Date(Date.UTC(local.year, local.month - 1, local.day)).getUTCDay(); addDays = (weekday - current + 7) % 7 || 7; }
  if (addDays == null) return null;
  if (/\bafternoon\b/i.test(text)) hour = 15;
  if (/\bevening\b/i.test(text)) hour = 18;
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day + addDays));
  return zonedIso(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, 0, "America/New_York");
}

function localParts(date: Date, zone: string) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date); const n = (type: string) => Number(parts.find((p) => p.type === type)?.value); return { year: n("year"), month: n("month"), day: n("day") }; }
function zonedIso(year: number, month: number, day: number, hour: number, minute: number, zone: string) { let guess = Date.UTC(year, month - 1, day, hour, minute); for (let i = 0; i < 3; i += 1) { const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour12: false, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(new Date(guess)); const n = (type: string) => Number(parts.find((p) => p.type === type)?.value); const represented = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute")); guess += Date.UTC(year, month - 1, day, hour, minute) - represented; } return new Date(guess).toISOString(); }
function threadFrom(sourceRef: string | null) { const match = sourceRef?.match(/(?:thread|gmail-thread)[:/]([^/?#]+)/i); return match?.[1] ?? null; }
function cadFrom(text: string) { return text.match(/\bCAD[-_ ]?([A-Z0-9-]{2,})\b/i)?.[1] ?? null; }
function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
