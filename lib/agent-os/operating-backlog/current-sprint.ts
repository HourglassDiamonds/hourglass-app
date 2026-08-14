/**
 * Current Hourglass master sprint — authoritative persistent priorities.
 * Updated when the founder completes, cancels, replaces, or defers work.
 * Do not invent evidence here; these are operational commitments.
 *
 * Completion awareness also hydrates from Agent OS persistence at run time.
 * Static statuses below are the default source of truth when persistence is empty.
 *
 * Surface policy (founder-now / watch / background) controls founder attention.
 * Status and deferredUntil do not promote an item into Today’s Call / Highest-ROI /
 * Top Priorities. A past-due watch item remains watch until intentionally promoted.
 */

import type { OperatingBacklog } from "./types";

/**
 * Reconciliation (2026-08-14, P1-QA-1):
 * - Website / Engineering QA specialist is operational (activation completed).
 * - Authority / Case Study production is strategically paused (Watch) — inventory intact.
 * - No current founder-now item. Quiet day is valid.
 * - Charlotte hub, paid-search, Weddington, authority outreach, Size Studio: watch.
 * - Stale “defer experiments until Charlotte + paid-search” decision: cancelled.
 */
export const CURRENT_OPERATING_BACKLOG: OperatingBacklog = {
  schemaVersion: 1,
  masterSprint: {
    id: "hourglass-sprint-2026-w33",
    name: "Week of August 14 — operating watch",
    objective:
      "Website / Engineering QA is operational and silent when healthy. Case Study production remains intact on Watch.",
    /**
     * Documentation-only default. At runtime, dayOrientation is always re-derived
     * from founder-now items (see deriveDayOrientationFromBacklog).
     */
    dayOrientation:
      "Protect conversion gains. No additional founder-now work is queued today.",
    affirmedLocalDate: "2026-08-14",
    items: [
      {
        id: "sprint-activate-website-qa",
        kind: "sprint-priority",
        title: "Activate the Website / Engineering QA health specialist",
        action:
          "Activate the Website / Engineering QA health specialist as a silent production-health capability under Business Intelligence.",
        why: "Authority / Case Study work is strategically paused while remaining Agent OS specialists are activated. Production health must be known without becoming a website-improvement generator.",
        expectedOutcome:
          "QA specialist is operational: healthy production stays silent; only material exceptions reach the founder.",
        status: "completed",
        urgency: "high",
        rank: 1,
        surfacePolicy: "founder-now",
        orientation:
          "Protect conversion gains. No additional founder-now work is queued today.",
        completionCondition:
          "Specialist ships GREEN-only; healthy production emits zero founder QA tasks.",
        linkedRecommendationId: null,
      },
      {
        id: "sprint-case-study-production",
        kind: "sprint-priority",
        title: "Advance the next client Case Study",
        action:
          "Advance the next client Case Study as Hourglass's primary sales-proof and publishing asset.",
        why: "Case Studies remain the publishing and proof engine — strategically paused, not cancelled.",
        expectedOutcome:
          "The next real client Case Study moves forward when founder resumes Case Study production.",
        status: "active",
        urgency: "low",
        rank: 2,
        surfacePolicy: "watch",
        watchLine: "Case Study production — paused by founder; inventory intact",
        orientation:
          "Protect conversion gains. Use the day for Case Study production, not leftover local-guide work.",
        completionCondition:
          "Start or continue the next real client Case Study; do not invent client geography.",
        linkedRecommendationId: null,
      },
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
        rank: 2,
        surfacePolicy: "founder-now",
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
        rank: 3,
        surfacePolicy: "founder-now",
        completionCondition: "Complete one clarity pass on Studio → Concierge wording (~45 min).",
      },
      {
        id: "watch-size-studio-measurement",
        kind: "founder-action",
        title: "Size Studio measurement hold",
        action:
          "Leave Size Studio unchanged until post-change measurement provides evidence for another pass.",
        why: "P1-CONV-2 is closed and production verified. Further Size Studio edits would be speculative.",
        expectedOutcome:
          "Size Studio stays measure-only until evidence justifies more work.",
        status: "active",
        urgency: "low",
        rank: 4,
        surfacePolicy: "watch",
        watchLine: "Size Studio — measure only",
      },
      {
        id: "watch-authority-outreach-wave",
        kind: "founder-action",
        title: "Current authority outreach wave",
        action:
          "Follow up on the current authority outreach wave only when the 5–7 business-day window is due — no new cold spray.",
        why: "The current wave is in a waiting / follow-up window, not a new outreach sprint.",
        expectedOutcome:
          "Existing outreach is followed up in window; no additional spray is opened.",
        status: "active",
        urgency: "low",
        rank: 5,
        surfacePolicy: "watch",
        watchLine: "Current authority outreach — waiting for follow-up window",
      },
      {
        id: "watch-weddington-prominence",
        kind: "founder-action",
        title: "Weddington prominence monitoring",
        action:
          "Monitor Weddington prominence via monthly Local Falcon; take selective action only if measurement shows a real move.",
        why: "Local prominence is monitoring, not recurring local-SEO busywork.",
        expectedOutcome:
          "Weddington stays on a monthly measurement cadence without daily SEO tasks.",
        status: "active",
        urgency: "low",
        rank: 6,
        surfacePolicy: "watch",
        watchLine: "Weddington prominence — monitoring",
      },
      {
        id: "sprint-charlotte-guide-authority",
        kind: "founder-action",
        title: "Strengthen Charlotte guide hub titles",
        action:
          "Align the Charlotte engagement-ring guide hub H1 and intro with local intent without inventing GBP claims.",
        why: "Local authority pages remain valid backlog work, but they are not the current highest-ROI founder job.",
        expectedOutcome:
          "Hub title/intro match the query intent buyers actually use in Charlotte.",
        status: "active",
        urgency: "medium",
        rank: 7,
        surfacePolicy: "watch",
        watchLine: "Charlotte guide hub — valid, not current founder priority",
        completionCondition: "One title + intro edit committed and live (~30 min).",
      },
      {
        id: "decision-new-growth-experiments",
        kind: "open-decision",
        title: "Whether to open new growth experiments this week",
        action:
          "Decide whether to keep focus on remaining local-authority work or approve a new experiment.",
        why: "This gate assumed Charlotte hub and paid-search still outranked current conversion and Case Study work.",
        expectedOutcome: "A clear yes/no so the team does not split attention.",
        status: "cancelled",
        urgency: "medium",
        rank: 8,
        surfacePolicy: "background",
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
      why: "Paid-search readiness remains open but is not the current founder priority. An expired deferredUntil date must not auto-promote it.",
      expectedOutcome:
        "A go/no-go on paid with trustworthy destination and conversion signal.",
      status: "deferred",
      urgency: "low",
      rank: 1,
      surfacePolicy: "watch",
      watchLine: "Paid-search readiness — open, not current priority",
      // Historical due date — must remain Watch, not founder-now.
      deferredUntil: "2026-08-04T00:00:00.000Z",
    },
    {
      id: "background-search-geo-infra",
      kind: "deferred-work",
      title: "Search/GEO infrastructure",
      action: "Leave Search/GEO infrastructure in operational monitoring unless a real blocker appears.",
      why: "Search/GEO infrastructure is operational — not a daily founder build item.",
      expectedOutcome: "Infrastructure stays available without consuming founder attention.",
      status: "deferred",
      urgency: "low",
      rank: 2,
      surfacePolicy: "background",
    },
    {
      id: "background-geo-expansion",
      kind: "deferred-work",
      title: "Geographic expansion beyond Weddington",
      action: "Hold geographic expansion beyond Weddington until current local monitoring justifies it.",
      why: "Expansion is a later growth move, not current founder-now work.",
      expectedOutcome: "Expansion remains available as background context.",
      status: "deferred",
      urgency: "low",
      rank: 3,
      surfacePolicy: "background",
    },
    {
      id: "background-backlink-recovery",
      kind: "deferred-work",
      title: "Evidence-driven backlink recovery",
      action: "Keep evidence-driven backlink recovery in background until a demonstrated blocker or recovery case exists.",
      why: "Technical cleanup is not the current revenue-proximate job.",
      expectedOutcome: "Backlink recovery remains available without daily surfacing.",
      status: "deferred",
      urgency: "low",
      rank: 4,
      surfacePolicy: "background",
    },
    {
      id: "background-ledger-ftm",
      kind: "deferred-work",
      title: "Ledger Financial Transmission Monitor",
      action: "Keep Ledger / Financial Transmission Monitor in background unless a genuine blocker appears.",
      why: "Ledger work is not current founder-now attention.",
      expectedOutcome: "Ledger remains available as background operating context.",
      status: "deferred",
      urgency: "low",
      rank: 5,
      surfacePolicy: "background",
    },
    {
      id: "background-agent-infra",
      kind: "deferred-work",
      title: "Additional agent / infrastructure work",
      action: "Do not open additional agent or infrastructure work unless a real operating blocker appears.",
      why: "Extra agent/infrastructure work must not outrank Case Studies or conversion protection.",
      expectedOutcome: "Additional infrastructure stays background until promoted.",
      status: "deferred",
      urgency: "low",
      rank: 6,
      surfacePolicy: "background",
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
      expectedOutcome:
        "Founder day starts from persistent commitments, not empty quiet-day copy.",
      status: "active",
      urgency: "medium",
      rank: 1,
      surfacePolicy: "background",
      recurrence: "daily weekday 07:00 America/New_York",
      completionCondition:
        "Morning Brief reviewed; top action started or explicitly deferred.",
    },
  ],
};

/**
 * Non-terminal items currently in play for hydration / inspection.
 * Does not imply founder-now. Deferred-due watch items remain listed here
 * so they are not silently dropped — surfacing is decided by surfacePolicy.
 */
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
    if (i.status === "replaced") return false;
    if (!i.deferredUntil) return i.status === "active";
    return Date.parse(i.deferredUntil) <= now;
  });
  const recurring = backlog.recurring.filter((i) => i.status === "active");
  return [...fromSprint, ...deferredDue, ...recurring].sort(
    (a, b) => a.rank - b.rank,
  );
}
