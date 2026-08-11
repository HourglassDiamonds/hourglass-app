/**
 * Concierge Lead SLA — non-PII types only.
 * Never store name, email, phone, message, or project notes.
 */

export const CONCIERGE_SLA_STATUSES = [
  "open",
  "completed",
  "abandoned",
  "setup_failed",
] as const;

export type ConciergeSlaStatus = (typeof CONCIERGE_SLA_STATUSES)[number];

export type ConciergeSlaRecord = {
  dealId: string;
  contactId: string | null;
  taskId: string | null;
  submissionId: string | null;
  submittedAt: string;
  dueAt: string;
  completedAt: string | null;
  immediateAlertedAt: string | null;
  dueSoonAlertedAt: string | null;
  overdueAlertedAt: string | null;
  lastCheckedAt: string | null;
  status: ConciergeSlaStatus;
  lastError: string | null;
  setupFailedComponent: string | null;
  taskRecoveryAttempts: number;
};

export type ConciergeSlaUpsertInput = {
  dealId: string;
  contactId?: string | null;
  taskId?: string | null;
  submissionId?: string | null;
  submittedAt: string;
  dueAt: string;
  status?: ConciergeSlaStatus;
  lastError?: string | null;
  setupFailedComponent?: string | null;
};

export type ConciergeSlaPatch = Partial<
  Pick<
    ConciergeSlaRecord,
    | "contactId"
    | "taskId"
    | "submissionId"
    | "completedAt"
    | "immediateAlertedAt"
    | "dueSoonAlertedAt"
    | "overdueAlertedAt"
    | "lastCheckedAt"
    | "status"
    | "lastError"
    | "setupFailedComponent"
    | "taskRecoveryAttempts"
  >
>;

export type ConciergeSlaStore = {
  upsertByDealId(input: ConciergeSlaUpsertInput): Promise<ConciergeSlaRecord>;
  getByDealId(dealId: string): Promise<ConciergeSlaRecord | null>;
  getBySubmissionId(submissionId: string): Promise<ConciergeSlaRecord | null>;
  listOpen(): Promise<ConciergeSlaRecord[]>;
  listOverdueOpen(nowIso: string): Promise<ConciergeSlaRecord[]>;
  patch(dealId: string, patch: ConciergeSlaPatch): Promise<ConciergeSlaRecord>;
};

export type ConciergeSlaSetupFailedComponent =
  | "ledger"
  | "task"
  | "task_association"
  | "due_timestamp"
  | "immediate_alert"
  | "unknown";

export const CONCIERGE_SLA_TASK_SUBJECT_PREFIX =
  "Respond to Concierge inquiry — Deal ";

export function conciergeSlaTaskSubject(dealId: string): string {
  return `${CONCIERGE_SLA_TASK_SUBJECT_PREFIX}${dealId}`;
}

export function isConciergeSlaTaskSubject(
  subject: string | null | undefined,
  dealId: string,
): boolean {
  if (!subject) return false;
  return subject.trim() === conciergeSlaTaskSubject(dealId);
}

/** Association type IDs from HubSpot CRM associations docs. */
export const HUBSPOT_TASK_TO_CONTACT_ASSOCIATION = 204;
export const HUBSPOT_TASK_TO_DEAL_ASSOCIATION = 216;

export const CONCIERGE_SLA_DUE_SOON_HOURS = 20;
export const CONCIERGE_SLA_DUE_HOURS = 24;
export const CONCIERGE_SLA_MAX_TASK_RECOVERY_ATTEMPTS = 5;

export const CONCIERGE_SLA_OVERDUE_RECOMMENDATION_ID =
  "concierge-sla:overdue-live";
