import { setTesseractWorkerCreateOptions } from "@/lib/calibration-library/ocr";
import { tesseractWorkerCreateOptions } from "@/lib/calibration-library/tesseract-runtime-paths";

/**
 * Diamond Intelligence `/interpret` only — bundled eng.traineddata for Vercel.
 * Calibration extract-file keeps default Tesseract paths to stay under bundle limits.
 */
export function activateClientBundledTesseractRuntime(): void {
  setTesseractWorkerCreateOptions(tesseractWorkerCreateOptions());
}
