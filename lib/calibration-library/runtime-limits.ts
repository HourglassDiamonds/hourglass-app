/** Central runtime limits — override via env for local debugging only. */

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const MAX_UPLOAD_BYTES = envInt("CALIBRATION_MAX_UPLOAD_BYTES", 20 * 1024 * 1024);
export const MAX_IMAGE_UPLOAD_BYTES = envInt(
  "CALIBRATION_MAX_IMAGE_BYTES",
  15 * 1024 * 1024,
);

export const MAX_PDF_PAGES_PROCESS = envInt("CALIBRATION_MAX_PDF_PAGES", 10);
export const MAX_PDF_PAGES_TEXT_LAYER = envInt("CALIBRATION_MAX_PDF_TEXT_PAGES", 5);
export const MAX_PDF_OCR_PAGES = envInt("CALIBRATION_MAX_PDF_OCR_PAGES", 2);

export const MAX_IMAGE_DIMENSION_PX = envInt("CALIBRATION_MAX_IMAGE_DIMENSION", 4096);
export const MAX_RENDER_PIXELS = envInt("CALIBRATION_MAX_RENDER_PIXELS", 16_000_000);
// OCR accuracy (especially GIA facsimile diagram numerals) materially degrades below scale ~5.
// Keep a safe default cap that still respects MAX_RENDER_PIXELS and MAX_IMAGE_DIMENSION_PX.
export const MAX_RENDER_SCALE = envInt("CALIBRATION_MAX_RENDER_SCALE", 6);

export const PDF_GET_DOCUMENT_TIMEOUT_MS = envInt(
  "CALIBRATION_PDF_OPEN_TIMEOUT_MS",
  8_000,
);
export const PDF_RENDER_TIMEOUT_MS = envInt(
  "CALIBRATION_PDF_RENDER_TIMEOUT_MS",
  25_000,
);
export const PDF_TEXT_LAYER_TIMEOUT_MS = envInt(
  "CALIBRATION_PDF_TEXT_TIMEOUT_MS",
  12_000,
);
export const OCR_WORKER_CREATE_TIMEOUT_MS = envInt(
  "CALIBRATION_OCR_WORKER_CREATE_TIMEOUT_MS",
  75_000,
);
export const OCR_WORKER_TERMINATE_TIMEOUT_MS = envInt(
  "CALIBRATION_OCR_WORKER_TERMINATE_TIMEOUT_MS",
  5_000,
);
export const OCR_SINGLE_IMAGE_TIMEOUT_MS = envInt(
  "CALIBRATION_OCR_IMAGE_TIMEOUT_MS",
  20_000,
);
export const OCR_REMOTE_HEALTH_TIMEOUT_MS = envInt(
  "OCR_REMOTE_HEALTH_TIMEOUT_MS",
  10_000,
);
export const OCR_REMOTE_RECOGNIZE_TIMEOUT_MS = envInt(
  "OCR_REMOTE_RECOGNIZE_TIMEOUT_MS",
  90_000,
);
export const IMAGE_PREPROCESS_TIMEOUT_MS = envInt(
  "CALIBRATION_IMAGE_PREPROCESS_TIMEOUT_MS",
  8_000,
);
export const DOCUMENT_EXTRACT_TIMEOUT_MS = envInt(
  "CALIBRATION_DOCUMENT_EXTRACT_TIMEOUT_MS",
  45_000,
);
export const IMAGE_REGION_OCR_TIMEOUT_MS = envInt(
  "CALIBRATION_IMAGE_REGION_OCR_TIMEOUT_MS",
  40_000,
);
export const SCRIPT_DEFAULT_TIMEOUT_MS = envInt(
  "CALIBRATION_SCRIPT_TIMEOUT_MS",
  60_000,
);

/** Below Vercel route maxDuration (60s). */
export const EXTRACT_FILE_PIPELINE_TIMEOUT_MS = envInt(
  "CALIBRATION_EXTRACT_FILE_TIMEOUT_MS",
  55_000,
);

/** Diamond Intelligence `/interpret` — hard client-facing budget. */
export const CLIENT_INTERPRET_ROUTE_TIMEOUT_MS = envInt(
  "CLIENT_INTERPRET_ROUTE_TIMEOUT_MS",
  28_000,
);

export const CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS = envInt(
  "CLIENT_UPLOAD_PIPELINE_TIMEOUT_MS",
  26_000,
);

/**
 * Client doc-extract: PDF text layer + cold serverless full-page facsimile OCR.
 * Image-only Natural GIA facsimiles need ~12–20s+ on cold starts; 45s matches
 * calibration DOCUMENT_EXTRACT_TIMEOUT_MS and stays within the 110s GIA pipeline.
 */
export const CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS = envInt(
  "CLIENT_DOCUMENT_EXTRACT_TIMEOUT_MS",
  45_000,
);

export const CLIENT_IMAGE_REGION_OCR_TIMEOUT_MS = envInt(
  "CLIENT_IMAGE_REGION_OCR_TIMEOUT_MS",
  18_000,
);

/** GIA facsimile / LGDR — diagram proportions need region OCR after empty textParse. */
export const CLIENT_GIA_DIAGRAM_PIPELINE_TIMEOUT_MS = envInt(
  "CLIENT_GIA_DIAGRAM_PIPELINE_TIMEOUT_MS",
  110_000,
);

export const CLIENT_GIA_DIAGRAM_REGION_OCR_TIMEOUT_MS = envInt(
  "CLIENT_GIA_DIAGRAM_REGION_OCR_TIMEOUT_MS",
  100_000,
);

export const CLIENT_GIA_DIAGRAM_INTERPRET_ROUTE_TIMEOUT_MS = envInt(
  "CLIENT_GIA_DIAGRAM_INTERPRET_ROUTE_TIMEOUT_MS",
  115_000,
);

/**
 * Browser fetch for `/api/diamond-intelligence/interpret`.
 * Must exceed CLIENT_GIA_DIAGRAM_INTERPRET_ROUTE_TIMEOUT_MS (115s) and align with
 * Vercel maxDuration (120s) so AbortController does not fire before a slow GIA
 * facsimile success payload (~46–54s production).
 */
export const CLIENT_INTERPRET_FETCH_TIMEOUT_MS = envInt(
  "CLIENT_INTERPRET_FETCH_TIMEOUT_MS",
  120_000,
);

export function capRenderScaleForPixels(
  pageWidthPt: number,
  pageHeightPt: number,
  requestedScale: number,
): number {
  const safeW = Math.max(pageWidthPt, 1);
  const safeH = Math.max(pageHeightPt, 1);
  const pixelCap = Math.floor(
    Math.sqrt(MAX_RENDER_PIXELS / (safeW * safeH)),
  );
  const dimCap = Math.min(
    Math.floor(MAX_IMAGE_DIMENSION_PX / safeW),
    Math.floor(MAX_IMAGE_DIMENSION_PX / safeH),
  );
  const capped = Math.min(requestedScale, MAX_RENDER_SCALE, pixelCap, dimCap);
  return Math.max(1, capped);
}
