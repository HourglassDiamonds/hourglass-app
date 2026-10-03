/** Presentation-only capture state. Shared wire contracts stay unchanged. */
import type {
  CaptureCommitInput,
  CaptureCommitItemResult,
  CaptureCommitResult,
  CaptureProposal,
  CaptureProposedItem,
  CaptureRequest,
  CaptureTiming,
} from "@/lib/continuum/capture/types";
import {
  isCaptureCommitInput,
  isCaptureCommitResult,
  isCaptureProposal,
  isCaptureProposedItem,
} from "@/lib/continuum/capture/validate";

export type CaptureActions = {
  proposeAction: (request: CaptureRequest) => Promise<CaptureProposal>;
  saveAction: (confirmation: CaptureCommitInput) => Promise<CaptureCommitResult>;
};

/** Display names from an authorized read model; never identity lookup or creation. */
export type CaptureEntityLabels = {
  people?: Readonly<Record<string, string>>;
  projects?: Readonly<Record<string, string>>;
};

export type CaptureReviewItem = {
  item: CaptureProposedItem;
  selected: boolean;
  mutationId?: string;
  result?: CaptureCommitItemResult;
};

export const CAPTURE_KIND_LABELS = {
  action: "Action",
  reminder: "Reminder",
  watching: "Watching",
  note: "Note",
  hold: "Hold",
} as const;

/** Keep advisory questions out of the mutation-review workflow. */
export function captureInputLooksLikeAdvisory(value: string): boolean {
  const text = value.trim().toLowerCase().replace(/[’']/g, "'");
  if (!text) return false;
  return (
    /^(?:what|who|which|when|where|why|how)\b/.test(text) ||
    /^(?:should|can|could|would|do|did|is|are|am)\s+(?:i|we|my|our|there)\b/.test(text) ||
    /\b(?:top|next)\s+(?:three|3)\b/.test(text) ||
    /\bwhat\s+am\s+i\s+missing\b/.test(text) ||
    text.endsWith("?")
  );
}

export function isSaved(row: CaptureReviewItem): boolean {
  return row.result?.status === "saved" || row.result?.status === "already-present";
}

export function reviewIssue(row: CaptureReviewItem): string | undefined {
  if (row.item.kind === "hold") return row.item.clarification?.question;
  const resolution = row.item.entityResolution;
  if (resolution?.status === "ambiguous") {
    return "Choose who or which project you mean by editing your capture and reviewing it again.";
  }
  if (resolution?.status === "unresolved") {
    return "This identity is not linked. Add more detail to your capture and review it again.";
  }
  if (row.item.clarification) return row.item.clarification.question;
  if (row.result?.status === "needs-review") return row.result.message;
  if (!isCaptureProposedItem(row.item)) return "Enter a title and content before saving.";
}

export function startReview(proposal: CaptureProposal, captureId: string): CaptureReviewItem[] {
  if (!isCaptureProposal(proposal) || proposal.captureId !== captureId) {
    throw new Error("Invalid capture proposal");
  }
  if (!proposal.items.length || proposal.items.some(item => item.confidence === 0 && item.clarification)) {
    throw new Error("Capture interpretation needs review; retry the original input");
  }
  return proposal.items.map((item) => {
    const row = { item, selected: false };
    return { ...row, selected: item.kind !== "hold" && !reviewIssue(row) };
  });
}

export function editReviewItem(
  row: CaptureReviewItem,
  patch: Partial<Pick<CaptureProposedItem, "title" | "content">>,
): CaptureReviewItem {
  if (isSaved(row)) return row;
  return {
    ...row,
    item: { ...row.item, ...patch },
    mutationId: undefined,
    result: undefined,
  };
}

export function prepareConfirmation(
  captureId: string,
  rows: readonly CaptureReviewItem[],
  uuid: () => string,
): { rows: CaptureReviewItem[]; input: CaptureCommitInput } {
  const selected = rows.filter((row) => row.selected && !isSaved(row));
  if (!selected.length || selected.some(reviewIssue)) {
    throw new Error("Review selected items before saving");
  }
  const prepared = rows.map((row) =>
    row.selected && !isSaved(row) ? { ...row, mutationId: row.mutationId ?? uuid() } : row,
  );
  const input: CaptureCommitInput = {
    version: 1,
    captureId,
    items: prepared.map((row) =>
      row.selected && !isSaved(row)
        ? {
            itemId: row.item.itemId,
            selected: true,
            mutationId: row.mutationId!,
            confirmedItem: row.item,
          }
        : { itemId: row.item.itemId, selected: false },
    ),
  };
  if (!isCaptureCommitInput(input)) throw new Error("Invalid capture confirmation");
  return { rows: prepared, input };
}

export function applyConfirmation(
  rows: readonly CaptureReviewItem[],
  input: CaptureCommitInput,
  result: CaptureCommitResult,
): CaptureReviewItem[] {
  const selectedIds = new Set(input.items.filter((row) => row.selected).map((row) => row.itemId));
  if (
    !isCaptureCommitResult(result) ||
    result.captureId !== input.captureId ||
    result.items.length !== selectedIds.size ||
    result.items.some((row) => !selectedIds.has(row.itemId))
  ) {
    throw new Error("Incomplete capture result");
  }
  return rows.map((row) => {
    const outcome = result.items.find((item) => item.itemId === row.item.itemId);
    if (!outcome) return row;
    const saved = outcome.status === "saved" || outcome.status === "already-present";
    return {
      ...row,
      result: outcome,
      selected: saved || outcome.status === "needs-review" ? false : row.selected,
    };
  });
}

export function captureTimingLabel(timing?: CaptureTiming): string {
  if (!timing || timing.kind === "unspecified") {
    return timing?.originalWording
      ? `Timing needs review: ${timing.originalWording}`
      : "No timing specified";
  }
  if (timing.kind === "date-only") {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${timing.date}T12:00:00Z`));
  }
  if (timing.kind === "exact-instant") {
    const formatted = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timing.timezone,
      timeZoneName: "short",
    }).format(new Date(timing.instantAt));
    return `${formatted} (${timing.timezone})`;
  }
  return `${timing.condition}${
    timing.checkAt ? ` · Check ${captureTimingLabel(timing.checkAt)}` : " · No check time specified"
  }`;
}
