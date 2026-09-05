import { createHash } from "node:crypto";

function getAbuseKeyPepper(): string {
  const dedicated = process.env.ABUSE_RATE_LIMIT_PEPPER?.trim();
  if (dedicated) return dedicated;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (serviceRole) return serviceRole;
  return "hourglass-abuse-rate-limit-v1";
}

/** Deterministic 64-char hex. Does not embed the raw identity. */
export function hashAbuseBucketKey(input: {
  namespace: string;
  windowName: string;
  identity: string;
}): string {
  const material = [
    getAbuseKeyPepper(),
    input.namespace,
    input.windowName,
    input.identity,
  ].join("\0");
  return createHash("sha256").update(material).digest("hex");
}
