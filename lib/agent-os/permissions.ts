import type { ProhibitedAction } from "./types";
import { V1_PROHIBITED_ACTIONS } from "./types";

export type ConnectorCapability = "read-only" | "write-capable";

export type ConnectorRegistration = {
  id: string;
  capability: ConnectorCapability;
  description: string;
};

const registeredConnectors = new Map<string, ConnectorRegistration>();

/**
 * Agent OS V1 may only register read-only connectors.
 * Write-capable connectors are rejected at registration time.
 */
export function registerConnector(
  registration: ConnectorRegistration,
): void {
  if (registration.capability === "write-capable") {
    throw new Error(
      `Agent OS V1 refuses write-capable connector "${registration.id}". ` +
        "Read-only boundary: no HubSpot writes, Buffer posts, GBP edits, Supabase mutations, or production changes.",
    );
  }
  registeredConnectors.set(registration.id, registration);
}

export function clearRegisteredConnectors(): void {
  registeredConnectors.clear();
}

export function listRegisteredConnectors(): ConnectorRegistration[] {
  return [...registeredConnectors.values()];
}

export function isActionProhibited(action: string): boolean {
  return (V1_PROHIBITED_ACTIONS as readonly string[]).includes(action);
}

export function assertActionAllowed(action: string): void {
  if (isActionProhibited(action)) {
    throw new Error(
      `Prohibited action blocked by Agent OS V1 read-only boundary: ${action}`,
    );
  }
}

export function assertNoProhibitedActions(
  actions: readonly string[],
): void {
  for (const action of actions) {
    assertActionAllowed(action);
  }
}

export function getProhibitedActions(): readonly ProhibitedAction[] {
  return V1_PROHIBITED_ACTIONS;
}

/** Proposed actions that imply external writes are always blocked. */
const WRITE_ACTION_PATTERNS: RegExp[] = [
  /\bpublish\b/i,
  /\bpost (to|on) (buffer|instagram|facebook|linkedin)\b/i,
  /\bedit gbp\b/i,
  /\bupdate hubspot\b/i,
  /\bsend (email|sms|message) to (customer|lead)\b/i,
  /\brotate secret\b/i,
  /\bdeploy\b/i,
  /\bchange vercel\b/i,
  /\bwrite to supabase\b/i,
];

export function proposedActionImpliesWrite(proposedAction: string): boolean {
  return WRITE_ACTION_PATTERNS.some((re) => re.test(proposedAction));
}
