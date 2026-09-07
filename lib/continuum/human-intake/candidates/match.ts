/**
 * Deterministic Person / Project suggestion matching.
 * Exact display-name / title only. Never email, phone, or auto-merge.
 */

import type { HumanIntakePerson, HumanIntakeProject } from "./types";

function normalizeName(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

export function findExactPersonMatches(
  displayName: string,
  people: readonly HumanIntakePerson[],
): HumanIntakePerson[] {
  const needle = normalizeName(displayName);
  if (!needle) return [];
  return people.filter((row) => normalizeName(row.displayName) === needle);
}

export function uniquePersonMatch(
  displayName: string,
  people: readonly HumanIntakePerson[],
): { person: HumanIntakePerson | null; ambiguous: boolean } {
  const matches = findExactPersonMatches(displayName, people);
  if (matches.length === 1) return { person: matches[0] ?? null, ambiguous: false };
  if (matches.length > 1) return { person: null, ambiguous: true };
  return { person: null, ambiguous: false };
}

export function findExactProjectTitleMatches(
  title: string,
  projects: readonly HumanIntakeProject[],
): HumanIntakeProject[] {
  const needle = normalizeName(title);
  if (!needle) return [];
  return projects.filter((row) => normalizeName(row.title) === needle);
}

export function uniqueProjectTitleMatch(
  title: string,
  projects: readonly HumanIntakeProject[],
): { project: HumanIntakeProject | null; ambiguous: boolean } {
  const matches = findExactProjectTitleMatches(title, projects);
  if (matches.length === 1) return { project: matches[0] ?? null, ambiguous: false };
  if (matches.length > 1) return { project: null, ambiguous: true };
  return { project: null, ambiguous: false };
}

export function uniqueProjectTokenMatch(
  token: string,
  projects: readonly HumanIntakeProject[],
): { project: HumanIntakeProject | null; ambiguous: boolean } {
  const needle = token.trim().toLowerCase();
  if (!needle) return { project: null, ambiguous: false };
  const matches = projects.filter((row) => {
    const cad = row.cadJobNumber?.trim().toLowerCase();
    const order = row.orderNumber?.trim().toLowerCase();
    return cad === needle || order === needle;
  });
  if (matches.length === 1) return { project: matches[0] ?? null, ambiguous: false };
  if (matches.length > 1) return { project: null, ambiguous: true };
  return { project: null, ambiguous: false };
}

export function looksLikeEmail(text: string): boolean {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(text);
}

export function looksLikePhone(text: string): boolean {
  return /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/.test(text);
}
