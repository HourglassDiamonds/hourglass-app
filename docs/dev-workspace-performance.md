## Developer workspace performance (Cursor / Hourglass calibration)

### Why Cursor gets laggy here
- Large generated trees (especially `.next/` Turbopack caches) and large binary corpora (PDF uploads + debug PNGs) can dramatically increase indexing + file watcher load.
- Running multiple `next dev` servers (or repeated OCR scripts) multiplies CPU + watcher pressure.

### Recommended cleanup cadence
- **Daily (or when Cursor feels sluggish)**: run `npm run clean:workspace`
- **Weekly**: consider clearing `.next/dev/cache/turbopack/` by running `npm run clean:workspace` (this removes all of `.next/`).

### Safe-to-delete folders (re-generated)
- `.next/`
- `diagnostics/`
- `data/light-performance-calibration/debug/`
- `trace/`

### Folders you should avoid indexing
- `data/light-performance-calibration/uploads/` (large PDFs)
- `data/light-performance-calibration/debug/` (large PNG dumps)
- `.next/` (turbopack cache churn)
- `node_modules/` (very large + many files)

### Recommended terminal usage
- Keep **only one** `next dev` running for this repo at a time.
- If you need to restart dev, stop the old one first (Windows): `taskkill /PID <pid> /F`
- Prefer running one long job at a time (dev server OR heavy scripts), then exit it before starting another.

### Common pitfalls
- **Multiple dev servers**: two processes can bind ports (e.g. `3000` + `3001`) and both watch the same tree.
- **Debug image export**: turning on extraction debug creates large PNGs quickly; keep debug folders ignored and periodically cleaned.

