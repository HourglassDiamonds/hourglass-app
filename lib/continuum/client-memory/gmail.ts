/**
 * Gmail thread identifiers are opaque strings.
 * Never round, never scientific notation, never use them as numbers.
 */

import { cellText, type CellScalar } from "./xlsx";

export type GmailThreadCoercion =
  | { status: "canonical"; value: string }
  | { status: "invalid"; source: string }
  | { status: "blank" };

/** Hex-like Gmail thread ids are typically 10+ hex chars. Tiny Excel numbers are not. */
export function coerceGmailThreadId(value: CellScalar): GmailThreadCoercion {
  if (value == null) return { status: "blank" };
  if (typeof value === "boolean") {
    return { status: "invalid", source: value ? "TRUE" : "FALSE" };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { status: "invalid", source: "NaN" };
    const asInt = String(Math.trunc(value));
    if (value > 0 && Number.isInteger(value) && asInt.length >= 10) {
      return { status: "canonical", value: asInt };
    }
    return { status: "invalid", source: String(value) };
  }
  const text = cellText(value);
  if (!text) return { status: "blank" };
  if (/[eE][+-]?\d+/.test(text) && /\d/.test(text) && !/^[0-9a-f]+$/i.test(text)) {
    return { status: "invalid", source: text };
  }
  if (/^[0-9a-f]{10,}$/i.test(text)) return { status: "canonical", value: text };
  if (/^\d{10,}$/.test(text)) return { status: "canonical", value: text };
  return { status: "invalid", source: text };
}
