# Diamond Intelligence Validation Gate

Official regression gate for extraction health on committed validation anchors.

## Purpose

One command answers: **did extraction change?** Run it before merging parser or pipeline changes.

## Usage

```bash
npm run validate:diamond-intelligence
```

Filter to GIA anchors only (matches live-validated baseline):

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

## Expected output

```
DIAMOND INTELLIGENCE VALIDATION GATE

Report ID     Style                           Table  Depth  Crown  Pavilion Score  Verdict
--------------------------------------------------------------------------------
6233708773    GIA_NATURAL_FACSIMILE           64     58.4   36.0   40.6      no     PASS
6495746732    GIA_NATURAL_COLORED_SIMPLIFIED  56     64.4   —      —         no     PARTIAL-BY-DESIGN

PASS: 6
PARTIAL: 1
FAIL: 0
OVERALL: PASS
```

Exit code `0` when `OVERALL: PASS`. Exit code `1` on any `FAIL` or `SKIP`.

JSON artifact: `data/light-performance-calibration/validation-gate-report.json`

## What it checks

- **PDFs:** `data/light-performance-calibration/validation-reports/*.pdf`
- **Manifest:** `manifest.json` (anchor list and styles)
- **Expected values:** `expected-values.json` (field-level expectations)
- **Pipeline:** client mode with route timeouts matching `/api/diamond-intelligence/interpret`
- **Batch mode:** one isolated subprocess per anchor (avoids OCR memory pressure)
- **Verdicts:** `PASS`, `PARTIAL-BY-DESIGN` (when `_meta.expectedPartial`), or `FAIL`

## Adding a new anchor

1. Add the PDF to `data/light-performance-calibration/validation-reports/`
2. Add an entry to `manifest.json` (`id`, `filename`, `lab`, optional `style`)
3. Add expected fields to `expected-values.json`
   - Use `_meta.expectedPartial: true` when crown/pavilion are intentionally absent
   - Use `_meta.scoreEligibleExpected: false` when score eligibility must stay off
   - Use `_meta.optionalFields` for fields that may be missing without failing
4. Run `npm run validate:diamond-intelligence`

## Recommended workflow before merges

1. `npm run validate:diamond-intelligence:gia` — GIA baseline (6 anchors, matches c355344 live validation)
2. `npm run validate:diamond-intelligence` — full suite (8 anchors; OVERALL fails until GCAL sprint)
3. `npm run test:calibration` — fixture and unit regressions
4. Optionally `npm run validate:extraction-reports -- --detail` when debugging a specific failure

## Live HTTP mode

Default in-process mode uses the same extraction pipeline and timeouts as the interpret API route. That is the reliable regression gate.

`--live` POSTs each PDF to a running server. Use for deployment smoke tests only:

- Requires `npm run start` (or deployed URL)
- Sends `x-cron-secret` when `CRON_SECRET` is set (production auth)
- Does not replace the default gate — no server dependency, full forensics comparison

## Known limitations

- **GCAL (LG360796192):** Sarine diagram OCR depends on PDF render; currently FAILs in client pipeline — expected until GCAL validation sprint.
- **Full suite OVERALL:** fails until GCAL passes; use `validate:diamond-intelligence:gia` to gate GIA-only changes.
- **LGDR culet:** listed in `optionalFields` — diagram OCR may omit it without failing the anchor.
