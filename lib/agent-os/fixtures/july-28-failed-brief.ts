/**
 * Regression fixture: July 28, 2026 failed production Morning Brief shape.
 *
 * Captures the useless founder-facing output that was emailed:
 * - Today’s Call / Highest-ROI duplicated “no action required”
 * - No named priorities
 * - Decision without recommendation
 * - Vague sessions metric
 * - Adapter/debug language in Data confidence
 *
 * Used to prove quality gate + carry-forward + backlog hierarchy fixes.
 */

import type { FounderBrief } from "../types";
import type { OperatingBacklog } from "../operating-backlog/types";

/** Exact failed founder-facing copy pattern from July 28 production. */
export const JULY_28_FAILED_BRIEF: FounderBrief = {
  whatChanged: "No material day-over-day signal in available sources.",
  whyItMatters: "No high-confidence founder action required today.",
  needsAttentionToday: ["None"],
  highestRoiAction: "No high-confidence founder action required today.",
  canSafelyWait: ["None"],
  blocked: ["None"],
  founderDecisionNeeded: [
    "Whether to spend founder time on the highest-ROI action above before new experiments",
  ],
  missingOrUnreliableData: [
    "HubSpot / Buffer / GBP unavailable (not configured; not blocking unless a recommendation depends on them)",
    "Some sources unavailable; recommendations rely on repository and internal evidence.",
  ],
  markdown: "# Hourglass Morning Brief\n\nFailed July 28 shape",
  surfacedPriorityTitles: [],
  sprintOrientation: null,
  opportunityToWatch: "Sessions softened week-over-week",
};

/** Persistent sprint that should have carried forward on July 28. */
export const JULY_28_OPERATING_BACKLOG: OperatingBacklog = {
  schemaVersion: 1,
  masterSprint: {
    id: "hourglass-sprint-2026-w31",
    name: "Week of July 27 — Concierge clarity & measurement trust",
    objective:
      "Keep Concierge conversion paths clear and finish open Studio clarity work before new experiments.",
    dayOrientation:
      "Finish the Concierge conversion path before opening any new growth experiments.",
    affirmedLocalDate: "2026-07-27",
    items: [
      {
        id: "july28-concierge-cta",
        kind: "sprint-priority",
        title: "Confirm Concierge path from flagship content",
        action:
          "Verify that every primary CTA on the active Conversation and guide pages reaches Concierge with intact attribution parameters.",
        why: "Qualified viewers should reach Concierge without losing attribution.",
        expectedOutcome: "Three live CTAs verified with intact attribution (~20 min).",
        status: "active",
        urgency: "high",
        rank: 1,
        completionCondition: "Spot-check three live CTAs (~20 min).",
      },
      {
        id: "july28-studio-clarity",
        kind: "founder-action",
        title: "Clarify Studio engagement vs consultation ask",
        action:
          "Tighten Studio → Concierge wording so buyers know the next calm step.",
        why: "Studio interest without a clear handoff wastes high-intent attention.",
        expectedOutcome: "One clarity pass completed on Studio → Concierge copy.",
        status: "active",
        urgency: "high",
        rank: 2,
        completionCondition: "Complete one clarity pass (~45 min).",
      },
      {
        id: "july28-growth-decision",
        kind: "open-decision",
        title: "Whether to open new growth experiments this week",
        action: "Decide focus vs new experiments.",
        why: "New experiments dilute unfinished conversion-path work.",
        expectedOutcome: "Clear yes/no for the week.",
        status: "active",
        urgency: "medium",
        rank: 3,
        recommendedChoice:
          "Defer new growth experiments until Concierge CTA attribution and Studio clarity are finished.",
        costOfDelay:
          "Another week of traffic may reach Concierge without reliable attribution or a sufficiently clear next step.",
      },
    ],
  },
  deferred: [],
  recurring: [],
};

export const JULY_28_LOCAL_DATE = "2026-07-28";
