import { COS_FOUNDER_DISPLAY_NAME, SILENCE_REASON } from "../constants";
import type {
  AttentionItem,
  ChiefOfStaffBrief,
  ChiefOfStaffEmailView,
} from "../types";

function countPhrase(count: number): string {
  if (count === 1) return "One thing deserves your attention today.";
  if (count === 2) return "Two things deserve your attention today.";
  if (count === 3) return "Three things deserve your attention today.";
  return `${count} things deserve your attention today.`;
}

function formatItem(item: AttentionItem, index: number): string {
  return `${index + 1}. ${item.headline}\n   Why: ${item.whyItMatters}`;
}

function formatWorthKnowing(brief: ChiefOfStaffBrief): string[] {
  if (brief.worthKnowing.length === 0) return [];
  return [
    "Worth knowing",
    ...brief.worthKnowing.map((row) => row.headline),
  ];
}

/**
 * Pure Morning Email 2.0 renderer. Not connected to Resend.
 * Preserves brief attention order. Does not rank.
 */
export function renderMorningEmail(input: {
  brief: ChiefOfStaffBrief;
  items: AttentionItem[];
}): ChiefOfStaffEmailView {
  const byId = new Map(input.items.map((item) => [item.id, item]));
  const ordered = input.brief.attentionItemIds
    .map((id) => byId.get(id))
    .filter((item): item is AttentionItem => Boolean(item));

  const dateLabel = input.brief.localDate;
  const subject = `Hourglass Morning Brief · ${dateLabel}`;
  const lines = [`Good morning, ${COS_FOUNDER_DISPLAY_NAME}.`, ""];

  if (ordered.length === 0) {
    lines.push(input.brief.silenceReason ?? SILENCE_REASON);
    const worth = formatWorthKnowing(input.brief);
    if (worth.length) {
      lines.push("", ...worth);
    }
  } else {
    lines.push(countPhrase(ordered.length), "");
    for (const [index, item] of ordered.entries()) {
      lines.push(formatItem(item, index));
      if (index < ordered.length - 1) lines.push("");
    }
    const worth = formatWorthKnowing(input.brief);
    if (worth.length) {
      lines.push("", ...worth);
    }
    lines.push("", "No material action required elsewhere.");
  }

  return { subject, text: lines.join("\n") };
}
