/**
 * Resolve Open Email to the Gmail message/thread that created or supports the item.
 * Presentation only. Does not guess. Never prefers synthesized operating mail.
 *
 * Authority:
 * 1. Exact structured-spec conflict Gmail sourceHref, and only when provenance is EXACT
 * 2. Exact candidate/evidence Gmail source for non-conflict items
 * 3. Supporting real Gmail, only when this is not a spec-conflict card
 * 4. Generated operating mail — never an Open Email destination
 *
 * Spec-conflict cards never fall through to latest Person/Project mail,
 * project.gmailThreadId, or a supporting beat. If the conflict has no
 * exact Gmail source, return [].
 */

import { GENERATED_FOUNDER_OPERATING_BRIEF_RULE } from "@/lib/continuum/gmail/candidates/generated-source";
import { parseGmailWebHref } from "./evidence";
import type { CosBriefSpeaker, CosEvidenceBeat } from "./types";

export { GENERATED_FOUNDER_OPERATING_BRIEF_RULE };

export type CosOpenEmailSource = {
  href: string;
  label: string;
};

export type SelectOpenEmailSourcesInput = {
  beats: readonly CosEvidenceBeat[];
  specCandidateId?: string | null;
  canonicalThreadId?: string | null;
  fallbackHref?: string | null;
  /** When true, only the conflict's own Gmail source is eligible. */
  conflictMode?: boolean;
  /** Exact Gmail href of the proposed-value candidate. Independent of sliced beats. */
  conflictSourceHref?: string | null;
};

type ParsedEmailSource = CosOpenEmailSource & {
  threadId: string;
  candidateId: string;
  speaker: CosBriefSpeaker;
  generated: boolean;
  order: number;
};

function canonicalThread(value: string | null | undefined): string | null {
  const thread = value?.trim().toLowerCase() ?? "";
  return thread || null;
}

function sourceLabel(beat: CosEvidenceBeat): string {
  return beat.label.replace(/\s*→\s*.+$/, "").trim() || "Source email";
}

function parseBeatSource(beat: CosEvidenceBeat, order: number): ParsedEmailSource | null {
  const href = beat.sourceHref?.trim() ?? "";
  const parsed = parseGmailWebHref(href);
  if (!parsed) return null;
  return {
    href,
    label: sourceLabel(beat),
    threadId: parsed.threadId.toLowerCase(),
    candidateId: beat.candidateId,
    speaker: beat.speaker,
    generated: beat.generatedSource === true,
    order,
  };
}

function parseFallback(href: string): CosOpenEmailSource | null {
  const parsed = parseGmailWebHref(href);
  if (!parsed) return null;
  return { href: href.trim(), label: "Source email" };
}

function relevance(source: ParsedEmailSource, specCandidateId: string | null): number {
  if (specCandidateId && source.candidateId === specCandidateId) return 4;
  if (source.speaker === "client" || source.speaker === "vendor") return 3;
  if (source.speaker === "founder") return 2;
  return 1;
}

function bestOnThread(
  sources: readonly ParsedEmailSource[],
  specCandidateId: string | null,
): ParsedEmailSource {
  return sources.reduce((best, row) => {
    const bestScore = relevance(best, specCandidateId);
    const rowScore = relevance(row, specCandidateId);
    if (rowScore > bestScore) return row;
    if (rowScore < bestScore) return best;
    return row.order >= best.order ? row : best;
  });
}

function uniqueByHref(rows: readonly CosOpenEmailSource[]): CosOpenEmailSource[] {
  const seen = new Set<string>();
  const out: CosOpenEmailSource[] = [];
  for (const row of rows) {
    if (seen.has(row.href)) continue;
    seen.add(row.href);
    out.push({ href: row.href, label: row.label });
  }
  return out;
}

export function selectRelatedEmailSources(
  input: SelectOpenEmailSourcesInput,
): CosOpenEmailSource[] {
  const parsed: ParsedEmailSource[] = [];
  for (const [index, beat] of input.beats.entries()) {
    const source = parseBeatSource(beat, index);
    if (source) parsed.push(source);
  }
  const real = parsed.filter((row) => !row.generated);
  const exact = exactConflictSource(input.conflictSourceHref, parsed);
  const exclude = new Set(exact ? [exact.href] : []);
  return uniqueByHref(
    real
      .filter((row) => !exclude.has(row.href))
      .map((row) => ({ href: row.href, label: row.label })),
  );
}

function pickRealSources(
  real: readonly ParsedEmailSource[],
  specCandidateId: string | null,
): CosOpenEmailSource[] {
  const grouped = new Map<string, ParsedEmailSource[]>();
  for (const row of real) {
    const list = grouped.get(row.threadId) ?? [];
    list.push(row);
    grouped.set(row.threadId, list);
  }
  if (grouped.size === 1) {
    const only = bestOnThread([...grouped.values()][0]!, specCandidateId);
    return uniqueByHref([only]);
  }
  return uniqueByHref(
    [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, rows]) => bestOnThread(rows, specCandidateId)),
  );
}

function exactConflictSource(
  href: string | null | undefined,
  parsed: readonly ParsedEmailSource[],
): CosOpenEmailSource | null {
  const trimmed = href?.trim() ?? "";
  if (!trimmed) return null;
  if (parsed.some((row) => row.href === trimmed && row.generated)) return null;
  return parseFallback(trimmed);
}

/**
 * Pick the Gmail source(s) that directly support the docket item.
 * Fail closed when the only available Gmail hrefs are synthesized operating mail.
 */
export function selectOpenEmailSources(
  input: SelectOpenEmailSourcesInput,
): CosOpenEmailSource[] {
  const specCandidateId = input.specCandidateId?.trim() || null;
  const conflictMode = input.conflictMode === true;
  const projectHint = canonicalThread(input.canonicalThreadId);
  const parsed: ParsedEmailSource[] = [];
  for (const [index, beat] of input.beats.entries()) {
    const source = parseBeatSource(beat, index);
    if (source) parsed.push(source);
  }

  const real = parsed.filter((row) => !row.generated);

  if (conflictMode) {
    const exact = exactConflictSource(input.conflictSourceHref, parsed);
    if (exact) return uniqueByHref([exact]);
    return [];
  }

  if (parsed.length > 0 && real.length === 0) return [];

  if (real.length > 0) {
    if (specCandidateId) {
      const specHits = real.filter((row) => row.candidateId === specCandidateId);
      if (specHits.length > 0) {
        const threadId = specHits[0]!.threadId;
        const onThread = real.filter((row) => row.threadId === threadId);
        return uniqueByHref([bestOnThread(onThread, specCandidateId)]);
      }
    }
    const hintIsReal =
      projectHint != null && real.some((row) => row.threadId === projectHint);
    const inScope = hintIsReal
      ? real.filter((row) => row.threadId === projectHint)
      : real;
    return pickRealSources(inScope, specCandidateId);
  }

  const fallback = input.fallbackHref?.trim() ?? "";
  if (!fallback) return [];
  const fromFallback = parseFallback(fallback);
  return fromFallback ? [fromFallback] : [];
}
