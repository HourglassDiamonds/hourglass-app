/**
 * Operational passkey logging. Never include challenges, signatures,
 * public keys, session secrets, credential IDs, or passwords.
 */

export function logPasskeyOperation(event: {
  op: string;
  ok: boolean;
  reason: string;
  pairingId?: string;
}): void {
  console.info(
    JSON.stringify({
      src: "continuum-passkey",
      op: event.op,
      ok: event.ok,
      reason: event.reason,
      ...(event.pairingId ? { pairingId: event.pairingId } : {}),
      ts: new Date().toISOString(),
    }),
  );
}
