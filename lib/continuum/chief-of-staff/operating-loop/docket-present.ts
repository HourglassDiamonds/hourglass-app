/**
 * Founder-facing docket copy helpers. Presentation only.
 */

import { presentUnassignedHeadline } from "./email-viewer";
import type { CosDocketOrigin } from "./types";
import type { TodayRenderedBriefing } from "./briefing-copy";

export { presentUnassignedHeadline };

const UNASSIGNED_SUBJECT = "Unassigned";

function firstName(subject: string): string | null {
  const token = subject.trim().split(/\s+/)[0] ?? "";
  if (!token || token.toLowerCase() === "unassigned") return null;
  return token;
}

function finishImperative(text: string): string {
  const trimmed = text.replace(/\s*\/\s*/g, " and ").replace(/\.$/, "").trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function rewriteSpecBriefing(
  headline: string,
  context: string,
): { headline: string; context: string } | null {
  const labeled = context.match(
    /^([A-Za-z][A-Za-z ]+?) differs: approved (.+?) vs latest evidence (.+?)(?:\.|$)/i,
  );
  if (labeled) {
    const label = labeled[1]!.trim().toLowerCase();
    const approved = labeled[2]!.trim();
    const latest = labeled[3]!.trim();
    const action = /finger size/i.test(label)
      ? "Confirm the finger size before this moves forward."
      : `Confirm the ${label} before this moves forward.`;
    return {
      headline: action,
      context: `The project says ${approved}, but the latest evidence says ${latest}. I'd verify the current ${label} before production.`,
    };
  }
  const between = context.match(
    /(?:spec conflict:\s*)?([A-Za-z][A-Za-z ]+?) differs between approved (.+?) and latest evidence (.+?)(?:\.|$)/i,
  );
  if (between) {
    const label = between[1]!.trim().toLowerCase();
    const approved = between[2]!.trim();
    const latest = between[3]!.trim();
    const action = /finger size/i.test(label)
      ? "Confirm the finger size before this moves forward."
      : `Confirm the ${label} before this moves forward.`;
    return {
      headline: action,
      context: `The project says ${approved}, but the latest evidence says ${latest}. I'd verify the current ${label} before production.`,
    };
  }
  if (/still differ from the approved Project spec/i.test(context) || /Older (?:spec )?notes were superseded/i.test(context)) {
    return {
      headline: /confirm/i.test(headline)
        ? finishImperative(headline.replace(/\bthe current\b/i, "the").replace(/\.$/, "") + " before this moves forward")
        : "Confirm the spec before this moves forward.",
      context: "A few details still disagree with the project. I'd settle them before production continues.",
    };
  }
  return null;
}

function rewriteReplyBriefing(
  headline: string,
  context: string,
  subject: string,
  unassigned: boolean,
): { headline: string; context: string } | null {
  const reply =
    /latest meaningful turn is theirs/i.test(context) ||
    /answered a design question/i.test(context) ||
    /answered after your last question/i.test(context);
  if (!reply) return null;
  if (unassigned) {
    return {
      headline: finishImperative(headline),
      context: softenGeneratedPhrasing(context) || context,
    };
  }
  if (!/recap|your turn/i.test(headline)) {
    return {
      headline: finishImperative(headline),
      context: softenGeneratedPhrasing(context) || context,
    };
  }
  const who = firstName(subject);
  return {
    headline: "Send the recap and next step.",
    context: who
      ? `${who} replied to the latest design question. I'd send the recap now, while the conversation is still live.`
      : "They replied to the latest design question. I'd send the recap now, while the conversation is still live.",
  };
}

function softenGeneratedPhrasing(text: string): string {
  return text
    .replace(/\bThe latest meaningful turn is theirs\.?/gi, "")
    .replace(/\bOlder spec notes were superseded\.?/gi, "")
    .replace(/\bOlder notes were superseded\.?/gi, "")
    .replace(/\bit is not already on Top 5\.?/gi, "it isn't already on Today.")
    .replace(/\bDo it, or add it to Top 5\.?/gi, "Do this now.")
    .replace(/\bSend the recap \/ next step\.?/gi, "Send the recap and next step.")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim();
}

function presentJobContext(why: string): string {
  const overdue = /overdue/i.test(why);
  const yours = /YOUR TURN|founder action/i.test(why);
  if (overdue && yours) return "This is overdue and still waiting on you.";
  if (overdue) return "This is overdue. I'd take the next step today.";
  if (yours) return "This is still waiting on you.";
  if (/Recorded Open Job/i.test(why)) return "This is still open. I'd take the next step.";
  return softenGeneratedPhrasing(why.replace(/\s*·\s*/g, ", "));
}

export function docketSubject(
  person: string | null | undefined,
  project: string | null | undefined,
  organization?: string | null | undefined,
): string {
  const who = person?.trim() ?? "";
  const rawProject = project?.trim() ?? "";
  const what = !rawProject || /^project$/i.test(rawProject) ? "" : rawProject;
  const org = organization?.trim() ?? "";
  if (who && what) {
    if (who === what) return who;
    const hay = what.toLowerCase();
    if (hay.includes(who.toLowerCase())) return who;
    const tokens = who
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 4);
    if (tokens.some((token) => hay.includes(token))) return who;
    return `${who} / ${what}`;
  }
  if (org && what) {
    if (org === what) return org;
    const hay = what.toLowerCase();
    if (hay.includes(org.toLowerCase())) return org;
    return `${org} / ${what}`;
  }
  return who || what || org || "Unassigned";
}

export function isExecutiveBriefing(
  briefing: TodayRenderedBriefing | null | undefined,
  packet?: { briefingKind?: string } | null,
): briefing is TodayRenderedBriefing {
  if (!briefing) return false;
  if (packet?.briefingKind === "generic") return false;
  if (
    packet?.briefingKind === "founder_print_check" ||
    packet?.briefingKind === "vendor_cad_wait" ||
    packet?.briefingKind === "client_wait"
  ) {
    return true;
  }
  return Boolean(briefing);
}

export function presentDocketBriefing(input: {
  subject: string;
  headline: string;
  context: string | null;
  origin: CosDocketOrigin;
  staleInboundSatisfied?: boolean;
  noFounderAction?: boolean;
}): { headline: string; context: string | null } {
  const unassigned = !input.subject || input.subject === UNASSIGNED_SUBJECT;
  const rawHeadline = input.headline.trim();
  const rawContext = input.context?.trim() || "";
  const truthLocked = Boolean(input.staleInboundSatisfied || input.noFounderAction);

  const spec = rawContext ? rewriteSpecBriefing(rawHeadline, rawContext) : null;
  if (spec) return spec;

  const reply =
    !truthLocked && rawContext
      ? rewriteReplyBriefing(rawHeadline, rawContext, input.subject, unassigned)
      : null;
  if (reply) return reply;

  let headline = finishImperative(
    softenGeneratedPhrasing(rawHeadline)
      .replace(/\bConfirm the current /i, "Confirm the ")
      .replace(/\bDo it, or add it to Top 5/i, "Do this now"),
  );
  let context = rawContext ? softenGeneratedPhrasing(rawContext) : null;
  if (input.origin === "open_job" && context) {
    context = presentJobContext(rawContext);
  }
  if (context && /not already on Top 5/i.test(rawContext)) {
    headline = "Do this now.";
    context = "You committed to this, and it isn't on Today yet. I'd handle it while it's still in front of you.";
  }
  if (!context) return { headline, context: null };
  return { headline, context };
}
