/**
 * Structured Concierge SLA observability — IDs/timestamps/status only.
 * Never log name, email, phone, customer message, or project notes.
 */

export type ConciergeSlaLogEvent =
  | "concierge_sla_created"
  | "concierge_sla_task_created"
  | "concierge_sla_task_recovered"
  | "concierge_sla_task_create_failed"
  | "concierge_sla_immediate_alert_sent"
  | "concierge_sla_due_soon"
  | "concierge_sla_overdue"
  | "concierge_sla_completed"
  | "concierge_sla_watchdog_failed"
  | "concierge_sla_setup_failed";

export type ConciergeSlaLogFields = {
  deal_id?: string;
  task_id?: string | null;
  submission_id?: string | null;
  due_at?: string;
  age_hours?: number;
  status?: string;
  component?: string;
  error?: string;
  recovered?: boolean;
  count?: number;
};

const FORBIDDEN_KEY =
  /email|phone|fullname|message|notes|inspiration|customer|fullname|firstname|lastname/i;

function sanitizeFields(
  fields: ConciergeSlaLogFields,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (FORBIDDEN_KEY.test(key)) continue;
    if (value === undefined) continue;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      value === null
    ) {
      out[key] = value;
    }
  }
  return out;
}

export function logConciergeSla(
  event: ConciergeSlaLogEvent,
  fields: ConciergeSlaLogFields = {},
): void {
  const payload = { event, ...sanitizeFields(fields) };
  if (
    event === "concierge_sla_setup_failed" ||
    event === "concierge_sla_watchdog_failed" ||
    event === "concierge_sla_task_create_failed"
  ) {
    console.error(`[${event}]`, payload);
    return;
  }
  console.info(`[${event}]`, payload);
}
