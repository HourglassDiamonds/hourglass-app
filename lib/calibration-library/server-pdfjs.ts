/**
 * Server-side pdfjs-dist loader with a resolvable worker path for Node/Vercel.
 * pdfjs defaults to `./pdf.worker.mjs`, which is omitted from Vercel traces unless
 * outputFileTracingIncludes copies it; the fake worker then fails on dynamic import.
 */
import { createRequire } from "module";
import { join } from "path";
import { pathToFileURL } from "url";

type PdfJsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let serverPdfjsPromise: Promise<PdfJsModule> | null = null;

function createProjectRequire(): NodeRequire {
  return createRequire(join(process.cwd(), "package.json"));
}

function resolveServerPdfWorkerSrc(): string {
  const workerPath = createProjectRequire().resolve(
    "pdfjs-dist/legacy/build/pdf.worker.mjs",
  );
  return pathToFileURL(workerPath).href;
}

export async function loadServerPdfjs(): Promise<PdfJsModule> {
  if (!serverPdfjsPromise) {
    serverPdfjsPromise = (async () => {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = resolveServerPdfWorkerSrc();
      }
      return pdfjs;
    })();
  }
  return serverPdfjsPromise;
}
