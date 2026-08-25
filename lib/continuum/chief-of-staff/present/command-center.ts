import { conciergeClientPath } from "@/lib/continuum/client-memory/read/presentation";
import { SILENCE_REASON } from "../constants";
import type {
  AttentionItem,
  ChiefOfStaffBrief,
  ChiefOfStaffCommandCenterView,
} from "../types";

function headingForCount(count: number): string {
  if (count === 0) return SILENCE_REASON;
  if (count === 1) return "1 thing deserves your attention.";
  return `${count} things deserve your attention.`;
}

/**
 * Pure Command Center mapper. Does not rank. Does not load production UI.
 */
export function presentCommandCenter(input: {
  brief: ChiefOfStaffBrief;
  items: AttentionItem[];
}): ChiefOfStaffCommandCenterView {
  const byId = new Map(input.items.map((item) => [item.id, item]));
  const ordered = input.brief.attentionItemIds
    .map((id) => byId.get(id))
    .filter((item): item is AttentionItem => Boolean(item));

  return {
    status: ordered.length === 0 ? "quiet" : "active",
    heading: headingForCount(ordered.length),
    items: ordered.map((item) => ({
      id: item.id,
      headline: item.headline,
      why: item.whyItMatters,
      href: item.personId ? conciergeClientPath(item.personId) : undefined,
    })),
    worthKnowing: [...input.brief.worthKnowing],
  };
}
