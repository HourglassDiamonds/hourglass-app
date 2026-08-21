/**
 * Operational exception signals for Diamond Studio Agent.
 * Surface failures, not routine traffic. Never include recipient PII.
 */

import { isStudioViewEmailConfigured } from "@/lib/diamond-studio/email-view/send";
import { memoryFallbackAllowed } from "@/lib/diamond-studio/email-view/store";

export const STUDIO_OPERATIONAL_SIGNAL_TYPES = [
  "identified-event-persistence-failed",
  "identified-event-persistence-healthy",
  "snapshot-generation-failure",
  "visitor-email-sender-unavailable",
] as const;

export type StudioOperationalSignalType =
  (typeof STUDIO_OPERATIONAL_SIGNAL_TYPES)[number];

export type StudioOperationalSignal = {
  type: StudioOperationalSignalType;
  timestamp: string;
  /** Count of emails that already sent when persistence failed. Never PII. */
  emailsSent?: number;
};

const signals: StudioOperationalSignal[] = [];

export function resetStudioOperationalSignals(): void {
  signals.length = 0;
}

export function recordStudioOperationalSignal(
  signal: StudioOperationalSignal,
): void {
  signals.push(signal);
}

export function listStudioOperationalSignals(): StudioOperationalSignal[] {
  return [...signals];
}

export type StudioOperationalCheckId =
  | "identified-event-persistence"
  | "visitor-email-sender"
  | "snapshot-generation";

export type StudioOperationalCheck = {
  id: StudioOperationalCheckId;
  ok: boolean;
  detail: string;
};

export type StudioOperationalHealthReport = {
  healthy: boolean;
  checks: StudioOperationalCheck[];
  exceptions: string[];
  containsPii: false;
};

const PII_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;

export function summarizeStudioOperationalExceptions(
  input: readonly StudioOperationalSignal[] = listStudioOperationalSignals(),
): { exceptions: string[]; containsPii: false } {
  const persistenceFailures = input.filter(
    (s) => s.type === "identified-event-persistence-failed",
  );
  const snapshotFailures = input.filter(
    (s) => s.type === "snapshot-generation-failure",
  );
  const senderUnavailable = input.filter(
    (s) => s.type === "visitor-email-sender-unavailable",
  );
  const persistenceHealthy = input.some(
    (s) => s.type === "identified-event-persistence-healthy",
  );

  const exceptions: string[] = [];

  if (persistenceFailures.length > 0) {
    const sent = persistenceFailures.reduce(
      (sum, s) => sum + (s.emailsSent ?? 1),
      0,
    );
    exceptions.push(
      `${sent} successful Studio email${sent === 1 ? " was" : "s were"} sent, but identified-event persistence failed.`,
    );
  } else if (persistenceHealthy) {
    /* healthy is not an exception */
  }

  if (snapshotFailures.length > 0) {
    exceptions.push("Snapshot generation failed in the Studio runtime.");
  }
  if (senderUnavailable.length > 0) {
    exceptions.push("Visitor email sender is unavailable.");
  }

  const blob = exceptions.join(" ");
  if (PII_PATTERN.test(blob)) {
    return {
      exceptions: ["Operational summary refused because it contained PII."],
      containsPii: false,
    };
  }

  return { exceptions, containsPii: false };
}

export function evaluateStudioOperationalConfig(
  env: NodeJS.ProcessEnv = process.env,
): StudioOperationalHealthReport {
  const senderOk = isStudioViewEmailConfigured(env);
  const supabaseOk = Boolean(
    env.SUPABASE_URL?.trim() && env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
  const durableRequired = !memoryFallbackAllowed(env);
  const persistenceOk = durableRequired ? supabaseOk : true;

  const checks: StudioOperationalCheck[] = [
    {
      id: "visitor-email-sender",
      ok: senderOk,
      detail: senderOk
        ? "STUDIO_VIEW_EMAIL_FROM + RESEND_API_KEY present"
        : "Visitor email sender unavailable",
    },
    {
      id: "identified-event-persistence",
      ok: persistenceOk,
      detail: durableRequired
        ? supabaseOk
          ? "Supabase adapter configured for durable identified events"
          : "Durable persistence required but Supabase is unavailable"
        : "Memory fallback allowed in development/tests",
    },
    {
      id: "snapshot-generation",
      ok: true,
      detail: "Runtime snapshot health is proven by the live snapshot route, not this config check",
    },
  ];

  const fromSignals = summarizeStudioOperationalExceptions();
  const exceptions = [
    ...checks.filter((c) => !c.ok).map((c) => c.detail),
    ...fromSignals.exceptions,
  ];

  return {
    healthy: checks.every((c) => c.ok) && fromSignals.exceptions.length === 0,
    checks,
    exceptions,
    containsPii: false,
  };
}
