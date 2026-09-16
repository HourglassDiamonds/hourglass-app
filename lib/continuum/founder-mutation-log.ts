/**
 * Bounded founder-mutation diagnostics.
 * Logs verb, origin, success, reason, and duration only.
 * Never logs credentials, message bodies, or candidate text.
 */

export function logFounderMutation(event: {
  verb: string;
  origin: string;
  ok: boolean;
  reason?: string;
  ms: number;
}): void {
  console.info("[continuum-founder-mutation]", JSON.stringify(event));
}
