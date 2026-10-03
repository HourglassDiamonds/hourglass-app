/** Strict, pure guards for untrusted JSON. No coercion or identity lookup. */
import { isConciergeForegroundModel } from "../concierge-sol/models";
import { parseDateOnly } from "../date-only";
import { CAPTURE_CONTRACT_VERSION } from "./types";
import type { CaptureRequest, CaptureProposal, CaptureProposedItem, CaptureEntityResolution,
  CaptureTiming, CaptureCommitInput, CaptureCommitResult } from "./types";

type Row = Record<string, unknown>;
function row(v: unknown): v is Row {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}
function keys(v: Row, allowed: string[]): boolean {
  return Object.keys(v).every(k => allowed.includes(k));
}
function text(v: unknown, max = 10000): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max && !v.includes("\0");
}
function id(v: unknown): v is string { return text(v, 128) && /^[A-Za-z0-9_-]+$/.test(v); }
function uuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
function date(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && parseDateOnly(v) === v;
}
function instant(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-](\d{2}):(\d{2}))$/.exec(v);
  return !!m && date(m[1]) && Number(m[2]) < 24 && Number(m[3]) < 60
    && Number(m[4]) < 60 && (!m[6] || (Number(m[6]) < 24 && Number(m[7]) < 60))
    && Number.isFinite(Date.parse(v));
}
function timezone(v: unknown): v is string {
  if (!text(v, 100)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: v }); return true; } catch { return false; }
}
function optional(v: Row, key: string, guard: (x: unknown) => boolean): boolean {
  return !(key in v) || guard(v[key]);
}
function entities(v: Row): boolean {
  return ("personId" in v || "projectId" in v)
    && optional(v, "personId", uuid) && optional(v, "projectId", uuid);
}
function uniqueItems(v: unknown, guard: (x: unknown) => boolean): boolean {
  if (!Array.isArray(v) || v.length > 100 || !v.every(guard)) return false;
  return new Set(v.map(x => (x as Row).itemId)).size === v.length;
}
export function isCaptureRequest(v: unknown): v is CaptureRequest {
  return row(v) && keys(v, ["captureId", "text", "provenance", "referenceTime", "timezone", "context", "requestedModel"])
    && id(v.captureId) && text(v.text) && (v.provenance === "text" || v.provenance === "voice")
    && instant(v.referenceTime) && timezone(v.timezone)
    && optional(v, "requestedModel", isConciergeForegroundModel)
    && optional(v, "context", x => row(x) && keys(x, ["personId", "projectId"]) && entities(x));
}
export function isCaptureEntityResolution(v: unknown): v is CaptureEntityResolution {
  if (!row(v)) return false;
  if (v.status === "resolved") return keys(v, ["status", "personId", "projectId", "evidence"])
    && entities(v) && text(v.evidence);
  if (v.status === "unresolved") return keys(v, ["status", "mention"]) && text(v.mention);
  if (v.status !== "ambiguous" || !keys(v, ["status", "candidates"]) || !Array.isArray(v.candidates)
    || !v.candidates.length || v.candidates.length > 100) return false;
  return v.candidates.every(x => row(x) && keys(x, ["kind", "id", "evidence"])
    && (x.kind === "person" || x.kind === "project") && uuid(x.id) && text(x.evidence));
}
export function isCaptureTiming(v: unknown): v is CaptureTiming {
  if (!row(v) || typeof v.originalWording !== "string" || v.originalWording.length > 10000
    || v.originalWording.includes("\0")) return false;
  if (v.kind === "unspecified") return keys(v, ["kind", "originalWording"]);
  if (!text(v.originalWording)) return false;
  if (v.kind === "date-only") return keys(v, ["kind", "originalWording", "date", "timezone", "referenceInstant"])
    && date(v.date) && optional(v, "timezone", timezone) && optional(v, "referenceInstant", instant);
  if (v.kind === "exact-instant") return keys(v, ["kind", "originalWording", "instantAt", "timezone", "referenceInstant"])
    && instant(v.instantAt) && timezone(v.timezone) && optional(v, "referenceInstant", instant);
  return v.kind === "checkpoint" && keys(v, ["kind", "originalWording", "condition", "checkAt", "timezone", "referenceInstant"])
    && text(v.condition) && optional(v, "timezone", timezone) && optional(v, "referenceInstant", instant)
    && optional(v, "checkAt", x => row(x)
      && (x.kind === "date-only" || x.kind === "exact-instant") && isCaptureTiming(x));
}
export function isCaptureProposedItem(v: unknown): v is CaptureProposedItem {
  return row(v) && keys(v, ["itemId", "kind", "sourceExcerpt", "title", "content", "entityResolution", "timing", "clarification", "confidence", "sterlingProposal"])
    && id(v.itemId) && ["action", "reminder", "watching", "note", "hold"].includes(v.kind as string)
    && text(v.sourceExcerpt) && text(v.title, 160) && text(v.content)
    && typeof v.confidence === "number" && Number.isFinite(v.confidence) && v.confidence >= 0 && v.confidence <= 1
    && optional(v, "entityResolution", isCaptureEntityResolution) && optional(v, "timing", isCaptureTiming)
    && optional(v, "clarification", x => row(x) && keys(x, ["question"]) && text(x.question))
    && optional(v, "sterlingProposal", x => row(x) && x.kind === "conditional_hold" && x.status === "review-required")
    && (v.kind !== "hold" || Boolean(v.sterlingProposal) !== Boolean(v.clarification));
}
export function isCaptureProposal(v: unknown): v is CaptureProposal {
  return row(v) && keys(v, ["version", "captureId", "items", "canonical"])
    && v.version === CAPTURE_CONTRACT_VERSION && id(v.captureId) && v.canonical === false
    && uniqueItems(v.items, isCaptureProposedItem);
}
export function isCaptureCommitInput(v: unknown): v is CaptureCommitInput {
  if (!row(v) || !keys(v, ["version", "captureId", "items"]) || v.version !== CAPTURE_CONTRACT_VERSION || !id(v.captureId)) return false;
  if (!uniqueItems(v.items, x => {
    if (!row(x) || !id(x.itemId)) return false;
    if (x.selected === false) return keys(x, ["itemId", "selected"]);
    return x.selected === true && keys(x, ["itemId", "selected", "mutationId", "confirmedItem"])
      && uuid(x.mutationId) && isCaptureProposedItem(x.confirmedItem) && x.itemId === x.confirmedItem.itemId;
  })) return false;
  const selected = (v.items as Row[]).filter(x => x.selected);
  return new Set(selected.map(x => x.mutationId)).size === selected.length;
}
export function isCaptureCommitResult(v: unknown): v is CaptureCommitResult {
  return row(v) && keys(v, ["version", "captureId", "items"]) && v.version === CAPTURE_CONTRACT_VERSION && id(v.captureId)
    && uniqueItems(v.items, x => {
      if (!row(x) || !id(x.itemId)) return false;
      if (x.status === "needs-review" || x.status === "failed") return keys(x, ["itemId", "status", "message"]) && text(x.message);
      return (x.status === "saved" || x.status === "already-present") && keys(x, ["itemId", "status", "target"])
        && row(x.target) && keys(x.target, ["kind", "id"]) && uuid(x.target.id)
        && (x.target.kind === "open_job" || x.target.kind === "source_note");
    });
}
