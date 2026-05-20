import { timingSafeEqual } from "node:crypto";
import { getCronSecret } from "./env";

function secretsMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function verifyCronRequest(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  const bearer = `Bearer ${secret}`;
  if (auth !== null && secretsMatch(auth, bearer)) return true;

  const headerSecret = request.headers.get("x-cron-secret");
  return headerSecret !== null && secretsMatch(headerSecret, secret);
}

/** Query param auth for browser smoke tests — `?secret=<CRON_SECRET>`. */
export function verifyCronQuerySecret(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;

  const provided = new URL(request.url).searchParams.get("secret");
  if (!provided) return false;

  return secretsMatch(provided, secret);
}
