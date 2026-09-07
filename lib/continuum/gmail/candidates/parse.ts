/**
 * Deterministic Gmail candidate extractors.
 * No live model calls. Matched tokens only — not mailbox body persistence.
 */

import { FINGER_SIZE_PATTERN } from "@/lib/continuum/client-memory/project-spec/types";
import { validateProjectSpecCorrection } from "@/lib/continuum/client-memory/project-spec/validate";
import { clipMatchedText } from "@/lib/continuum/candidates/identity";
import type { EditableProjectSpecField } from "@/lib/continuum/client-memory/project-spec/types";
import { extractCadJobIdentifiers, isStrongStructuredCadIdentifier } from "../cad-job-identifier";
import { extractOrderIdentifiers } from "../order-identifier";
import { specFieldValue, type GmailCandidateProject } from "./types";

const FINGER_SIZE_TOKEN = "(?:[1-9]|[12]\\d|30)(?:\\.(?:0|00|25|5|50|75))?";
const RING_FINGER_SIZE = new RegExp(
  `\\b(?:ring|finger)\\s+size\\s*(?:is|=|:)?\\s*(${FINGER_SIZE_TOKEN})\\b`,
  "gi",
);
const FRACTIONAL_SIZE = new RegExp(
  `\\bsize\\s*(?:is|=|:)?\\s*((?:[1-9]|[12]\\d|30)\\.(?:0|00|25|5|50|75))\\b`,
  "gi",
);
const METAL =
  /\b(platinum|palladium|18k\s+white\s+gold|18k\s+yellow\s+gold|18k\s+rose\s+gold|14k\s+white\s+gold|14k\s+yellow\s+gold|14k\s+rose\s+gold|white\s+gold|yellow\s+gold|rose\s+gold)\b/gi;
const CENTER_STONE =
  /\b(?:center|centre)\s+stone\s*(?:is|=|:)?\s*([^\n.]{2,80})/gi;
const SUPPLY =
  /\b((?:family\s+)?synthetic\s+sapphire|customer\s+center|vendor\s+melee|lab[- ]grown|diamond\s+supply)\b[^.!\n]{0,80}/gi;
const CAD_REVISION = /\b(?:CAD\s+)?revision\s+([A-Z])\b/gi;
const CLIENT_APPROVAL =
  /\b(CAD looks great|diamond looks awesome|looks great|looks awesome|please proceed|approved|client approval)\b/gi;
const DESIGN_REFINEMENT = /\b(?:CAD|design)\s+refinement\b/gi;
const DURABILITY = /\bdurability\b[^.!\n]{0,120}/gi;
const FOUNDER_COMMITMENT =
  /\bI(?:'ll| will) (?:send|do|follow up|call|email)[^.!?\n]{0,160}/gi;
const CLIENT_REQUEST =
  /\b(?:can you|could you|please) (?:send|make|revise|update|do)[^.!?\n]{0,160}/gi;
const VENDOR_WAIT =
  /\bwe(?:'ll| will) send\b[^.!?\n]{0,160}|\bwhen ready\b[^.!?\n]{0,80}/gi;
const FOLLOW_UP =
  /\b(?:follow[- ]up|circle back|check back)(?:\s+in\s+two weeks)?\b[^.!?\n]{0,120}/gi;
const RELATIVE_TOMORROW = /\btomorrow\b/gi;
const RELATIVE_TWO_WEEKS = /\b(?:in\s+two weeks|follow[- ]up in two weeks)\b/gi;
const NEXT_WEEKDAY =
  /\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi;
const NAMED_DATE =
  /\b((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?))\s+(\d{1,2})(?:st|nd|rd|th)?(?:[,\s]+(\d{4}))?\b/gi;

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

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export function eachMatch(
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

export function haystackOf(subject: string | null, plaintext: string | null): string {
  return [subject ?? "", plaintext ?? ""].filter((row) => row.trim()).join("\n");
}

function isoDay(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

function utcDay(iso: string): Date | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const dt = new Date(ms);
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

export function addUtcDays(iso: string, days: number): string | null {
  const day = utcDay(iso);
  if (!day) return null;
  day.setUTCDate(day.getUTCDate() + days);
  return day.toISOString().slice(0, 10);
}

export function nextWeekdayIso(iso: string, weekday: number): string | null {
  const day = utcDay(iso);
  if (!day) return null;
  const current = day.getUTCDay();
  let delta = (weekday - current + 7) % 7;
  if (delta === 0) delta = 7;
  return addUtcDays(iso, delta);
}

export function yearFromTimestamp(iso: string): number {
  const day = utcDay(iso);
  return day ? day.getUTCFullYear() : 2026;
}

function specConflict(
  current: string | null,
  proposed: string,
): boolean {
  const left = (current ?? "").trim().toLowerCase();
  const right = proposed.trim().toLowerCase();
  if (!left) return false;
  return left !== right;
}

export type SpecHit = {
  fieldName: EditableProjectSpecField;
  proposedValue: string;
  currentValue: string | null;
  conflict: boolean;
  matchedText: string;
  ruleIds: readonly string[];
};

export function extractStructuredSpecs(
  text: string,
  project: GmailCandidateProject | null,
): SpecHit[] {
  const hits: SpecHit[] = [];

  const push = (
    fieldName: EditableProjectSpecField,
    raw: string,
    matchedText: string,
    ruleIds: readonly string[],
  ) => {
    const validated = validateProjectSpecCorrection(fieldName, raw);
    if (!validated.ok) return;
    const current = project ? specFieldValue(project, fieldName) : null;
    if ((current ?? "").trim().toLowerCase() === validated.value.toLowerCase()) {
      return;
    }
    hits.push({
      fieldName,
      proposedValue: validated.value,
      currentValue: current,
      conflict: specConflict(current, validated.value),
      matchedText: clipMatchedText(matchedText),
      ruleIds,
    });
  };

  eachMatch(text, RING_FINGER_SIZE, (match) => {
    const value = match[1] ?? "";
    if (!FINGER_SIZE_PATTERN.test(value)) return;
    push("finger_size", value, match[0], ["explicit_finger_size"]);
  });
  eachMatch(text, FRACTIONAL_SIZE, (match) => {
    const value = match[1] ?? "";
    if (!FINGER_SIZE_PATTERN.test(value)) return;
    push("finger_size", value, match[0], ["explicit_fractional_size"]);
  });
  eachMatch(text, METAL, (match) => {
    push("metal", match[1] ?? match[0], match[0], ["explicit_metal"]);
  });
  eachMatch(text, CENTER_STONE, (match) => {
    push("center_stone", match[1] ?? "", match[0], ["explicit_center_stone"]);
  });
  eachMatch(text, SUPPLY, (match) => {
    push(
      "diamond_supply_notes",
      clipMatchedText(match[0], 200),
      match[0],
      ["explicit_supply_notes"],
    );
  });
  for (const cad of extractCadJobIdentifiers(text)) {
    if (!isStrongStructuredCadIdentifier(cad)) continue;
    push("cad_job_number", cad, cad, ["exact_cad_job"]);
  }
  for (const order of extractOrderIdentifiers(text)) {
    push("order_number", order, order, ["exact_order_number"]);
  }
  return hits;
}

export type ContextHit = {
  topic: string;
  value: string;
  matchedText: string;
  ruleIds: readonly string[];
};

export function extractProjectContext(text: string): ContextHit[] {
  const hits: ContextHit[] = [];
  eachMatch(text, CAD_REVISION, (match) => {
    hits.push({
      topic: "cad_revision",
      value: (match[1] ?? "").toUpperCase(),
      matchedText: clipMatchedText(match[0]),
      ruleIds: ["explicit_cad_revision"],
    });
  });
  eachMatch(text, CLIENT_APPROVAL, (match) => {
    hits.push({
      topic: "client_approval",
      value: clipMatchedText(match[0]),
      matchedText: clipMatchedText(match[0]),
      ruleIds: ["explicit_client_approval"],
    });
  });
  eachMatch(text, DESIGN_REFINEMENT, (match) => {
    hits.push({
      topic: "design_refinement",
      value: clipMatchedText(match[0]),
      matchedText: clipMatchedText(match[0]),
      ruleIds: ["explicit_design_refinement"],
    });
  });
  return hits;
}

export type NoteHit = {
  text: string;
  matchedText: string;
  ruleIds: readonly string[];
};

export function extractNotes(text: string): NoteHit[] {
  const hits: NoteHit[] = [];
  eachMatch(text, DURABILITY, (match) => {
    hits.push({
      text: clipMatchedText(match[0], 280),
      matchedText: clipMatchedText(match[0]),
      ruleIds: ["explicit_durability_discussion"],
    });
  });
  return hits;
}

export type JobHit = {
  jobKind: "commitment" | "request" | "blocked_issue";
  waitingOnActor: "founder" | "vendor";
  subject: string;
  matchedText: string;
  ruleIds: readonly string[];
};

export function extractOpenJobs(
  text: string,
  direction: "inbound" | "outbound" | "unknown",
  role: "client" | "vendor-contact" | "founder" | "unknown",
): JobHit[] {
  const hits: JobHit[] = [];
  if (direction === "outbound" || role === "founder") {
    eachMatch(text, FOUNDER_COMMITMENT, (match) => {
      hits.push({
        jobKind: "commitment",
        waitingOnActor: "founder",
        subject: clipMatchedText(match[0], 160),
        matchedText: clipMatchedText(match[0]),
        ruleIds: ["explicit_founder_commitment"],
      });
    });
  }
  if (direction === "inbound" && role !== "founder") {
    eachMatch(text, CLIENT_REQUEST, (match) => {
      hits.push({
        jobKind: "request",
        waitingOnActor: "founder",
        subject: clipMatchedText(match[0], 160),
        matchedText: clipMatchedText(match[0]),
        ruleIds: ["explicit_client_request"],
      });
    });
    if (role === "vendor-contact") {
      eachMatch(text, VENDOR_WAIT, (match) => {
        hits.push({
          jobKind: "blocked_issue",
          waitingOnActor: "vendor",
          subject: clipMatchedText(match[0], 160),
          matchedText: clipMatchedText(match[0]),
          ruleIds: ["explicit_vendor_waiting"],
        });
      });
    }
  }
  return hits;
}

export type DateHit = {
  raw: string;
  isoDate: string | null;
  precision: "day" | "unresolved";
  role: "deadline" | "mentioned" | "relative";
  followUp: boolean;
  matchedText: string;
  ruleIds: readonly string[];
};

export function extractDates(text: string, sourceTimestamp: string): DateHit[] {
  const hits: DateHit[] = [];
  const yearHint = yearFromTimestamp(sourceTimestamp);

  eachMatch(text, RELATIVE_TOMORROW, (match) => {
    hits.push({
      raw: match[0],
      isoDate: addUtcDays(sourceTimestamp, 1),
      precision: "day",
      role: "relative",
      followUp: false,
      matchedText: clipMatchedText(match[0]),
      ruleIds: ["relative_tomorrow", "source_timestamp_utc_date"],
    });
  });

  eachMatch(text, RELATIVE_TWO_WEEKS, (match) => {
    hits.push({
      raw: match[0],
      isoDate: addUtcDays(sourceTimestamp, 14),
      precision: "day",
      role: "relative",
      followUp: true,
      matchedText: clipMatchedText(match[0]),
      ruleIds: ["relative_two_weeks", "source_timestamp_utc_date"],
    });
  });

  eachMatch(text, NEXT_WEEKDAY, (match) => {
    const weekday = WEEKDAYS[(match[1] ?? "").toLowerCase()];
    if (weekday == null) return;
    hits.push({
      raw: match[0],
      isoDate: nextWeekdayIso(sourceTimestamp, weekday),
      precision: "day",
      role: "relative",
      followUp: false,
      matchedText: clipMatchedText(match[0]),
      ruleIds: ["relative_next_weekday", "source_timestamp_utc_date"],
    });
  });

  eachMatch(text, NAMED_DATE, (match) => {
    const month = MONTHS[(match[1] ?? "").toLowerCase()];
    const day = Number(match[2]);
    const year = match[3] ? Number(match[3]) : yearHint;
    if (!month || !Number.isInteger(day)) return;
    const iso = isoDay(year, month, day);
    hits.push({
      raw: match[0],
      isoDate: iso,
      precision: iso ? "day" : "unresolved",
      role: "mentioned",
      followUp: false,
      matchedText: clipMatchedText(match[0]),
      ruleIds: ["explicit_named_date", "source_timestamp_year"],
    });
  });

  eachMatch(text, FOLLOW_UP, (match) => {
    if (/\bin two weeks\b/i.test(match[0])) return;
    hits.push({
      raw: match[0],
      isoDate: null,
      precision: "unresolved",
      role: "mentioned",
      followUp: true,
      matchedText: clipMatchedText(match[0]),
      ruleIds: ["explicit_follow_up"],
    });
  });

  return hits;
}
