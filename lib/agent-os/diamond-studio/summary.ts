/**
 * Studio activity summary. Counts and shape popularity only.
 * Never invents a person, email, or CRM identity.
 */

import type {
  StudioActivitySummary,
  StudioAgentAnonymousEvent,
} from "./types";

export function summarizeStudioActivity(
  events: readonly StudioAgentAnonymousEvent[],
): StudioActivitySummary {
  const shapeCounts = new Map<string, number>();
  let snapshotCount = 0;
  let shareCount = 0;
  let cardCount = 0;
  let emailedCount = 0;

  for (const event of events) {
    shapeCounts.set(
      event.configuration.shape,
      (shapeCounts.get(event.configuration.shape) ?? 0) + 1,
    );
    if (event.event === "studio_snapshot_created") snapshotCount += 1;
    if (event.event === "studio_share_card_created") {
      cardCount += 1;
      snapshotCount += 1;
    }
    if (
      event.event === "studio_snapshot_shared" ||
      event.event === "diamond_studio_share"
    ) {
      shareCount += 1;
    }
    if (event.event === "studio_view_emailed") emailedCount += 1;
  }

  const popularShapes = [...shapeCounts.entries()]
    .map(([shape, count]) => ({ shape, count }))
    .sort((a, b) => b.count - a.count || a.shape.localeCompare(b.shape));

  const materialSignals: string[] = [];
  if (snapshotCount >= 2) {
    materialSignals.push("Repeated snapshot creation on anonymous sessions");
  }
  if (cardCount >= 1 && shareCount >= 1) {
    materialSignals.push("Share-card activity without established identity");
  }
  if (emailedCount >= 1) {
    materialSignals.push(
      `${emailedCount} identified visitor${emailedCount === 1 ? "" : "s"} emailed a Studio configuration`,
    );
  }

  return {
    eventCount: events.length,
    snapshotCount,
    shareCount,
    cardCount,
    emailedCount,
    popularShapes,
    materialSignals,
    identityInvented: false,
    notes: [
      "Summary is anonymous. Do not attach a contact unless a legitimate identity event exists.",
    ],
  };
}
