/**
 * Redact secrets and customer PII from Agent OS outputs and logs.
 * Never log tokens. Never include customer-level PII in briefs.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE =
  /(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._\-/=+]+/gi;
const JWT_RE = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;
const SUPABASE_KEY_RE = /sb_publishable_[A-Za-z0-9_-]+|sb_secret_[A-Za-z0-9_-]+|eyJhbGciOi[A-Za-z0-9._\-]+/g;
const SERVICE_ROLE_HINT_RE =
  /service[_-]?role[_-]?key\s*[:=]\s*\S+/gi;
const PAT_RE = /\bpat-[A-Za-z0-9_-]+\b/g;
const API_KEY_ASSIGN_RE =
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|cron[_-]?secret)\s*[:=]\s*\S+/gi;

export function redactSecretsAndPii(input: string): string {
  if (!input) return input;
  return input
    .replace(BEARER_RE, "Bearer [REDACTED]")
    .replace(JWT_RE, "[REDACTED_JWT]")
    .replace(SUPABASE_KEY_RE, "[REDACTED_KEY]")
    .replace(SERVICE_ROLE_HINT_RE, "service_role_key=[REDACTED]")
    .replace(PAT_RE, "[REDACTED_PAT]")
    .replace(API_KEY_ASSIGN_RE, "$1=[REDACTED]")
    .replace(EMAIL_RE, "[REDACTED_EMAIL]")
    .replace(PHONE_RE, "[REDACTED_PHONE]");
}

export function redactError(err: unknown, maxLength = 240): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "unknown error";
  const cleaned = redactSecretsAndPii(raw).replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1)}…`;
}

export function deepRedactUnknown(value: unknown): unknown {
  if (typeof value === "string") return redactSecretsAndPii(value);
  if (Array.isArray(value)) return value.map(deepRedactUnknown);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const keyLower = k.toLowerCase();
      if (
        keyLower.includes("secret") ||
        keyLower.includes("password") ||
        keyLower.includes("token") ||
        keyLower.includes("authorization") ||
        keyLower.includes("service_role")
      ) {
        out[k] = "[REDACTED]";
        continue;
      }
      out[k] = deepRedactUnknown(v);
    }
    return out;
  }
  return value;
}

export function containsLikelyPiiOrSecret(input: string): boolean {
  if (!input) return false;
  // Use non-sticky fresh patterns — global RegExp.test mutates lastIndex.
  return (
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(input) ||
    /(?<!\d)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/.test(
      input,
    ) ||
    /Bearer\s+[A-Za-z0-9._\-/=+]+/i.test(input) ||
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(input) ||
    /\bpat-[A-Za-z0-9_-]+\b/.test(input)
  );
}
