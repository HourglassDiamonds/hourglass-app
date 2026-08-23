/**
 * Shared Client Memory validators. Safe for tests and server code.
 * Does not import persistence.
 */

import { isContinuumJsonValue } from "../contracts/validation";
import type { ContinuumJsonValue } from "../contracts/types";
import {
  CLIENT_MEMORY_VISIBILITIES,
  DEFAULT_USAGE_PERMISSION,
  DEFAULT_VISIBILITY,
  FACT_APPROVAL_STATUSES,
  FACT_STATUSES,
  PERSON_ROLES,
  RELATIONSHIP_KINDS,
  RELATIONSHIP_STATUSES,
  USAGE_PERMISSIONS,
  type ClientMemoryVisibility,
  type FactApprovalStatus,
  type FactStatus,
  type PersonRole,
  type RelationshipKind,
  type RelationshipStatus,
  type UsagePermission,
} from "./types";

export { DEFAULT_USAGE_PERMISSION, DEFAULT_VISIBILITY };

export function isVisibility(value: unknown): value is ClientMemoryVisibility {
  return (
    typeof value === "string" &&
    (CLIENT_MEMORY_VISIBILITIES as readonly string[]).includes(value)
  );
}

export function isUsagePermission(value: unknown): value is UsagePermission {
  return (
    typeof value === "string" &&
    (USAGE_PERMISSIONS as readonly string[]).includes(value)
  );
}

export function isPersonRole(value: unknown): value is PersonRole {
  return (
    typeof value === "string" &&
    (PERSON_ROLES as readonly string[]).includes(value)
  );
}

export function isRelationshipKind(value: unknown): value is RelationshipKind {
  return (
    typeof value === "string" &&
    (RELATIONSHIP_KINDS as readonly string[]).includes(value)
  );
}

export function isRelationshipStatus(
  value: unknown,
): value is RelationshipStatus {
  return (
    typeof value === "string" &&
    (RELATIONSHIP_STATUSES as readonly string[]).includes(value)
  );
}

export function isFactStatus(value: unknown): value is FactStatus {
  return (
    typeof value === "string" &&
    (FACT_STATUSES as readonly string[]).includes(value)
  );
}

export function isFactApprovalStatus(
  value: unknown,
): value is FactApprovalStatus {
  return (
    typeof value === "string" &&
    (FACT_APPROVAL_STATUSES as readonly string[]).includes(value)
  );
}

export function assertFactValue(
  value: unknown,
): asserts value is ContinuumJsonValue {
  if (!isContinuumJsonValue(value)) {
    throw new Error("fact value is not JSON-safe");
  }
}

export function assertPersonRoles(roles: unknown): asserts roles is PersonRole[] {
  if (!Array.isArray(roles) || !roles.every(isPersonRole)) {
    throw new Error("unsupported person role");
  }
}

export function unionPersonRoles(
  existing: PersonRole[],
  incoming: PersonRole[],
): PersonRole[] {
  const out = [...existing];
  for (const role of incoming) {
    if (!out.includes(role)) out.push(role);
  }
  return out;
}

export function rolesFromRelationship(relationship: string): PersonRole[] {
  return relationship.trim().toLowerCase() === "client" ? ["client"] : [];
}
