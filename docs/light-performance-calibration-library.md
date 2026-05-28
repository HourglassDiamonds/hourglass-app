# Light Performance Calibration Library

Internal tool for ingesting diamond grading report data into a local calibration workbook and running the round-brilliant calibration scoring engine.

**Route:** `/calibration-library` (noindex)

**LP test console:** `/calibration-library/light-performance-test` — internal score validation table (noindex, not public).

## Supported labs (context only)

GIA, GCAL, AGS, IGI, Other — stored in `metadata.lab`. Extraction uses lab-specific parsers (`lib/calibration-library/lab-parsers.ts`). **Scoring does not weight or penalize any lab in v1** (including IGI).

## Workflow

1. Enter report identity: lab, report number, optional report URL, stone type, report source.
2. Upload a PDF or screenshot; PDF text is extracted in the browser (`pdfjs-dist`). Screenshots require pasting proportion text from the report.
3. Server parses uploaded/pasted text only — **no GIA/GCAL/IGI website scraping**.
4. Review metadata + reported fields; edit before save. Confidence badges show extraction quality.
5. Approve → persist calibration record (Supabase when configured, else `data/light-performance-calibration/workbook.json`).
6. Lab-neutral calibration score on review (~62% proportions, ~38% reported finish lines).

Each save stores **immutable** `extractedFieldsRaw` (first-pass parser output), approved `fields`, `fieldsNormalized` (for scoring repeatability), parser metadata, warnings, and missing-field list. Reviewer edits do not overwrite raw extraction.

## API (internal)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/calibration-library/extract` | POST | JSON `{ text, lab?, reportNumber?, reportUrl?, reportSource?, stoneType? }` → metadata + fields + confidence |
| `/api/calibration-library/score` | POST | JSON `{ fields }` → lab-neutral calibration score (no metadata) |
| `/api/calibration-library/entries` | GET / POST | List / append workbook (`metadata` + `fields`) |

In production, pass `CRON_SECRET` via `x-cron-secret` header or `?secret=` (same as intelligence cron). Development allows unauthenticated writes.

## Storage

- **Primary (production):** Supabase table `calibration_records` — run `lib/supabase/calibration-schema.sql` in the SQL editor when `SUPABASE_SERVICE_ROLE_KEY` is set.
- **Fallback (local dev):** `data/light-performance-calibration/workbook.json`
- Uploads: `data/light-performance-calibration/uploads/` (gitignored)

Unique key: `(lab, report_number_norm, report_source)` — same report number may exist as both `pdf-upload` and `screenshot-upload`.

### Seed & validate

```bash
npm run seed:calibration
npm run validate:calibration-db
```

`CALIBRATION_SEED_FORCE=1` re-applies fixture seeds (updates approved fields; preserves original `extractedFieldsRaw` when updating).

## Metadata (saved on each entry)

| Field | Values |
|-------|--------|
| `lab` | GIA, GCAL, AGS, IGI, OTHER |
| `reportNumber` | string |
| `reportUrl` | optional string |
| `reportSource` | manual, pdf-upload, screenshot-upload, vendor-feed |
| `stoneType` | natural, lab-grown, unknown |

## Report fields (parsed from upload)

shape, carat, measurements, tablePercent, depthPercent, crownAngle, pavilionAngle, lowerHalfPercent, starLengthPercent, girdle, culet, polish, symmetry, fluorescence

## Scoring (v1, lab-neutral)

- `scoring/round-brilliant.ts` — proportion bands (table, depth, crown, pavilion, lower half, star)
- `scoring/reported-finish.ts` — same neutral scale for girdle, culet, polish, symmetry, fluorescence for all labs
- Laboratory identity is **never** passed into the scorer
- **`cutGrade` is not a scoring input** — stored/displayed as report metadata only (Triple Excellent / 8X / Excellent labels do not change the Hourglass score)
- `scoring/scoring-inputs.ts` — documents scoring driver vs metadata-only fields
- `scoring/lab-neutral-scoring.test.ts` — regression tests for lab-neutral invariants

Non–round-brilliant shapes are saved without a calibration score.
