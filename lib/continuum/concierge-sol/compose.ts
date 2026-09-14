/**
 * Founder-facing copy from Continuum tool results.
 * Used when Sol is unavailable and to ground exact business answers.
 */

import { askBirthdaysByMonthHeadline, formatAskBirthdayDate } from "@/lib/continuum/client-memory/ask/types";
import type { ConciergeEvidenceAction, ConciergeToolResult } from "./types";
import {
  CONCIERGE_SOL_TOOL_FAILURE_MESSAGE,
  CONCIERGE_SOL_UNKNOWN_PERSON,
  CONCIERGE_SOL_UNKNOWN_PROJECT,
  CONCIERGE_SOL_WRITE_BLOCKED_MESSAGE,
} from "./types";
import { sanitizeFounderText } from "./sanitize";

export function collectEvidenceActions(
  results: readonly ConciergeToolResult[],
): ConciergeEvidenceAction[] {
  const actions: ConciergeEvidenceAction[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    const data = result.data;
    pushAction(actions, seen, data.href, data.displayName, data.title);
    const people = Array.isArray(data.people) ? data.people : [];
    for (const row of people) {
      if (row && typeof row === "object") {
        const rec = row as Record<string, unknown>;
        pushAction(actions, seen, rec.href, rec.displayName, null);
      }
    }
    const matches = Array.isArray(data.matches) ? data.matches : [];
    for (const row of matches) {
      if (row && typeof row === "object") {
        const rec = row as Record<string, unknown>;
        pushAction(actions, seen, rec.href, rec.displayName, rec.title);
      }
    }
    const projects = Array.isArray(data.projects) ? data.projects : [];
    for (const row of projects) {
      if (row && typeof row === "object") {
        const rec = row as Record<string, unknown>;
        pushAction(actions, seen, rec.href, rec.title, rec.displayName);
      }
    }
    const facts = Array.isArray(data.facts) ? data.facts : [];
    for (const row of facts) {
      if (row && typeof row === "object") {
        const rec = row as Record<string, unknown>;
        const href = typeof rec.sourceHref === "string" ? rec.sourceHref : typeof rec.href === "string" ? rec.href : null;
        if (href) {
          const verified = rec.sourceVerified === true;
          const key = `email:${href}`;
          if (!seen.has(key)) {
            seen.add(key);
            actions.push({
              kind: "view-email",
              label: verified ? "View source" : "View evidence",
              href,
              provenanceLimited: !verified,
              provenanceLabel: verified
                ? null
                : "The exact source message could not be verified.",
            });
          }
        }
      }
    }
    if (typeof data.href === "string" && result.name === "get_recent_project_email") {
      const key = `email:${data.href}`;
      if (!seen.has(key) && data.href.startsWith("https://mail.google.com/")) {
        seen.add(key);
        actions.push({
          kind: "view-email",
          label: "View email",
          href: data.href,
        });
      }
    }
    const messages = Array.isArray(data.messages) ? data.messages : [];
    for (const row of messages) {
      if (row && typeof row === "object") {
        const rec = row as Record<string, unknown>;
        if (typeof rec.href === "string" && rec.href.startsWith("https://mail.google.com/")) {
          const key = `email:${rec.href}`;
          if (!seen.has(key)) {
            seen.add(key);
            actions.push({ kind: "view-email", label: "View email", href: rec.href });
          }
        }
      }
    }
  }
  return actions.slice(0, 6);
}

function pushAction(
  actions: ConciergeEvidenceAction[],
  seen: Set<string>,
  href: unknown,
  primary: unknown,
  secondary: unknown,
): void {
  if (typeof href !== "string" || !href.startsWith("/executive-dashboard/concierge/")) return;
  if (seen.has(href)) return;
  seen.add(href);
  const label =
    (typeof primary === "string" && primary.trim()) ||
    (typeof secondary === "string" && secondary.trim()) ||
    (href.includes("/projects/") ? "Open project" : "Open person");
  actions.push({
    kind: href.includes("/projects/") ? "open-project" : "open-person",
    label,
    href,
  });
}

export function composeFromTools(
  results: readonly ConciergeToolResult[],
): string | null {
  if (results.length === 0) return null;
  const failed = results.filter((row) => !row.ok);
  if (failed.length === results.length) return CONCIERGE_SOL_TOOL_FAILURE_MESSAGE;

  const repair = results.find((row) => row.name === "get_repair_quote");
  if (repair?.ok && repair.data.quoted === true && typeof repair.data.clientAnswer === "string") {
    return sanitizeFounderText(repair.data.clientAnswer);
  }
  if (repair?.ok && repair.data.quoted === false && typeof repair.data.detail === "string") {
    return sanitizeFounderText(repair.data.detail);
  }

  const proposal = results.find((row) => row.name === "propose_canonical_change");
  if (proposal?.ok) return CONCIERGE_SOL_WRITE_BLOCKED_MESSAGE;

  const provenance = results.filter(
    (row) => row.ok && (row.name === "get_provenance_summary" || row.name === "get_source_evidence"),
  );
  if (provenance.length > 0) {
    const facts = provenance.flatMap((row) => (Array.isArray(row.data.facts) ? row.data.facts : []));
    const useful = facts.filter((row) => {
      if (!row || typeof row !== "object") return false;
      const rec = row as { canonicalValue?: unknown; proposedValue?: unknown };
      return Boolean(rec.canonicalValue) || Boolean(rec.proposedValue);
    });
    const chosen = useful.length > 0 ? useful : facts;
    const copies = chosen
      .map((row) => (row && typeof row === "object" ? (row as { copy?: string }).copy : null))
      .filter((row): row is string => Boolean(row));
    if (copies[0]) return sanitizeFounderText(copies.join(" "));
  }

  const birthdays = results.find((row) => row.name === "get_birthdays");
  if (birthdays?.ok) {
    const month = typeof birthdays.data.month === "number" ? birthdays.data.month : 0;
    const people = Array.isArray(birthdays.data.people) ? birthdays.data.people : [];
    const names = people
      .map((row) => {
        if (!row || typeof row !== "object") return "";
        const rec = row as { displayName?: string; month?: number; day?: number | null };
        const date =
          typeof rec.month === "number"
            ? formatAskBirthdayDate({ month: rec.month, day: rec.day ?? null })
            : "";
        return rec.displayName ? `${rec.displayName}${date ? ` — ${date}` : ""}` : "";
      })
      .filter(Boolean);
    const headline = askBirthdaysByMonthHeadline(month, names.length);
    return sanitizeFounderText(names.length > 0 ? `${headline}\n${names.join("\n")}` : headline);
  }

  const personSummary = results.find((row) => row.name === "get_person_summary");
  const personHit = results.find((row) => row.name === "find_person");
  if (personSummary?.ok && personSummary.data.unknown === true) return CONCIERGE_SOL_UNKNOWN_PERSON;
  if (personHit?.ok && personHit.data.unknown === true && !personSummary) return CONCIERGE_SOL_UNKNOWN_PERSON;
  if (personSummary?.ok && typeof personSummary.data.displayName === "string") {
    const projects = Array.isArray(personSummary.data.projects) ? personSummary.data.projects : [];
    const titles = projects
      .map((row) => (row && typeof row === "object" ? (row as { title?: string }).title : null))
      .filter((row): row is string => Boolean(row));
    const line = titles.length
      ? `${personSummary.data.displayName} currently has ${titles.join("; ")}.`
      : `${personSummary.data.displayName} is in Continuum. No current project titles were attached.`;
    return sanitizeFounderText(line);
  }
  if (personHit?.ok) {
    const matches = Array.isArray(personHit.data.matches) ? personHit.data.matches : [];
    const name = matches
      .map((row) => (row && typeof row === "object" ? (row as { displayName?: string }).displayName : null))
      .find((row): row is string => Boolean(row));
    if (name) return sanitizeFounderText(`${name} is in Continuum.`);
  }

  const specs = results.find((row) => row.name === "get_project_specs");
  if (specs?.ok) {
    if (specs.data.unknown === true) return CONCIERGE_SOL_UNKNOWN_PROJECT;
    const title = typeof specs.data.title === "string" ? specs.data.title : "This project";
    const rows = Array.isArray(specs.data.specs) ? specs.data.specs : [];
    const lines = rows
      .map((row) => {
        if (!row || typeof row !== "object") return "";
        const rec = row as { label?: string; value?: string };
        return rec.label && rec.value ? `${rec.label}: ${rec.value}` : "";
      })
      .filter(Boolean);
    return sanitizeFounderText(
      lines.length
        ? `${title}\n${lines.join("\n")}`
        : `${title} is in Continuum. No specs are stored yet.`,
    );
  }

  const project = results.find((row) => row.name === "find_project" || row.name === "get_project_summary");
  if (project?.ok && project.data.unknown === true) return CONCIERGE_SOL_UNKNOWN_PROJECT;
  if (project?.ok && typeof project.data.title === "string") {
    const lifecycle = typeof project.data.lifecycleLabel === "string" ? project.data.lifecycleLabel : null;
    return sanitizeFounderText(
      lifecycle ? `${project.data.title} is ${lifecycle}.` : `${project.data.title} is in Continuum.`,
    );
  }

  const today = results.find((row) => row.name === "get_today_items");
  if (today?.ok) {
    const items = Array.isArray(today.data.items) ? today.data.items : [];
    if (items.length === 0) return "Nothing is queued on Today right now.";
    const lines = items.map((row, index) => {
      if (!row || typeof row !== "object") return "";
      const rec = row as { title?: string; detail?: string; projectTitle?: string | null };
      const who = rec.projectTitle ? `${rec.projectTitle}: ` : "";
      return `${index + 1}. ${who}${rec.title ?? rec.detail ?? ""}`.trim();
    }).filter(Boolean);
    return sanitizeFounderText(`Top things to handle today:\n${lines.join("\n")}`);
  }

  const waiting = results.find((row) =>
    row.name === "get_waiting_on_client" ||
    row.name === "get_waiting_on_shop" ||
    row.name === "get_in_production" ||
    row.name === "get_open_commitments" ||
    row.name === "get_waiting_state",
  );
  if (waiting?.ok) {
    const projects = Array.isArray(waiting.data.projects) ? waiting.data.projects : [];
    if (waiting.name === "get_waiting_state") {
      const groups = Array.isArray(waiting.data.groups) ? waiting.data.groups : [];
      const yours = groups.find((row) => row && typeof row === "object" && (row as { id?: string }).id === "your_turn") as
        | { titles?: string[]; count?: number }
        | undefined;
      const titles = yours?.titles ?? [];
      return sanitizeFounderText(
        titles.length
          ? `Waiting on you:\n${titles.join("\n")}`
          : "Nothing is waiting on you right now.",
      );
    }
    const titles = projects
      .map((row) => (row && typeof row === "object" ? (row as { title?: string }).title : null))
      .filter((row): row is string => Boolean(row));
    if (waiting.name === "get_waiting_on_client") {
      return sanitizeFounderText(
        titles.length ? `Waiting on the client:\n${titles.join("\n")}` : "No current projects are waiting on the client.",
      );
    }
    if (waiting.name === "get_waiting_on_shop") {
      return sanitizeFounderText(
        titles.length ? `Waiting on the shop:\n${titles.join("\n")}` : "No current projects are waiting on the shop.",
      );
    }
    if (waiting.name === "get_in_production") {
      return sanitizeFounderText(
        titles.length ? `In production:\n${titles.join("\n")}` : "No current projects are in production.",
      );
    }
    return sanitizeFounderText(
      titles.length ? `Waiting on you:\n${titles.join("\n")}` : "Nothing is waiting on you right now.",
    );
  }

  const email = results.find((row) => row.name === "get_recent_project_email" || row.name === "search_gmail_evidence");
  if (email?.ok) {
    if (email.data.unknown === true) return "Continuum doesn't have a recent email thread for that project.";
    const subject = typeof email.data.subject === "string" ? email.data.subject : null;
    const snippet = typeof email.data.snippet === "string" ? email.data.snippet : null;
    const title = typeof email.data.projectTitle === "string" ? email.data.projectTitle : "That project";
    if (snippet) return sanitizeFounderText(`Latest email on ${title}: ${subject ?? "(no subject)"}.\n${snippet}`);
    if (subject) return sanitizeFounderText(`Latest indexed email on ${title} is “${subject}”. Open the source to read it.`);
  }

  return null;
}
