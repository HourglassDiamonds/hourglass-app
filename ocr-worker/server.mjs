/**
 * Minimal Tesseract OCR worker — warm createWorker on boot, /health + /recognize only.
 *
 * Env:
 *   PORT (default 8787)
 *   OCR_WORKER_SECRET (required for /recognize)
 *   OCR_WORKER_LANG (default eng)
 *   OCR_WORKER_MAX_BODY_BYTES (default 22MB — base64 overhead for 15MB PNG)
 *
 * Concurrency: a single Tesseract worker is not safe for overlapping recognize()
 * calls — requests are serialized through an in-process queue.
 */

import { createServer } from "node:http";
import { createWorker } from "tesseract.js";

const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);
const SECRET = process.env.OCR_WORKER_SECRET?.trim() ?? "";
const LANG = process.env.OCR_WORKER_LANG?.trim() || "eng";
const MAX_BODY_BYTES = Number.parseInt(
  process.env.OCR_WORKER_MAX_BODY_BYTES ?? String(22 * 1024 * 1024),
  10,
);

let worker = null;
let workerWarm = false;
let workerInitError = null;
let workerInitStartedAt = Date.now();

/** Serialize recognize() so parallel crop requests never overlap on one worker. */
let recognizeChain = Promise.resolve();

function enqueueRecognize(task) {
  const run = recognizeChain.then(task, task);
  // Keep the chain alive even when a task rejects.
  recognizeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function initWorker() {
  workerInitStartedAt = Date.now();
  try {
    console.log("[ocr-worker] initializing tesseract worker", { lang: LANG });
    worker = await createWorker(LANG, 1, { logger: () => {} });
    workerWarm = true;
    workerInitError = null;
    console.log("[ocr-worker] worker ready", {
      lang: LANG,
      durationMs: Date.now() - workerInitStartedAt,
    });
  } catch (err) {
    workerInitError = err instanceof Error ? err.message : String(err);
    workerWarm = false;
    worker = null;
    console.error("[ocr-worker] worker init failed", {
      error: workerInitError,
      durationMs: Date.now() - workerInitStartedAt,
    });
  }
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function unauthorized(res) {
  json(res, 401, { ok: false, error: "unauthorized" });
}

function readJsonBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error("body-too-large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("invalid-json"));
      }
    });
    req.on("error", reject);
  });
}

function authorize(req, res) {
  if (!SECRET) {
    console.error("[ocr-worker] OCR_WORKER_SECRET is not set — rejecting /recognize");
    unauthorized(res);
    return false;
  }
  const header = req.headers.authorization ?? "";
  const expected = `Bearer ${SECRET}`;
  if (header !== expected) {
    unauthorized(res);
    return false;
  }
  return true;
}

async function handleHealth(_req, res) {
  if (!workerWarm || !worker) {
    // Non-200 until Tesseract is genuinely ready to accept work.
    json(res, 503, {
      ok: false,
      available: false,
      workerWarm: false,
      lang: LANG,
      error: workerInitError ?? "worker-not-ready",
    });
    return;
  }
  json(res, 200, {
    ok: true,
    available: true,
    workerWarm: true,
    lang: LANG,
  });
}

async function handleRecognize(req, res) {
  if (!authorize(req, res)) return;

  const started = Date.now();
  let body;
  try {
    body = await readJsonBody(req, MAX_BODY_BYTES);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    json(res, message === "body-too-large" ? 413 : 400, {
      ok: false,
      error: message,
      durationMs: Date.now() - started,
    });
    return;
  }

  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : "";
  if (!imageBase64) {
    json(res, 400, {
      ok: false,
      error: "missing-image",
      durationMs: Date.now() - started,
    });
    return;
  }

  if (!workerWarm || !worker) {
    json(res, 503, {
      ok: false,
      error: workerInitError ?? "worker-not-ready",
      durationMs: Date.now() - started,
    });
    return;
  }

  try {
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const result = await enqueueRecognize(async () => {
      if (!workerWarm || !worker) {
        throw new Error(workerInitError ?? "worker-not-ready");
      }
      return worker.recognize(imageBuffer);
    });
    const durationMs = Date.now() - started;
    // Safe diagnostics only — never log OCR text, image bytes, or requestId
    // (callers may pass report-derived ids).
    console.log("[ocr-worker] recognize ok", {
      bytes: imageBuffer.length,
      textLength: (result.data.text ?? "").length,
      durationMs,
    });
    json(res, 200, {
      ok: true,
      text: (result.data.text ?? "").trim(),
      durationMs,
    });
  } catch (err) {
    const durationMs = Date.now() - started;
    const error = err instanceof Error ? err.message : String(err);
    console.error("[ocr-worker] recognize failed", { error, durationMs });
    const status = /worker-not-ready|worker-init-failed/i.test(error) ? 503 : 500;
    json(res, status, {
      ok: false,
      error,
      durationMs,
    });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (req.method === "GET" && url.pathname === "/health") {
    await handleHealth(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/recognize") {
    await handleRecognize(req, res);
    return;
  }
  json(res, 404, { ok: false, error: "not-found" });
});

await initWorker();

server.listen(PORT, () => {
  console.log("[ocr-worker] listening", {
    port: PORT,
    lang: LANG,
    workerWarm,
  });
});

async function shutdown(signal) {
  console.log("[ocr-worker] shutting down", { signal });
  try {
    await recognizeChain;
  } catch {
    /* ignore */
  }
  if (worker) {
    try {
      await worker.terminate();
    } catch {
      /* ignore */
    }
    worker = null;
    workerWarm = false;
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8_000).unref();
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
