# OCR Worker

Minimal Node service that keeps a warm Tesseract worker for Diamond Intelligence diagram OCR.

The main app continues to render PDF pages and crop diagram regions on Vercel. Only `createWorker()` / `recognize()` run here.

## Endpoints

### `GET /health`

Returns **HTTP 200** only when the warm Tesseract worker is ready. Returns
**HTTP 503** while initializing or after init failure.

Ready:

```json
{
  "ok": true,
  "available": true,
  "workerWarm": true,
  "lang": "eng"
}
```

Not ready:

```json
{
  "ok": false,
  "available": false,
  "workerWarm": false,
  "lang": "eng",
  "error": "worker-not-ready"
}
```

### `POST /recognize`

Headers:

```text
Authorization: Bearer <OCR_WORKER_SECRET>
Content-Type: application/json
```

Body:

```json
{
  "imageBase64": "...",
  "mime": "image/png",
  "lang": "eng",
  "requestId": "optional-report-or-crop-id"
}
```

Success:

```json
{
  "ok": true,
  "text": "recognized text",
  "durationMs": 1234
}
```

Failure:

```json
{
  "ok": false,
  "error": "worker-init-failed",
  "durationMs": 1234
}
```

## Environment

| Variable | Required | Default |
|----------|----------|---------|
| `OCR_WORKER_SECRET` | yes (for `/recognize`) | — |
| `PORT` | no | `8787` |
| `OCR_WORKER_LANG` | no | `eng` |
| `OCR_WORKER_MAX_BODY_BYTES` | no | `23068672` (22MB) |

On the Vercel app:

| Variable | Required | Notes |
|----------|----------|-------|
| `OCR_WORKER_URL` | yes (production) | Base URL, e.g. `https://ocr.example.com` |
| `OCR_WORKER_SECRET` | yes (production) | Same secret as worker |

When `OCR_WORKER_URL` is unset, the app uses local in-process Tesseract (dev default).

## Local run

```bash
cd ocr-worker
npm install
OCR_WORKER_SECRET=dev-secret npm start
```

Health check:

```bash
curl http://localhost:8787/health
```

Remote-mode app test:

```bash
OCR_WORKER_URL=http://localhost:8787 OCR_WORKER_SECRET=dev-secret npm run test:gcal
```

## Deploy

Deploy this directory as a long-lived Node process (Railway, Fly.io, Render, ECS, etc.). It is **not** suitable for Vercel serverless — the worker must stay warm between requests.

Suggested resources: 1–2 GB RAM, 1 vCPU. First boot may take 10–30s while Tesseract loads language data.

## Docker

```bash
docker build -t hourglass-ocr-worker ./ocr-worker
docker run -p 8787:8787 -e OCR_WORKER_SECRET=your-secret hourglass-ocr-worker
```
