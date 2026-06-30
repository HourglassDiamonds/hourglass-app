# Lab vs Natural Diamond Cluster — Phase 2.2 Cleanup Notes

**Sprint date:** June 30, 2026  
**Flagship:** `natural-vs-lab-diamonds`  
**Status:** Content upgraded; redirects not implemented (deferred)

---

## Cluster inventory (4 core articles)

| Slug | Role after cleanup |
|------|-------------------|
| `natural-vs-lab-diamonds` | **Flagship** |
| `are-lab-diamonds-a-good-choice` | Supporting (lab-leaning satisfaction check) |
| `do-lab-grown-diamonds-have-certificates` | Supporting (cert bridge; cert cluster overlap) |
| `fluorescence-in-natural-vs-lab-diamonds` | Supporting (fluorescence × origin bridge) |

**Peripheral mentions (not cluster members):** Several buying guides, shape guides, and certification articles reference lab vs natural in passing. They link to the flagship where origin matters but are not part of this consolidation sprint.

---

## Phase 2.2 changes shipped

- Expanded flagship with direct answer, origin definitions, performance framing, certification section, value/resale framing, GG perspective, Charlotte/regional + national remote context, Concierge and Diamond Intelligence CTAs, visible FAQ section, FAQPage JSON-LD
- Hero image (`natural-vs-lab-diamonds-hero.png`), `visualStatus: "live"`, and `visualCategory: "comparison-visual"` preserved unchanged
- Satellites now point clearly to flagship; related links reordered with flagship first
- Shared FAQ copy in `lib/seo/lab-natural-educational.ts`; schema via `labNaturalFaqNode()` in `entities.ts`

---

## Recommended merges and redirects (not implemented)

Execute after monitoring flagship performance and search absorption.

| Source slug | Target | Action | Why | Content to preserve |
|-------------|--------|--------|-----|---------------------|
| `are-lab-diamonds-a-good-choice` | `natural-vs-lab-diamonds` | **Merge** (redirect later) | Overlapping purchase-decision intent; flagship now covers when lab fits and satisfaction framing | "Who tends to be happiest" and "who may not be" H2s; long-term satisfaction habits |
| `do-lab-grown-diamonds-have-certificates` | `natural-vs-lab-diamonds` | **Stay supporting** (defer merge) | Cert cluster owns report-reading flow; Phase 2.1 already links both ways | GIA June 2024 lab-grown grading shift note; lab report field list |
| `fluorescence-in-natural-vs-lab-diamonds` | `natural-vs-lab-diamonds` | **Stay supporting** | Distinct fluorescence × origin intent; thin but not duplicate | Natural vs lab growth fluorescence differences; report documentation |

**Do not redirect yet:**

- `are-lab-diamonds-a-good-choice` — retain as lab-leaning satellite until flagship ranks for "are lab diamonds good" queries; merge when GSC shows absorption
- `do-lab-grown-diamonds-have-certificates` — dual membership in cert + lab clusters; cert flagship (`how-to-read-a-diamond-certificate`) is the primary cert authority
- `fluorescence-in-natural-vs-lab-diamonds` — bridge to fluorescence cluster (`what-is-diamond-fluorescence`); keep for cross-cluster linking

**If merging `are-lab-diamonds-a-good-choice` later:**

1. Add preserved H2 content as subsections under flagship "When Lab-Grown Diamonds Tend to Fit"
2. 301 redirect source → flagship
3. Update inbound links from shape guides and buying articles

**If merging `do-lab-grown-diamonds-have-certificates` later:**

1. Fold GIA June 2024 note into flagship certification section (already partially referenced)
2. Redirect to flagship OR to `how-to-read-a-diamond-certificate` depending on query intent (cert vs origin)
3. Prefer keeping cert URL live with canonical to cert flagship if cert queries dominate

---

## Internal link targets from flagship (reference)

| Target | Purpose |
|--------|---------|
| `/concierge` | Private buyer decision help |
| `/diamond-intelligence` | Report upload / interpretation |
| `/the-house` | Graduate Gemologist entity |
| `/our-approach` | Evaluation philosophy |
| `how-to-read-a-diamond-certificate` | Cert reading field guide |
| `do-lab-grown-diamonds-have-certificates` | Lab-specific paperwork |
| `gia-diamond-certification-explained` | GIA context |
| `igi-diamond-certification-explained` | IGI context (common for lab) |
| `how-diamond-cut-affects-light-performance` | Why grades differ in appearance |
| `what-is-diamond-clarity` | Inclusion placement context |
| `fluorescence-in-natural-vs-lab-diamonds` | Origin-specific fluorescence |
| `are-lab-diamonds-a-good-choice` | Lab-leaning satisfaction satellite |
| `charlotte-diamond-advisor-guide` | Local private-advisor context |
| `why-work-with-a-graduate-gemologist` | When to involve trained review |
| `diamond-price-vs-quality` | Budget tradeoffs |
| `diamond-buying-tips-from-jewelers` | Purchase habits |

---

## FAQ schema (flagship only)

Visible H2 questions on `natural-vs-lab-diamonds` match `LAB_NATURAL_FAQS` in `lib/seo/lab-natural-educational.ts`:

1. Are lab-grown diamonds real diamonds?
2. Are natural diamonds better than lab-grown diamonds?
3. Which holds value better, natural or lab-grown diamonds?
4. Do lab-grown diamonds have certificates?
5. How do you choose between lab and natural diamonds?
6. When should you ask a Graduate Gemologist?

FAQPage JSON-LD emitted only for this slug via `app/diamond-guide/[slug]/page.tsx`.

---

*Companion: [`authority-consolidation-report.md`](./authority-consolidation-report.md), [`certificate-cluster-cleanup-notes.md`](./certificate-cluster-cleanup-notes.md)*
