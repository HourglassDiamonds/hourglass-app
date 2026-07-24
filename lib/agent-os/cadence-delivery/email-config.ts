/**
 * Agent OS founder email configuration — validated, redacted, never logged raw.
 *
 * Deterministic fallback (no partial mixing of Agent OS + intelligence pairs):
 * 1. AGENT_OS_EMAIL_FROM + AGENT_OS_EMAIL_TO (complete pair)
 * 2. INTELLIGENCE_EMAIL_FROM + INTELLIGENCE_EMAIL_TO (complete pair)
 * 3. fail closed
 */

import {
  getIntelligenceEmailFrom,
  getIntelligenceEmailTo,
  getResendApiKey,
} from "@/lib/intelligence/env";
import { AgentOsPersistenceError } from "../persistence/types";
import { buildRecipientConfigFingerprint } from "./fingerprint";

export type AgentOsEmailConfig = {
  apiKey: string;
  from: string;
  to: string;
  recipientAlias: string;
  recipientConfigFingerprint: string;
  /** Safe label for logs — never the address itself. */
  configSource: "agent-os" | "intelligence" | "override";
};

function trimmedEnv(name: string): string | undefined {
  if (name === "AGENT_OS_EMAIL_FROM") {
    return process.env.AGENT_OS_EMAIL_FROM?.trim() || undefined;
  }
  if (name === "AGENT_OS_EMAIL_TO") {
    return process.env.AGENT_OS_EMAIL_TO?.trim() || undefined;
  }
  if (name === "AGENT_OS_RECIPIENT_ALIAS") {
    return process.env.AGENT_OS_RECIPIENT_ALIAS?.trim() || undefined;
  }
  return undefined;
}

function missingKeysMessage(keys: string[]): string {
  return `Missing configuration key(s): ${keys.join(", ")}`;
}

/**
 * Resolve email config for Agent OS delivery.
 * Fails closed when any required value is missing. Never mixes Agent OS from
 * with intelligence to (or vice versa).
 */
export function resolveAgentOsEmailConfig(options?: {
  override?: Partial<{
    apiKey: string;
    from: string;
    to: string;
    recipientAlias: string;
  }>;
}): AgentOsEmailConfig {
  const apiKey = options?.override?.apiKey ?? getResendApiKey();
  if (!apiKey) {
    throw new AgentOsPersistenceError(
      "unconfigured",
      missingKeysMessage(["RESEND_API_KEY"]),
    );
  }

  const recipientAlias =
    options?.override?.recipientAlias ??
    trimmedEnv("AGENT_OS_RECIPIENT_ALIAS") ??
    "founder";

  // Explicit test/harness override — both from+to required together
  if (
    options?.override?.from !== undefined ||
    options?.override?.to !== undefined
  ) {
    const from = options.override.from?.trim();
    const to = options.override.to?.trim();
    const missing: string[] = [];
    if (!from) missing.push("override.from");
    if (!to) missing.push("override.to");
    if (missing.length) {
      throw new AgentOsPersistenceError(
        "unconfigured",
        missingKeysMessage(missing),
      );
    }
    return {
      apiKey,
      from: from!,
      to: to!,
      recipientAlias,
      configSource: "override",
      recipientConfigFingerprint: buildRecipientConfigFingerprint({
        recipientAlias,
        configSource: "override",
        fromConfigured: true,
        toConfigured: true,
      }),
    };
  }

  const agentFrom = trimmedEnv("AGENT_OS_EMAIL_FROM");
  const agentTo = trimmedEnv("AGENT_OS_EMAIL_TO");
  if (agentFrom || agentTo) {
    const missing: string[] = [];
    if (!agentFrom) missing.push("AGENT_OS_EMAIL_FROM");
    if (!agentTo) missing.push("AGENT_OS_EMAIL_TO");
    if (missing.length) {
      throw new AgentOsPersistenceError(
        "unconfigured",
        missingKeysMessage(missing) +
          " — partial Agent OS email pair refused (no mixing with intelligence)",
      );
    }
    return {
      apiKey,
      from: agentFrom!,
      to: agentTo!,
      recipientAlias,
      configSource: "agent-os",
      recipientConfigFingerprint: buildRecipientConfigFingerprint({
        recipientAlias,
        configSource: "agent-os",
        fromConfigured: true,
        toConfigured: true,
      }),
    };
  }

  const intelFrom = getIntelligenceEmailFrom();
  const intelTo = getIntelligenceEmailTo();
  if (intelFrom || intelTo) {
    const missing: string[] = [];
    if (!intelFrom) missing.push("INTELLIGENCE_EMAIL_FROM");
    if (!intelTo) missing.push("INTELLIGENCE_EMAIL_TO");
    if (missing.length) {
      throw new AgentOsPersistenceError(
        "unconfigured",
        missingKeysMessage(missing) +
          " — partial intelligence email pair refused",
      );
    }
    return {
      apiKey,
      from: intelFrom!,
      to: intelTo!,
      recipientAlias,
      configSource: "intelligence",
      recipientConfigFingerprint: buildRecipientConfigFingerprint({
        recipientAlias,
        configSource: "intelligence",
        fromConfigured: true,
        toConfigured: true,
      }),
    };
  }

  throw new AgentOsPersistenceError(
    "unconfigured",
    missingKeysMessage([
      "AGENT_OS_EMAIL_FROM",
      "AGENT_OS_EMAIL_TO",
      "INTELLIGENCE_EMAIL_FROM",
      "INTELLIGENCE_EMAIL_TO",
    ]),
  );
}

export function isAgentOsEmailConfigured(): boolean {
  try {
    resolveAgentOsEmailConfig();
    return true;
  } catch {
    return false;
  }
}
