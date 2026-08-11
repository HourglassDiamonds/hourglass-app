/**
 * Concierge SLA / lead-alert email configuration — server-only.
 *
 * Preferred order (never mix from/to across pairs):
 * 1. CONCIERGE_ALERT_EMAIL_FROM + CONCIERGE_ALERT_EMAIL_TO
 * 2. AGENT_OS_EMAIL_FROM + AGENT_OS_EMAIL_TO (documented founder fallback)
 * 3. INTELLIGENCE_EMAIL_FROM + INTELLIGENCE_EMAIL_TO (documented fallback)
 * 4. fail closed — no silent send
 *
 * Always requires RESEND_API_KEY. Never read NEXT_PUBLIC_* values.
 */

import {
  getIntelligenceEmailFrom,
  getIntelligenceEmailTo,
  getResendApiKey,
} from "@/lib/intelligence/env";
import { buildRecipientConfigFingerprint } from "@/lib/agent-os/cadence-delivery/fingerprint";
import type { AgentOsEmailConfig } from "@/lib/agent-os/cadence-delivery/email-config";

export type ConciergeAlertConfigSource =
  | "concierge-alert"
  | "agent-os-fallback"
  | "intelligence-fallback";

export type ConciergeAlertEmailConfig = AgentOsEmailConfig & {
  alertConfigSource: ConciergeAlertConfigSource;
};

export class ConciergeAlertConfigError extends Error {
  readonly missingKeys: string[];

  constructor(missingKeys: string[], detail?: string) {
    super(
      `Missing Concierge alert configuration key(s): ${missingKeys.join(", ")}${
        detail ? ` — ${detail}` : ""
      }`,
    );
    this.name = "ConciergeAlertConfigError";
    this.missingKeys = missingKeys;
  }
}

function trimmed(name: string, env: NodeJS.ProcessEnv): string | undefined {
  const value = env[name]?.trim();
  return value || undefined;
}

function asSenderConfig(input: {
  apiKey: string;
  from: string;
  to: string;
  alertConfigSource: ConciergeAlertConfigSource;
  recipientAlias: string;
}): ConciergeAlertEmailConfig {
  return {
    apiKey: input.apiKey,
    from: input.from,
    to: input.to,
    recipientAlias: input.recipientAlias,
    configSource: "override",
    alertConfigSource: input.alertConfigSource,
    recipientConfigFingerprint: buildRecipientConfigFingerprint({
      recipientAlias: input.recipientAlias,
      configSource: "override",
      fromConfigured: true,
      toConfigured: true,
    }),
  };
}

/**
 * Resolve Resend delivery config for Concierge SLA / lead alerts.
 * Fails closed when no complete usable pair exists.
 */
export function resolveConciergeAlertEmailConfig(
  env: NodeJS.ProcessEnv = process.env,
): ConciergeAlertEmailConfig {
  // Prefer the provided env bag (tests / explicit overrides). Ambient process
  // helpers apply only when resolving against process.env itself.
  const ambient = Object.is(env, process.env);
  const apiKey =
    trimmed("RESEND_API_KEY", env) ?? (ambient ? getResendApiKey() : undefined);
  if (!apiKey) {
    throw new ConciergeAlertConfigError(["RESEND_API_KEY"]);
  }

  const recipientAlias =
    trimmed("CONCIERGE_ALERT_RECIPIENT_ALIAS", env) ||
    trimmed("AGENT_OS_RECIPIENT_ALIAS", env) ||
    "founder";

  const conciergeFrom = trimmed("CONCIERGE_ALERT_EMAIL_FROM", env);
  const conciergeTo = trimmed("CONCIERGE_ALERT_EMAIL_TO", env);
  if (conciergeFrom || conciergeTo) {
    const missing: string[] = [];
    if (!conciergeFrom) missing.push("CONCIERGE_ALERT_EMAIL_FROM");
    if (!conciergeTo) missing.push("CONCIERGE_ALERT_EMAIL_TO");
    if (missing.length) {
      throw new ConciergeAlertConfigError(
        missing,
        "partial Concierge alert pair refused (no mixing with Agent OS / intelligence)",
      );
    }
    return asSenderConfig({
      apiKey,
      from: conciergeFrom!,
      to: conciergeTo!,
      alertConfigSource: "concierge-alert",
      recipientAlias,
    });
  }

  const agentFrom = trimmed("AGENT_OS_EMAIL_FROM", env);
  const agentTo = trimmed("AGENT_OS_EMAIL_TO", env);
  if (agentFrom || agentTo) {
    const missing: string[] = [];
    if (!agentFrom) missing.push("AGENT_OS_EMAIL_FROM");
    if (!agentTo) missing.push("AGENT_OS_EMAIL_TO");
    if (missing.length) {
      throw new ConciergeAlertConfigError(
        missing,
        "partial Agent OS email pair refused as Concierge alert fallback",
      );
    }
    return asSenderConfig({
      apiKey,
      from: agentFrom!,
      to: agentTo!,
      alertConfigSource: "agent-os-fallback",
      recipientAlias,
    });
  }

  const intelFrom =
    trimmed("INTELLIGENCE_EMAIL_FROM", env) ??
    (ambient ? getIntelligenceEmailFrom() : undefined);
  const intelTo =
    trimmed("INTELLIGENCE_EMAIL_TO", env) ??
    (ambient ? getIntelligenceEmailTo() : undefined);
  if (intelFrom || intelTo) {
    const missing: string[] = [];
    if (!intelFrom) missing.push("INTELLIGENCE_EMAIL_FROM");
    if (!intelTo) missing.push("INTELLIGENCE_EMAIL_TO");
    if (missing.length) {
      throw new ConciergeAlertConfigError(
        missing,
        "partial intelligence email pair refused as Concierge alert fallback",
      );
    }
    return asSenderConfig({
      apiKey,
      from: intelFrom!,
      to: intelTo!,
      alertConfigSource: "intelligence-fallback",
      recipientAlias,
    });
  }

  throw new ConciergeAlertConfigError([
    "CONCIERGE_ALERT_EMAIL_FROM",
    "CONCIERGE_ALERT_EMAIL_TO",
    "AGENT_OS_EMAIL_FROM",
    "AGENT_OS_EMAIL_TO",
    "INTELLIGENCE_EMAIL_FROM",
    "INTELLIGENCE_EMAIL_TO",
  ]);
}

export function isConciergeAlertEmailConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  try {
    resolveConciergeAlertEmailConfig(env);
    return true;
  } catch {
    return false;
  }
}
