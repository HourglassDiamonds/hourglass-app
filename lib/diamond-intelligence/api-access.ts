/**
 * Diamond Intelligence consumer routes are public in production.
 * Abuse protection is enforced via server-side rate limiting (see rate-limit.ts).
 */
export function verifyDiamondIntelligenceAccess(_request: Request): boolean {
  return true;
}
