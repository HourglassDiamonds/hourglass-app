# Diamond Intelligence Beta QA — Consumer Abuse Matrix

Stress-test inputs representing how real consumers upload grading reports. Run the matrix with:

```bash
npx tsx scripts/run-beta-qa-matrix.ts
```

Results are written to `outcome-matrix.json` (gitignored when containing local paths).

## Variant categories

### Screenshot variants

| Variant | Description | Expected handling |
| --- | --- | --- |
| `desktop-full` | Full-screen desktop screenshot | Full or Partial |
| `desktop-cropped` | Cropped to report panel | Full or Partial |
| `mobile` | Mobile viewport capture | Partial common |
| `compressed` | Re-encoded low-quality JPG | Partial common |
| `browser-chrome` | Screenshot with browser UI visible | Partial |
| `partial-offscreen` | Report partially off-screen | Partial or Failure |

### Image variants

| Variant | Format | Notes |
| --- | --- | --- |
| `jpg` | JPEG | Primary consumer format |
| `png` | PNG | Lossless screenshot |
| `webp` | WebP | Modern browser export |
| `iphone-monitor` | JPG photo of monitor | OCR noise, partial common |
| `android-monitor` | JPG photo of monitor | OCR noise |
| `blurry` | Slightly motion-blurred | Partial |
| `low-light` | Underexposed capture | Partial or Failure |

### PDF variants

| Variant | Notes |
| --- | --- |
| `original` | Native lab PDF |
| `renamed` | Same bytes, different filename |
| `rotated` | 90° rotation |
| `reduced-quality` | Recompressed / downscaled |
| `image-only` | Scanned pages, no text layer |

## Outcome legend

- **Full** — complete interpretation path (no grade-confirmation gate)
- **Partial** — useful read with missing proportions or grade confirmation
- **Failure** — unable to verify / unsupported / timeout

Each row records: `parserFamily`, `routing`, `lab`, `reportNumber`, `outcome`, `gradeHints`, `missingFields`, `archiveStatus`.

## Anchor reports (automated fixtures in repo)

| Report | Lab | Parser | Fixture |
| --- | --- | --- | --- |
| LG340946327 | GCAL | gcal-sarine-4cs | `fixtures/gcal-sarine-lg340946327.ts` |
| LG340946323 | GCAL | gcal-sarine-4cs | `fixtures/gcal-sarine-lg340946323.ts` |
| LG353456516 | GCAL | gcal-sarine-4cs | `fixtures/gcal-sarine-lg353456516.ts` |
| LG360196486 | GCAL | gcal-8x | `fixtures/gcal360196486.ts` |
| LG353466126 | GCAL | gcal-8x | `fixtures/gcal353466126.ts` |
| LG360796191 | GCAL | gcal-sarine-4cs | `fixtures/gcal360796191.ts` |

## Local Desktop assets (optional live rows)

When present on the developer machine, the runner adds live JPG rows:

- `GCAL340946327.jpg`, `GCAL340946323.jpg`, `GCAL353456516.jpg`, `GCAL360196486.jpg`

Place additional abuse variants under `variants/` subfolders to extend the matrix.
