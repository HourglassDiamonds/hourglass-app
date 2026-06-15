import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  isBundledTesseractLangReady,
  setTesseractWorkerCreateOptions,
} from "@/lib/calibration-library/ocr";
import {
  resolveTesseractRuntimePaths,
  tesseractWorkerCreateOptions,
} from "@/lib/calibration-library/tesseract-runtime-paths";

/** Decompress vendored eng.traineddata.gz into cache so worker loadLanguage is fast. */
function prepareBundledTesseractLangCache(): void {
  try {
    const paths = resolveTesseractRuntimePaths();
    const cached = join(paths.cachePath, "eng.traineddata");
    if (existsSync(cached)) return;
    const gzPath = join(paths.langPath, "eng.traineddata.gz");
    if (!existsSync(gzPath)) return;
    mkdirSync(paths.cachePath, { recursive: true });
    writeFileSync(cached, gunzipSync(readFileSync(gzPath)));
  } catch {
    // OCR path falls back to probe / CDN when cache prep fails.
  }
}

/**
 * Diamond Intelligence `/interpret` only — bundled eng.traineddata for Vercel.
 * Calibration extract-file keeps default Tesseract paths to stay under bundle limits.
 */
export function activateClientBundledTesseractRuntime(): void {
  prepareBundledTesseractLangCache();
  setTesseractWorkerCreateOptions(tesseractWorkerCreateOptions());
}
