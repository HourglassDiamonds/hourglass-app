import { timingSafeEqual } from "node:crypto";

function matches(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function verifyLedgerActivationRequest(request: Request): boolean {
  const expected = process.env.LEDGER_ACTIVATION_TOKEN?.trim();
  if (!expected) return false;
  const authorization = request.headers.get("authorization");
  const bearer = `Bearer ${expected}`;
  return authorization !== null && matches(authorization, bearer);
}
