import type { ProjectJob } from "./types";

export type OperationRequest = Record<string, unknown>;
export type AppliedOperation = { request: OperationRequest | null; job: ProjectJob };

// Preserve supplied intent, including null versus omitted fields. Only object
// key order is normalized; there is no fuzzy text or date normalization.
export function operationKey(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(operationKey).join(",")}]`;
  return `{${Object.entries(value).filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${operationKey(v)}`).join(",")}}`;
}

export function assertSameRequest(existing: AppliedOperation, request: OperationRequest): void {
  // Historical operations have no trustworthy snapshot: never guess success.
  if (!existing.request || operationKey(existing.request) !== operationKey(request)) {
    throw new Error("idempotency-conflict");
  }
}

export function canonicalOperationKey(next: ProjectJob, prior: ProjectJob | null,
  action: string, actor: string, request: OperationRequest | null): string {
  const canonical: Partial<ProjectJob> = { ...next };
  if (request !== null) {
    // These are server allocations, not caller intent. Direct RPC callers without
    // an application request snapshot compare every canonical field strictly.
    delete canonical.updatedAt;
    if (action === "create") { delete canonical.jobId; delete canonical.createdAt; }
    if (action === "resolve") delete canonical.resolvedAt;
    if (action === "cancel") delete canonical.cancelledAt;
  }
  return operationKey({ next: canonical, prior, action, actor, request });
}
