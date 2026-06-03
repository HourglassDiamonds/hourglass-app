# Diamond Intelligence Validation Gate

Official regression gate for extraction health on committed validation anchors.

**Baseline (production `main`, commit `f25c78e`):** full suite **OVERALL: PASS** — PASS: 7, PARTIAL: 1, FAIL: 0.

## Purpose

One command answers: **did extraction change?** Run it before merging parser or pipeline changes.

## Usage

```bash
npm run validate:diamond-intelligence
```

Filter to GIA anchors only:

```bash
npm run validate:diamond-intelligence:gia
```

Filter to a single report:

```bash
npm run validate:diamond-intelligence -- 2496027047
```

Optional live HTTP smoke test (requires `npm run start`):

```bash
npm run validate:diamond-intelligence -- --live http://localhost:3000
```

Forensic / calibration-vs-client detail (existing harness):

```bash
npm run validate:extraction-reports -- --detail
```

Single-process run (faster when filtering one report):

```bash
npm run validate:diamond-intelligence -- --in-process
```

## Expected output (full suite)

```
DIAMOND INTELLIGENCE VALIDATION GATE

Report ID     Style                           Table  Depth  Crown  Pavilion Score  Verdict
--------------------------------------------------------------------------------
LG636401995   IGI                             59     61.7   33.2   41.7     yes    PASS
2496027047    GIA_LGDR_DOSSIER                59     60.8   34.5   40.8     yes    PASS
6233708773    GIA_NATURAL_FACSIMILE           64     58.4   36     40.6     yes    PASS
6532930018    GIA_NATURAL_FACSIMILE           58     60.0   34.0   40.8     yes    PASS
6495746732    GIA_NATURAL_COLORED_SIMPLIFIED  56     64.4   —      —        no     PARTIAL-BY-DESIGN
1493739085    GIA_LGDR_DOSSIER                57     61.7   34.5   40.8     yes    PASS
6502274288    GIA_LGDR_DOSSIER                59     61     34.5   41       yes    PASS
LG360796192   GCAL                            57     60.6   34.5   40.8     yes    PASS

PASS: 7
PARTIAL: 1
FAIL: 0
OVERALL: PASS
```

GIA-only filter: PASS: 5, PARTIAL: 1, FAIL: 0, OVERALL: PASS.

Exit code `0` when `OVERALL: PASS`. Exit code `1` on any `FAIL` or `SKIP`.

JSON artifact (local, gitignored): `data/light-performance-calibration/validation-gate-report.json`

## What it checks

- **PDFs:** `data/light-performance-calibration/validation-reports/*.pdf`
- **Manifest:** `validation-reports/manifest.json` (anchor list and styles)
- **Expected values:** `validation-reports/expected-values.json` (field-level expectations)
- **Pipeline:** client mode with route timeouts matching `/api/diamond-intelligence/interpret`
- **Batch mode:** one isolated subprocess per anchor (avoids OCR memory pressure)
- **Verdicts:** `PASS`, `PARTIAL-BY-DESIGN` (when `_meta.expectedPartial`), or `FAIL`

## Anchor inventory (current)

### Validation PDFs (live gate)

| Report ID | Lab | Style / family | Gate verdict |
|-----------|-----|----------------|--------------|
| LG636401995 | IGI | Standard (text-layer proportions) | PASS |
| 2496027047 | GIA | GIA_LGDR_DOSSIER | PASS |
| 6233708773 | GIA | GIA_NATURAL_FACSIMILE | PASS |
| 6532930018 | GIA | GIA_NATURAL_FACSIMILE | PASS |
| 6495746732 | GIA | GIA_NATURAL_COLORED_SIMPLIFIED | PARTIAL-BY-DESIGN |
| 1493739085 | GIA | GIA_LGDR_DOSSIER | PASS |
| 6502274288 | GIA | GIA_LGDR_DOSSIER | PASS |
| LG360796192 | GCAL | Sarine / hybrid (render + diagram OCR) | PASS |

### Fixture-only anchors (unit tests, no validation PDF)

| Report # | Lab | Parser family | Confidence |
|----------|-----|---------------|------------|
| LG353466126 | GCAL | gcal-8x | MEDIUM (text/fixtures only; **no live PDF**) |
| LG360796191 | GCAL | gcal-sarine-4cs | MEDIUM (fixture; sibling LG360796192 in gate) |
| LG773657228 | IGI | igi-standard | MEDIUM (fixture OCR variants; gate uses LG636401995) |
| 2527039693 | GIA | gia-modern / facsimile | MEDIUM (fixture; gate uses other facsimile PDFs) |

### Labs

| Lab | Live gate PDFs | Fixture coverage | Confidence |
|-----|----------------|------------------|------------|
| GIA | 6 (3 styles) | Facsimile fixture | **HIGH** |
| GCAL | 1 (Sarine) | 8X + Sarine fixtures | **MEDIUM** (8X PDF gap) |
| IGI | 1 | Multi-variant fixture | **MEDIUM** |
| AGS | 0 | None | **LOW** (generic parser only) |
| OTHER | 0 | Synthetic only | **LOW** |

## Adding a new anchor

1. Add the PDF to `data/light-performance-calibration/validation-reports/`
2. Add an entry to `validation-reports/manifest.json` (`id`, `filename`, `lab`, optional `style`)
3. Add expected fields to `validation-reports/expected-values.json`
   - Use `_meta.expectedPartial: true` when crown/pavilion are intentionally absent
   - Use `_meta.scoreEligibleExpected: false` when score eligibility must stay off
   - Use `_meta.optionalFields` for fields that may be missing without failing
4. Run `npm run validate:diamond-intelligence`

## Onboarding a GCAL 8X validation PDF

When a real **GCAL 8X** report PDF is obtained (e.g. LG353466126):

1. **PDF path:** `data/light-performance-calibration/validation-reports/GCAL-<reportId>.pdf` (match naming of existing GCAL anchor).
2. **Manifest:** add to `validation-reports/manifest.json`:
   - `id`: report number (e.g. `LG353466126`)
   - `filename`: matching PDF name
   - `lab`: `GCAL`
   - `style`: optional note `GCAL_8X` for clarity
3. **Expected values:** add full field expectations to `validation-reports/expected-values.json` (copy structure from `LG360796192` or fixture `fixtures/gcal353466126.ts`).
4. **Gate:** no code change required if parser routes to `gcal-8x`; run:
   ```bash
   npm run validate:diamond-intelligence -- LG353466126
   npm run validate:diamond-intelligence
   ```
5. **Verify:** OVERALL stays PASS; new row shows PASS with table/crown/pavilion populated.
6. **Optional:** add PDF under `data/light-performance-calibration/anchor-pdfs/` for `audit:anchor-live-pdfs` parity with fixture LG353466126.

Do not change parser routing or crops during onboarding — only assets and expectations.

## Recommended workflow before merges

1. `npm run validate:diamond-intelligence:gia` — GIA subset (6 anchors)
2. `npm run validate:diamond-intelligence` — full suite (8 anchors)
3. `npm run test:calibration` — fixture and unit regressions
4. Optionally `npm run validate:extraction-reports -- --detail` when debugging a specific failure

## Live HTTP mode

Default batch mode uses the same extraction pipeline and timeouts as the interpret API route. That is the reliable regression gate.

`--live` POSTs each PDF to a running server. Use for deployment smoke tests only:

- Requires `npm run start` (or deployed URL)
- Sends `x-cron-secret` when `CRON_SECRET` is set (production auth)
- Does not replace the default gate — no server dependency

## Production

Vercel production deploys track `main`. After parser or gate changes, confirm the latest deployment is **Ready** before treating extraction as released.

## Known limitations

- **GCAL 8X:** no validation PDF yet; fixture `LG353466126` only — highest-priority acquisition.
- **GCAL Sarine:** single live PDF (LG360796192); render/crop sensitive — add a second layout when available.
- **IGI:** one “healthy text layer” gate PDF; OCR edge cases covered in fixtures only.
- **GIA_UNKNOWN / AGS:** no validation PDFs; `GIA_UNKNOWN` has unit tests only.
- **LGDR culet:** listed in `optionalFields` on some dossier anchors — diagram OCR may omit without failing.

## Forensic probes (retained in repo)

Tracked dev probes (not part of the gate): `scripts/probe-gia-diagram.ts`, `scripts/probe-gcal-sarine-ocr.ts`, `scripts/probe-gcal-sarine-live-ocr.ts`, `scripts/probe-client-pavilion.ts`. Temporary GCAL render/crop probes from the stabilization sprint were removed.
