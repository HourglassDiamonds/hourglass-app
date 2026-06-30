# Certificate / Report Cluster — Phase 2.1 Cleanup Notes

**Sprint date:** June 30, 2026  
**Flagship:** `how-to-read-a-diamond-certificate`  
**Status:** Content upgraded; redirects not implemented (deferred to Phase 2.2)

---

## Cluster inventory (11 articles)

| Slug | Role after cleanup |
|------|-------------------|
| `how-to-read-a-diamond-certificate` | **Flagship** |
| `are-all-diamond-certificates-the-same` | Supporting (lab comparison) |
| `why-diamond-certification-matters` | Supporting (trust primer) |
| `what-is-a-diamond-certificate` | Supporting (glossary) |
| `gia-diamond-certification-explained` | Supporting (GIA appendix) |
| `igi-diamond-certification-explained` | Supporting (IGI appendix) |
| `gcal-8x-diamond-certification-explained` | Supporting (GCAL appendix) |
| `ags-diamond-certification-explained` | Supporting (historical AGS) |
| `hrd-diamond-certification-explained` | Supporting (HRD appendix) |
| `what-is-a-diamond-report-number` | Supporting (report number / verify) |
| `do-lab-grown-diamonds-have-certificates` | Supporting (lab-grown cert bridge; links to flagship + lab pillar) |

---

## Phase 2.1 changes shipped

- Expanded flagship with direct answer, field walkthrough, GIA/IGI/GCAL context, GG perspective, DI and Concierge CTAs, visible FAQ section, FAQPage JSON-LD
- All satellites now link to flagship in opening copy where appropriate
- Related links reordered to surface flagship first on cert articles
- Hero image and `visualStatus: "live"` on flagship preserved unchanged

---

## Recommended merges and redirects (not implemented)

Execute in Phase 2.2 after monitoring and content absorption.

| Source slug | Target | Why | Content to preserve |
|-------------|--------|-----|---------------------|
| `what-is-a-diamond-certificate` | `how-to-read-a-diamond-certificate` | Glossary overlaps flagship intro; duplicate intent for "what is a diamond certificate" | Certificate vs appraisal distinction (short H2 on flagship or keep as anchor link) |
| `what-is-a-diamond-report-number` | `how-to-read-a-diamond-certificate` | Report number is one section of reading flow | Laser inscription + lab verify steps as H2 "Report number and identity" on flagship |
| `gia-diamond-certification-explained` | `how-to-read-a-diamond-certificate` | GIA context now covered in flagship GIA section | Keep GIA hero image path if redirected; or retain URL as thin appendix with canonical to flagship |
| `ags-diamond-certification-explained` | `are-all-diamond-certificates-the-same` | Secondary lab; AGS 2023 merger context | AGS history + cut philosophy paragraph |
| `hrd-diamond-certification-explained` | `are-all-diamond-certificates-the-same` | European lab appendix | HRD market context (Antwerp) |
| `do-lab-grown-diamonds-have-certificates` | `natural-vs-lab-diamonds` | Lab pillar owns cert + origin narrative | GIA June 2024 lab-grown grading shift note |

**Do not redirect yet:**

- `are-all-diamond-certificates-the-same` — distinct lab-comparison intent; keep as second-tier flagship
- `why-diamond-certification-matters` — trust primer; different funnel stage
- `igi-diamond-certification-explained` / `gcal-8x-diamond-certification-explained` — retain until flagship IGI/GCAL sections prove sufficient in GSC

---

## Internal link targets from flagship (reference)

| Target | Purpose |
|--------|---------|
| `/diamond-intelligence` | Report upload / interpretation |
| `/concierge` | Private gemologist review |
| `/the-house` | Expert entity |
| `/our-approach` | Evaluation philosophy |
| Lab appendices (GIA, IGI, GCAL) | Deep lab context |
| `are-all-diamond-certificates-the-same` | Lab strictness comparison |
| Cut / clarity articles | Performance context beyond grades |

---

*Companion: [`authority-consolidation-report.md`](./authority-consolidation-report.md)*
