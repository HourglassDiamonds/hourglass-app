/**
 * Persistent operating backlog / master sprint for Morning Brief.
 * Authoritative across days until completed, cancelled, replaced, or deferred.
 * Fresh adapter evidence enriches — it does not erase this context.
 */

export type BacklogItemStatus =
  | "active"
  | "deferred"
  | "completed"
  | "cancelled"
  | "replaced";

export type BacklogItemKind =
  | "sprint-priority"
  | "founder-action"
  | "open-decision"
  | "deferred-work"
  | "recurring-obligation";

/**
 * Founder-attention band. Independent of status / deferredUntil.
 * A past-due watch item stays watch until management promotes it.
 */
export type SurfacePolicy = "founder-now" | "watch" | "background";

export type OperatingBacklogItem = {
  id: string;
  kind: BacklogItemKind;
  title: string;
  /** Concrete founder action or decision framing. */
  action: string;
  /** Why this remains on the agenda. */
  why: string;
  /** Expected outcome when completed. */
  expectedOutcome: string;
  status: BacklogItemStatus;
  urgency: "critical" | "high" | "medium" | "low";
  /**
   * Founder-attention band. Omit only on historical fixtures —
   * resolveSurfacePolicy supplies compatible defaults.
   */
  surfacePolicy?: SurfacePolicy;
  /**
   * Today’s Call orientation when this item is the top founder-now priority.
   * Must not duplicate the Highest-ROI action line.
   */
  orientation?: string | null;
  /** Compact Watch / No Action line for the daily email. */
  watchLine?: string | null;
  /** Rank within kind (1 = highest). */
  rank: number;
  /** Optional completion condition or time box. */
  completionCondition?: string | null;
  /** ISO date when deferred until, if deferred. */
  deferredUntil?: string | null;
  /** Decision recommendation when kind is open-decision. */
  recommendedChoice?: string | null;
  costOfDelay?: string | null;
  deadline?: string | null;
  /** Recurring cadence hint, e.g. "weekly Monday". */
  recurrence?: string | null;
  /** Linked Agent OS recommendation ID when known. */
  linkedRecommendationId?: string | null;
};

export type MasterSprint = {
  id: string;
  name: string;
  /** One-line sprint objective. */
  objective: string;
  /**
   * Optional founder-facing Today’s Call orientation for the Morning Brief.
   * Must state the day’s job without duplicating the Highest-ROI concrete move.
   */
  dayOrientation?: string | null;
  /** America/New_York local date the sprint was last affirmed. */
  affirmedLocalDate: string;
  items: OperatingBacklogItem[];
};

export type OperatingBacklog = {
  schemaVersion: 1;
  masterSprint: MasterSprint;
  /** Explicitly deferred work kept visible until due or cancelled. */
  deferred: OperatingBacklogItem[];
  /** Recurring obligations / deadlines. */
  recurring: OperatingBacklogItem[];
};
