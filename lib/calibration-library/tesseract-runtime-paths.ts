import { dirname, join } from "path";
import { tmpdir } from "os";
import { createProjectRequire } from "./pdf-render-factory";

/** Vendored eng traineddata — interpret route trace only (not an npm dep). */
export const VENDORED_ENG_TESSDATA_DIR = join(
  process.cwd(),
  "lib",
  "calibration-library",
  "tessdata",
);

export type TesseractRuntimePaths = {
  langPath: string;
  cachePath: string;
  workerPath: string;
  corePath: string;
};

/** Resolve bundled Tesseract assets for Node/Vercel — no CDN lang download. */
export function resolveTesseractRuntimePaths(): TesseractRuntimePaths {
  const projectRequire = createProjectRequire();
  const tesseractRoot = dirname(projectRequire.resolve("tesseract.js/package.json"));
  const coreRoot = dirname(projectRequire.resolve("tesseract.js-core/package.json"));

  return {
    langPath: VENDORED_ENG_TESSDATA_DIR,
    cachePath: join(tmpdir(), "hourglass-tesseract-cache"),
    workerPath: join(tesseractRoot, "src", "worker-script", "node", "index.js"),
    corePath: join(coreRoot, "tesseract-core-lstm.wasm.js"),
  };
}

/** Options passed to createWorker — lang/cache only; worker/core use tesseract.js defaults. */
export function tesseractWorkerCreateOptions(): Record<string, unknown> {
  try {
    const paths = resolveTesseractRuntimePaths();
    return {
      logger: () => {},
      langPath: paths.langPath,
      cachePath: paths.cachePath,
    };
  } catch {
    return { logger: () => {} };
  }
}

/** Dev-safe labels for pipeline diagnostics. */
export function describeTesseractRuntimePaths(): Record<string, string> {
  try {
    const paths = resolveTesseractRuntimePaths();
    return {
      workerPath: paths.workerPath.replace(process.cwd(), "."),
      corePath: paths.corePath.replace(process.cwd(), "."),
      langPath: paths.langPath.replace(process.cwd(), "."),
      cachePath: paths.cachePath,
      vendoredEng: join(VENDORED_ENG_TESSDATA_DIR, "eng.traineddata.gz").replace(
        process.cwd(),
        ".",
      ),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
