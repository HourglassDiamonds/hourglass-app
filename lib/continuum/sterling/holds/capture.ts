/** Splits sentence-bounded hold instructions from ordinary Quick Capture work. */
export function partitionConditionalHoldCapture(text: string): { holds: string[]; ordinary: string } {
  const chunks = text.split(/(?<=[.!?])\s+/).map((row) => row.trim()).filter(Boolean);
  const holds = chunks.filter((row) => /\b(?:hold(?: off)?|pause|don'?t (?:show|surface|bug)|bring .* back|leave .* alone|snooze)\b/i.test(row));
  return { holds, ordinary: chunks.filter((row) => !holds.includes(row)).join(" ") };
}
