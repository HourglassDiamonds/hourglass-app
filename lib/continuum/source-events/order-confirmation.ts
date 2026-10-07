/** Distinguish a real order-confirmation exception from vendor boilerplate. */
export function hasMaterialOrderConfirmationException(
  text: string | null | undefined,
): boolean {
  const stripped = (text ?? "")
    .replace(
      /\bplease\s+report\s+any\s+discrepancies(?:\s+to\s+[^.!?]{0,80})?(?:\s+asap)?[.!?]?/gi,
      " ",
    )
    .replace(/\breport\s+any\s+discrepancies\s+asap[.!?]?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return false;
  return (
    /\b(?:discrepancy|mismatch|incorrect|wrong|does(?:n['’]?t| not) match|missing|error)\b/i.test(
      stripped,
    ) ||
    /\bplease\s+(?:review|check|confirm)\b[^.!?]{0,80}\b(?:cad job number|finger size|metal|quantity|stone|price|specification)\b/i.test(
      stripped,
    )
  );
}
