/**
 * Brain Dump interpretation. Propose only. Never persist canonical facts.
 */

import type { BrainDumpProposal } from "./types";

const ACTION_RE =
  /\b(call|email|text|follow up|follow-up|send|order|quote|schedule|remind|check on)\b/i;
const PERSONAL_RE =
  /\b(birthday|anniversary|kids?|family|personal|vacation|doctor|school)\b/i;
const PROJECT_RE =
  /\b(ring|band|pendant|bracelet|necklace|cad|repair|sizing|project|stone|metal)\b/i;

export function interpretBrainDump(text: string): BrainDumpProposal {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const person = firstName(trimmed);
  const wantsAction = ACTION_RE.test(trimmed);
  const personal = PERSONAL_RE.test(trimmed);
  const project = PROJECT_RE.test(trimmed);
  return {
    personContext: person,
    projectContext: project ? clip(trimmed, 120) : null,
    action: wantsAction ? clip(trimmed, 160) : null,
    personalItem: personal ? clip(trimmed, 120) : null,
    note: trimmed ? clip(trimmed, 240) : null,
    followUp: wantsAction ? clip(trimmed, 160) : null,
    persist: false,
  };
}

function firstName(text: string): string | null {
  const matches = text.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g);
  for (const match of matches) {
    const name = match[1]?.trim() ?? "";
    if (!name) continue;
    if (/^(I|The|This|That|Just|Need|Please|Today|Monday|Ask)$/.test(name)) continue;
    return name;
  }
  return null;
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function brainDumpCopy(proposal: BrainDumpProposal): string {
  const lines = ["Here's how I would file that. Nothing has been saved."];
  if (proposal.personContext) lines.push(`Person: ${proposal.personContext}`);
  if (proposal.projectContext) lines.push(`Project: ${proposal.projectContext}`);
  if (proposal.action) lines.push(`Action: ${proposal.action}`);
  if (proposal.personalItem) lines.push(`Personal: ${proposal.personalItem}`);
  if (proposal.note) lines.push(`Note: ${proposal.note}`);
  if (proposal.followUp) lines.push(`Follow-up: ${proposal.followUp}`);
  return lines.join("\n");
}
