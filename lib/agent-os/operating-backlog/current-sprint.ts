/**
 * Current Hourglass master sprint — authoritative persistent priorities.
 * Updated when the founder completes, cancels, replaces, or defers work.
 * Do not invent evidence here; these are operational commitments.
 *
 * Completion awareness also hydrates from Agent OS persistence at run time.
 * Static statuses below are the default source of truth when persistence is empty.
 */

import type { OperatingBacklog } from "./types";

/**
 * Active Week 2 operating sprint (affirmed around July 27–28, 2026).
 * Drawn from ongoing Agent OS / Concierge / Studio / measurement commitments —
 * not from overnight adapter freshness.
 *
 * Reconciliation (2026-08-10, P0-3):
 * - Concierge CTA attribution: completed via 6d225b5 (shipped to production).
 * - Studio→Concierge handoff clarity: completed via 4cb9d3f (shipped to production).
 * - Charlotte guide hub titles: still open (Charlotte Guides still unmapped in category-map).
 * - Paid-search readiness: still open / deferred-due (review not performed).
 */
export const CURRENT_OPERATING_BACKLOG: OperatingBacklog = {
  schemaVersion: 1,
  masterSprint: {
    id: "hourglass-sprint-2026-w31",
    name: "Week of July 27 — Concierge clarity & measurement trust",
    objective:
      "Finish remaining local-authority and paid-readiness commitments after Concierge path and Studio handoff clarity shipped.",
    /**
     * Documentation-only default. At runtime, dayOrientation is always re-derived
     * from the reconciled active priority set (see deriveDayOrientationFromBacklog).
     */
    dayOrientation:
      "Strengthen Charlotte guide hub alignment before opening paid-search or new growth experiments.",
    affirmedLocalDate: "2026-08-10",
    items: [
      {
        id: "sprint-concierge-cta-path",
        kind: "sprint-priority",
        title: "Confirm Concierge path from flagship content",
        action:
          "Verify that every primary CTA on the active Conversation and guide pages reaches Concierge with intact attribution parameters.",
        why: "Qualified viewers should reach Concierge calmly without losing attribution.",
        expectedOutcome:
          "Every primary CTA lands in Concierge with intact attribution within one sitting.",
        status: "completed",
        urgency: "high",
        rank: 1,
        completionCondition:
          "Spot-check three live CTAs and confirm attribution params on the Concierge landing URL (~20 min).",
        linkedRecommendationId: null,
      },
      {
        id: "sprint-studio-consultation-clarity",
        kind: "founder-action",
        title: "Clarify Studio engagement vs consultation ask",
        action:
          "Tighten on-page copy that separates Diamond Studio exploration from the consultation request so buyers know the next calm step.",
        why: "Studio interest without a clear Concierge handoff wastes high-intent attention.",
        expectedOutcome:
          "Studio visitors see a single, calm next step into Concierge without pressure.",
        status: "completed",
        urgency: "high",
        rank: 2,
        completionCondition: "Complete one clarity pass on Studio → Concierge wording (~45 min).",
      },
      {
        id: "sprint-charlotte-guide-authority",
        kind: "founder-action",
        title: "Strengthen Charlotte guide hub titles",
        action:
          "Align the Charlotte engagement-ring guide hub H1 and intro with local intent without inventing GBP claims.",
        why: "Local authority pages remain an open search commitment from the current sprint.",
        expectedOutcome:
          "Hub title/intro match the query intent buyers actually use in Charlotte.",
        status: "active",
        urgency: "medium",
        rank: 3,
        completionCondition: "One title + intro edit committed and live (~30 min).",
      },
      {
        id: "decision-new-growth-experiments",
        kind: "open-decision",
        title: "Whether to open new growth experiments this week",
        action: "Decide whether to keep focus on remaining local-authority work or approve a new experiment.",
        why: "New experiments still dilute unfinished Charlotte hub and paid-readiness work.",
        expectedOutcome: "A clear yes/no so the team does not split attention.",
        status: "active",
        urgency: "medium",
        rank: 4,
        recommendedChoice:
          "Defer new growth experiments until Charlotte guide hub alignment is finished and paid-search readiness is explicitly reviewed.",
        costOfDelay:
          "Another week of divided attention delays the remaining local-authority commitment.",
        deadline: null,
      },
    ],
  },
  deferred: [
    {
      id: "deferred-paid-search-readiness",
      kind: "deferred-work",
      title: "Paid-search readiness review",
      action:
        "Revisit paid-search readiness only after organic Concierge paths and measurement trust are stable.",
      why: "Paid spend before path clarity risks buying traffic into an unclear handoff.",
      expectedOutcome: "A go/no-go on paid with trustworthy destination and conversion signal.",
      status: "deferred",
      urgency: "low",
      rank: 1,
      // Due since 2026-08-04 — Concierge path/Studio clarity are now complete;
      // the readiness review itself has not been performed.
      deferredUntil: "2026-08-04T00:00:00.000Z",
    },
  ],
  recurring: [
    {
      id: "recurring-morning-operating-review",
      kind: "recurring-obligation",
      title: "Morning operating review",
      action:
        "Scan unresolved sprint priorities, open decisions, and any material metric moves before approving new work.",
      why: "Daily cadence exists to protect focus, not to invent overnight urgency.",
      expectedOutcome: "Founder day starts from persistent commitments, not empty quiet-day copy.",
      status: "active",
      urgency: "medium",
      rank: 1,
      recurrence: "daily weekday 07:00 America/New_York",
      completionCondition: "Morning Brief reviewed; top action started or explicitly deferred.",
    },
  ],
};

export function activeBacklogItems(
  backlog: OperatingBacklog,
  nowIso = new Date().toISOString(),
): typeof backlog.masterSprint.items {
  const now = Date.parse(nowIso);
  const fromSprint = backlog.masterSprint.items.filter(
    (i) => i.status === "active" || i.status === "deferred",
  );
  const deferredDue = backlog.deferred.filter((i) => {
    if (i.status === "cancelled" || i.status === "completed") return false;
    if (!i.deferredUntil) return i.status === "active";
    return Date.parse(i.deferredUntil) <= now;
  });
  const recurring = backlog.recurring.filter((i) => i.status === "active");
  return [...fromSprint, ...deferredDue, ...recurring].sort(
    (a, b) => a.rank - b.rank,
  );
}
