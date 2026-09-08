/**
 * Deterministic Human Intake extractor.
 * Model-agnostic. Ambiguous prose stays a candidate for review.
 * Never mints Persons. Never treats email/phone as identity proof.
 * Does not write Continuum Candidates — propose.ts maps hits onto the #17 contract.
 */

import { FINGER_SIZE_PATTERN } from "@/lib/continuum/client-memory/project-spec/types";
import { clipMatchedText } from "@/lib/continuum/candidates/identity";
import {
  looksLikeEmail,
  looksLikePhone,
  uniquePersonMatch,
  uniqueProjectTitleMatch,
  uniqueProjectTokenMatch,
} from "./match";
import { locatorFor } from "./source-ref";
import type {
  HumanIntakeEvidence,
  HumanIntakeWorld,
  IntakeParseHit,
} from "./types";

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const stamp = Date.UTC(year, month - 1, day);
  const dt = new Date(stamp);
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function currentYearFrom(capturedAt: string | null | undefined): number {
  if (capturedAt) {
    const parsed = Date.parse(capturedAt);
    if (!Number.isNaN(parsed)) return new Date(parsed).getUTCFullYear();
  }
  return 2026;
}

function eachMatch(
  text: string,
  pattern: RegExp,
  visit: (match: RegExpExecArray) => void,
): void {
  const re = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match[0] === "") {
      re.lastIndex += 1;
      continue;
    }
    visit(match);
  }
}

function extractDates(
  evidence: HumanIntakeEvidence,
  out: IntakeParseHit[],
): void {
  const yearHint = currentYearFrom(evidence.capturedAt ?? null);
  const named =
    /\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?\b/gi;
  eachMatch(evidence.text, named, (match) => {
    const monthName = match[1]?.toLowerCase() ?? "";
    const month = MONTHS[monthName];
    const day = Number(match[2]);
    const year = match[3] ? Number(match[3]) : yearHint;
    if (!month || !Number.isInteger(day)) return;
    const iso = isoDate(year, month, day);
    const start = match.index ?? 0;
    out.push({
      kind: "date",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      raw: match[0],
      isoDate: iso,
      precision: iso ? "day" : "unresolved",
      role: "mentioned",
      confidence: iso ? "high" : "ambiguous",
      ruleIds: iso
        ? ["explicit_named_date", "source_timestamp_year"]
        : ["explicit_named_date", "unresolved_calendar_day"],
    });
  });

  const iso = /\b(20\d{2})-(\d{2})-(\d{2})\b/g;
  eachMatch(evidence.text, iso, (match) => {
    const resolved = isoDate(Number(match[1]), Number(match[2]), Number(match[3]));
    const start = match.index ?? 0;
    out.push({
      kind: "date",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      raw: match[0],
      isoDate: resolved,
      precision: resolved ? "day" : "unresolved",
      role: "mentioned",
      confidence: resolved ? "high" : "ambiguous",
      ruleIds: resolved
        ? ["explicit_iso_date"]
        : ["explicit_iso_date", "unresolved_calendar_day"],
    });
  });

  const numeric = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g;
  eachMatch(evidence.text, numeric, (match) => {
    const resolved = isoDate(Number(match[3]), Number(match[1]), Number(match[2]));
    const start = match.index ?? 0;
    out.push({
      kind: "date",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      raw: match[0],
      isoDate: resolved,
      precision: resolved ? "day" : "unresolved",
      role: "mentioned",
      confidence: resolved ? "medium" : "ambiguous",
      ruleIds: resolved
        ? ["explicit_numeric_date"]
        : ["explicit_numeric_date", "unresolved_calendar_day"],
    });
  });
}

function extractFingerSizes(
  evidence: HumanIntakeEvidence,
  out: IntakeParseHit[],
): void {
  const pattern =
    /\b(?:finger\s+size|ring\s+size)\s*(?:is|:)?\s*([1-9]|[12]\d|30)(?:\.(0|00|25|5|50|75))?\b/gi;
  eachMatch(evidence.text, pattern, (match) => {
    const whole = match[1] ?? "";
    const frac = match[2] ? `.${match[2]}` : "";
    const value = `${whole}${frac}`;
    if (!FINGER_SIZE_PATTERN.test(value)) return;
    const start = match.index ?? 0;
    const projectId = evidence.confirmedProjectIds?.[0] ?? null;
    out.push({
      kind: "structured_spec",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      fieldName: "finger_size",
      proposedValue: value,
      projectId,
      confidence: projectId ? "high" : "medium",
      ruleIds: projectId
        ? ["explicit_finger_size"]
        : ["explicit_finger_size", "project_scope_required"],
    });
  });
}

function extractCadAndOrder(
  evidence: HumanIntakeEvidence,
  world: HumanIntakeWorld,
  out: IntakeParseHit[],
): void {
  const cad = /\bCAD(?:\s*(?:#|number|no\.?))?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9-]{1,20})\b/gi;
  eachMatch(evidence.text, cad, (match) => {
    const token = (match[1] ?? "").trim();
    if (!token || /^(presentation|design|render|file|pdf)$/i.test(token)) return;
    const start = match.index ?? 0;
    const tokenMatch = uniqueProjectTokenMatch(token, world.projects);
    const suggested =
      tokenMatch.project?.projectId ?? evidence.confirmedProjectIds?.[0] ?? null;
    out.push({
      kind: "structured_spec",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      fieldName: "cad_job_number",
      proposedValue: token,
      projectId: suggested,
      confidence: tokenMatch.project ? "high" : tokenMatch.ambiguous ? "ambiguous" : "medium",
      ruleIds: tokenMatch.ambiguous
        ? ["explicit_cad_job", "ambiguous_project_token"]
        : tokenMatch.project
          ? ["explicit_cad_job", "exact_project_token"]
          : ["explicit_cad_job"],
    });
    if (
      tokenMatch.project &&
      !evidence.confirmedProjectIds?.includes(tokenMatch.project.projectId)
    ) {
      out.push({
        kind: "project_association",
        locator: locatorFor(evidence.text, start, start + match[0].length),
        title: tokenMatch.project.title,
        token,
        projectId: tokenMatch.project.projectId,
        match: "exact",
        confidence: "high",
        ruleIds: ["exact_project_token"],
      });
    }
  });

  const order =
    /\border\s*(?:#|number|no\.?)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9-]{1,20})\b/gi;
  eachMatch(evidence.text, order, (match) => {
    const token = (match[1] ?? "").trim();
    if (!token) return;
    const start = match.index ?? 0;
    const tokenMatch = uniqueProjectTokenMatch(token, world.projects);
    out.push({
      kind: "structured_spec",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      fieldName: "order_number",
      proposedValue: token,
      projectId:
        tokenMatch.project?.projectId ?? evidence.confirmedProjectIds?.[0] ?? null,
      confidence: tokenMatch.project ? "high" : tokenMatch.ambiguous ? "ambiguous" : "medium",
      ruleIds: tokenMatch.ambiguous
        ? ["explicit_order_number", "ambiguous_project_token"]
        : tokenMatch.project
          ? ["explicit_order_number", "exact_project_token"]
          : ["explicit_order_number"],
    });
  });
}

function extractCommitments(
  evidence: HumanIntakeEvidence,
  out: IntakeParseHit[],
): void {
  const pattern =
    /\b(?:I(?:'ll| will)|I told (?:her|him|them) I(?:'d| would)|I promised(?: to)?|I need to)\b[^.!?\n]{3,180}/gi;
  eachMatch(evidence.text, pattern, (match) => {
    const quote = match[0].trim();
    const start = match.index ?? 0;
    out.push({
      kind: "open_job",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      jobKind: "commitment",
      subject: clipMatchedText(quote, 160),
      detail: quote.slice(0, 2000),
      waitingOnActor: "founder",
      dueAt: null,
      personId: evidence.confirmedPersonIds?.[0] ?? null,
      projectId: evidence.confirmedProjectIds?.[0] ?? null,
      confidence: "medium",
      ruleIds: ["explicit_founder_commitment"],
    });
  });
}

function extractClientRequests(
  evidence: HumanIntakeEvidence,
  out: IntakeParseHit[],
): void {
  const pattern =
    /\b(?:can you|could you|please (?:send|make|change|revise)|(?:she|he|they) (?:asked|wants)|client wants)\b[^.!?\n]{3,180}/gi;
  eachMatch(evidence.text, pattern, (match) => {
    const quote = match[0].trim();
    const start = match.index ?? 0;
    out.push({
      kind: "open_job",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      jobKind: "request",
      subject: clipMatchedText(quote, 160),
      detail: quote.slice(0, 2000),
      waitingOnActor: "hourglass",
      dueAt: null,
      personId: evidence.confirmedPersonIds?.[0] ?? null,
      projectId: evidence.confirmedProjectIds?.[0] ?? null,
      confidence: "medium",
      ruleIds: ["explicit_client_request"],
    });
  });
}

function extractVendorCommitments(
  evidence: HumanIntakeEvidence,
  out: IntakeParseHit[],
): void {
  const pattern =
    /\b(?:we(?:'ll| will) have (?:it|them)|we(?:'ll| will) have the)\b[^.!?\n]{0,160}/gi;
  eachMatch(evidence.text, pattern, (match) => {
    const quote = match[0].trim();
    const start = match.index ?? 0;
    out.push({
      kind: "open_job",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      jobKind: "blocked_issue",
      subject: clipMatchedText(quote, 160),
      detail: quote.slice(0, 2000),
      waitingOnActor: "vendor",
      dueAt: null,
      personId: evidence.confirmedPersonIds?.[0] ?? null,
      projectId: evidence.confirmedProjectIds?.[0] ?? null,
      confidence: "medium",
      ruleIds: ["explicit_vendor_commitment"],
    });
  });
}

function extractQuestions(
  evidence: HumanIntakeEvidence,
  out: IntakeParseHit[],
): void {
  const pattern =
    /\b(?:(?:who|what|when|where|why|how|can|could|should|do we|did they)\b[^.!?\n]{3,160}\?|[^.!?\n]{8,160}\b(?:confirm|confirming)\b[^.!?\n]{0,80}\?)/gi;
  eachMatch(evidence.text, pattern, (match) => {
    const quote = match[0].trim();
    const start = match.index ?? 0;
    out.push({
      kind: "open_job",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      jobKind: "question",
      subject: clipMatchedText(quote, 160),
      detail: quote.slice(0, 2000),
      waitingOnActor: "unknown",
      dueAt: null,
      personId: evidence.confirmedPersonIds?.[0] ?? null,
      projectId: evidence.confirmedProjectIds?.[0] ?? null,
      confidence: "low",
      ruleIds: ["explicit_question"],
    });
  });
}

function extractFollowUps(
  evidence: HumanIntakeEvidence,
  out: IntakeParseHit[],
): void {
  const pattern = /\b(?:follow[- ]up|circle back|check back)\b[^.!?\n]{0,140}/gi;
  eachMatch(evidence.text, pattern, (match) => {
    const quote = match[0].trim();
    const start = match.index ?? 0;
    out.push({
      kind: "follow_up",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      text: clipMatchedText(quote, 280),
      dueAt: null,
      personId: evidence.confirmedPersonIds?.[0] ?? null,
      projectId: evidence.confirmedProjectIds?.[0] ?? null,
      confidence: "medium",
      ruleIds: ["explicit_follow_up"],
    });
    out.push({
      kind: "open_job",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      jobKind: "required_action",
      subject: clipMatchedText(quote, 160),
      detail: quote.slice(0, 2000),
      waitingOnActor: "founder",
      dueAt: null,
      personId: evidence.confirmedPersonIds?.[0] ?? null,
      projectId: evidence.confirmedProjectIds?.[0] ?? null,
      confidence: "medium",
      ruleIds: ["explicit_follow_up"],
    });
  });
}

function extractPreferenceNotes(
  evidence: HumanIntakeEvidence,
  out: IntakeParseHit[],
): void {
  const pattern =
    /\b(?:she|he|they)\s+(?:likes?|liked|wants?|wanted|prefers?|preferred|asked for)\s+[^.!?\n]{3,180}/gi;
  eachMatch(evidence.text, pattern, (match) => {
    const quote = match[0].trim();
    const start = match.index ?? 0;
    out.push({
      kind: "note",
      locator: locatorFor(evidence.text, start, start + match[0].length),
      text: quote.slice(0, 2000),
      contextLayer: evidence.confirmedPersonIds?.[0] ? "client" : null,
      personId: evidence.confirmedPersonIds?.[0] ?? null,
      projectId: evidence.confirmedProjectIds?.[0] ?? null,
      confidence: "medium",
      ruleIds: ["explicit_preference_note"],
    });
  });
}

function extractPersonAssociations(
  evidence: HumanIntakeEvidence,
  world: HumanIntakeWorld,
  out: IntakeParseHit[],
): void {
  const confirmed = new Set(evidence.confirmedPersonIds ?? []);
  const seen = new Set<string>();
  const ranked = [...world.people].sort(
    (a, b) => b.displayName.trim().length - a.displayName.trim().length,
  );
  for (const person of ranked) {
    const name = person.displayName.trim();
    if (name.length < 2) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "gi");
    eachMatch(evidence.text, pattern, (match) => {
      const start = match.index ?? 0;
      const span = evidence.text.slice(start, start + match[0].length + 40);
      if (looksLikeEmail(span) || looksLikePhone(span)) return;
      if (confirmed.has(person.personId)) return;
      const unique = uniquePersonMatch(name, world.people);
      const key = `${name.toLowerCase()}:${unique.person?.personId ?? "none"}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push({
        kind: "person_association",
        locator: locatorFor(evidence.text, start, start + match[0].length),
        displayName: name,
        personId: unique.person?.personId ?? null,
        confidence: unique.ambiguous ? "ambiguous" : unique.person ? "high" : "low",
        ruleIds: unique.ambiguous
          ? ["exact_person_display_name", "ambiguous_person_name"]
          : unique.person
            ? ["exact_person_display_name"]
            : ["exact_person_display_name", "unknown_person"],
      });
    });
  }
}

function extractProjectAssociations(
  evidence: HumanIntakeEvidence,
  world: HumanIntakeWorld,
  out: IntakeParseHit[],
): void {
  const confirmed = new Set(evidence.confirmedProjectIds ?? []);
  const seen = new Set<string>();
  const ranked = [...world.projects].sort(
    (a, b) => b.title.trim().length - a.title.trim().length,
  );
  for (const project of ranked) {
    const title = project.title.trim();
    if (title.length < 3) continue;
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "gi");
    eachMatch(evidence.text, pattern, (match) => {
      if (confirmed.has(project.projectId)) return;
      const unique = uniqueProjectTitleMatch(title, world.projects);
      const key = `${title.toLowerCase()}:${unique.project?.projectId ?? "none"}`;
      if (seen.has(key)) return;
      seen.add(key);
      const start = match.index ?? 0;
      out.push({
        kind: "project_association",
        locator: locatorFor(evidence.text, start, start + match[0].length),
        title,
        token: null,
        projectId: unique.project?.projectId ?? null,
        match: unique.ambiguous ? "ambiguous" : unique.project ? "exact" : "ambiguous",
        confidence: unique.ambiguous ? "ambiguous" : unique.project ? "high" : "low",
        ruleIds: unique.ambiguous
          ? ["exact_project_title", "ambiguous_project_title"]
          : unique.project
            ? ["exact_project_title"]
            : ["exact_project_title", "unknown_project"],
      });
    });
  }
}

export function parseHumanIntakeEvidence(
  evidence: HumanIntakeEvidence,
  world: HumanIntakeWorld,
): IntakeParseHit[] {
  const text = evidence.text ?? "";
  if (!text.trim()) return [];
  const input = { ...evidence, text };
  const hits: IntakeParseHit[] = [];
  extractDates(input, hits);
  extractFingerSizes(input, hits);
  extractCadAndOrder(input, world, hits);
  extractCommitments(input, hits);
  extractClientRequests(input, hits);
  extractVendorCommitments(input, hits);
  extractQuestions(input, hits);
  extractFollowUps(input, hits);
  extractPreferenceNotes(input, hits);
  extractPersonAssociations(input, world, hits);
  extractProjectAssociations(input, world, hits);
  return hits;
}
