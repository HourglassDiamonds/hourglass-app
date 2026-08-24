/**
 * Deterministic Ask Concierge intent parser.
 * Birthday-month lookup only. No LLM, fuzzy matching, or person resolution.
 */

import { MONTH_NAMES } from "../facts/types";
import {
  ASK_CONCIERGE_QUERY_MAX_LENGTH,
  type AskConciergeIntent,
} from "./types";

const MONTH_ABBREVIATIONS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MONTH_NAME_TO_NUMBER: Record<string, number> = Object.fromEntries(
  MONTH_NAMES.map((name, index) => [name.toLowerCase(), index + 1]),
);

const LOCATIVE_BEFORE_MONTH = new Set(["in", "during", "for"]);
const MONTH_CONJUNCTIONS = new Set(["and", "or"]);

function monthNumberFromToken(token: string): number | null {
  return MONTH_NAME_TO_NUMBER[token] ?? MONTH_ABBREVIATIONS[token] ?? null;
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function hasBirthdayToken(tokens: string[]): boolean {
  return tokens.includes("birthday") || tokens.includes("birthdays");
}

function hasNextMonthPhrase(tokens: string[]): boolean {
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index] === "next" && tokens[index + 1] === "month") return true;
  }
  return false;
}

function mayHasMonthContext(tokens: string[], index: number): boolean {
  const prev = tokens[index - 1];
  const next = tokens[index + 1];
  if (prev && LOCATIVE_BEFORE_MONTH.has(prev)) return true;
  if (prev === "birthday" || prev === "birthdays") return true;
  if (next === "birthday" || next === "birthdays") return true;
  if (next && MONTH_CONJUNCTIONS.has(next) && monthNumberFromToken(tokens[index + 2] ?? "") != null) {
    return true;
  }
  if (prev && MONTH_CONJUNCTIONS.has(prev) && monthNumberFromToken(tokens[index - 2] ?? "") != null) {
    return true;
  }
  return false;
}

function collectMonthNumbers(tokens: string[]): number[] {
  const months = new Set<number>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const month = monthNumberFromToken(token);
    if (month == null) continue;
    if (token === "may" && !mayHasMonthContext(tokens, index)) continue;
    months.add(month);
  }
  return [...months];
}

export function parseAskConciergeIntent(query: string): AskConciergeIntent {
  if (typeof query !== "string") return { kind: "unsupported" };
  if (query.length > ASK_CONCIERGE_QUERY_MAX_LENGTH) return { kind: "unsupported" };
  const trimmed = query.trim();
  if (!trimmed) return { kind: "unsupported" };

  const tokens = tokenize(trimmed);
  if (tokens.length === 0 || !hasBirthdayToken(tokens)) {
    return { kind: "unsupported" };
  }

  const months = collectMonthNumbers(tokens);
  const nextMonth = hasNextMonthPhrase(tokens);

  if (nextMonth && months.length > 0) return { kind: "unsupported" };
  if (nextMonth) return { kind: "birthdays-next-month" };
  if (months.length === 1) {
    return { kind: "birthdays-by-month", month: months[0]! };
  }
  return { kind: "unsupported" };
}
