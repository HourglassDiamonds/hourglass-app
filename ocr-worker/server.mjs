/**
 * Minimal Tesseract OCR worker — warm createWorker on boot, /health + /recognize only.
 *
 * Env:
 *   PORT (default 8787)
 *   OCR_WORKER_SECRET (required for /recognize)
 *   OCR_WORKER_LANG (default eng)
 *   OCR_WORKER_MAX_BODY_BYTES (default 22MB — base64 overhead for 15MB PNG)
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

async function initWorker() {
  workerInitStartedAt = Date.now();
  try {
    console.log("[ocr-worker] initializing tesseract worker", { lang: LANG });
    worker = await createWorker(LANG, 1, { logger: () => {} });
    workerWarm = true;
    console.log("[ocr-worker] worker ready", {
      lang: LANG,
      durationMs: Date.now() - workerInitStartedAt,
    });
  } catch (err) {
    workerInitError = err instanceof Error ? err.message : String(err);
    workerWarm = false;
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
  json(res, 200, {
    ok: true,
    available: workerWarm,
    workerWarm,
    lang: LANG,
    ...(workerInitError ? { initError: workerInitError } : {}),
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

  const requestId = typeof body.requestId === "string" ? body.requestId : undefined;
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
      error: workerInitError ?? "worker-init-failed",
      durationMs: Date.now() - started,
    });
    return;
  }

  try {
    const imageBuffer = Buffer.from(imageBase64, "base64");
    const { data } = await worker.recognize(imageBuffer);
    const durationMs = Date.now() - started;
    console.log("[ocr-worker] recognize ok", {
      requestId,
      bytes: imageBuffer.length,
      textLength: (data.text ?? "").length,
      durationMs,
    });
    json(res, 200, {
      ok: true,
      text: (data.text ?? "").trim(),
      durationMs,
    });
  } catch (err) {
    const durationMs = Date.now() - started;
    const error = err instanceof Error ? err.message : String(err);
    console.error("[ocr-worker] recognize failed", { requestId, error, durationMs });
    json(res, 500, {
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
  console.log("[ocr-worker] listening", { port: PORT, lang: LANG, workerWarm });
});

process.on("SIGTERM", async () => {
  console.log("[ocr-worker] shutting down");
  if (worker) {
    try {
      await worker.terminate();
    } catch {
      /* ignore */
    }
  }
  server.close(() => process.exit(0));
});
