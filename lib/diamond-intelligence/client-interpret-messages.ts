/** Shown when upload succeeds but optical depth is incomplete (timeout or partial read). */
export const CLIENT_PARTIAL_INTERPRETATION_NOTE =
  "We could read enough for a preliminary interpretation. Deeper optical details are best verified by expert review.";

export const CLIENT_UPLOAD_INTERPRET_ERROR =
  "We couldn't read enough from this file to build a useful interpretation. You can try another report or have Justin review it.";

/** Diagram OCR budget exhausted — grades read; proportions not finalized in time. */
export const CLIENT_GIA_DIAGRAM_OCR_TIMEOUT_ERROR =
  "We read your report grades but couldn't finish reading the proportion diagram in time. Please try again or have Justin review it.";

/** Diagram OCR required but OCR runtime unavailable (infrastructure failure). */
export const CLIENT_OCR_RUNTIME_UNAVAILABLE_ERROR =
  "We read your report grades but couldn't start proportion diagram OCR in this environment. Please try again shortly or have Justin review it.";

export const CLIENT_RATE_LIMIT_ERROR =
  "Too many reports submitted. Please try again later.";
