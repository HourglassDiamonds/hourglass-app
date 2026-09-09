/**
 * Integer-cent money helpers. No floating gold/repair prices.
 */

const MONEY_RE = /^-?\$?\s*([0-9]{1,9})(?:,([0-9]{3}))*(?:\.([0-9]{1,2}))?$/;

export function parseUsdToCents(raw: string | null | undefined): number | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const normalized = trimmed.replace(/,/g, "");
  const match = /^-?\$?\s*([0-9]{1,9})(?:\.([0-9]{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const dollars = Number(match[1]);
  const frac = (match[2] ?? "").padEnd(2, "0");
  const cents = dollars * 100 + Number(frac || "0");
  if (!Number.isInteger(cents) || cents > 999_999_999_00) return null;
  return trimmed.startsWith("-") ? -cents : cents;
}

export function formatUsdCents(cents: number): string {
  if (!Number.isInteger(cents)) return "";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${sign}$${grouped}.${frac}`;
}

export function roundRatioCents(amountCents: number, permyriad: number): number {
  if (!Number.isInteger(amountCents) || !Number.isInteger(permyriad)) {
    throw new Error("invalid-money");
  }
  return Math.round((amountCents * permyriad) / 10_000);
}

export function isMoneyPattern(raw: string): boolean {
  return MONEY_RE.test(raw.trim());
}
