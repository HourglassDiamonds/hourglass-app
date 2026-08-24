export function formatMatchCode(code: string): string {
  if (!/^\d{6}$/.test(code)) return code;
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

/** Read the one-time pairing token from a URL fragment. Never from query. */
export function readPairingTokenFromHash(hash: string): string | null {
  if (!hash) return null;
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  const token = new URLSearchParams(trimmed).get("t")?.trim();
  return token || null;
}
