# Diamond Guide — Comprehensive Authority Audit

**Audit date:** July 6, 2026 (revised same day for classification accuracy)  
**Source of truth:** Current repo (`app/diamond-guide/articles.ts`, rendering, schema, `public/diamond-guide/`, hub pages)  
**Scope:** All 100 Diamond Guide articles + hub/authority experience  
**Mode:** Assessment and planning only — no production changes in this sprint  

**Prior completed work acknowledged (do not re-recommend):** Certificate, lab/natural, fluorescence, clarity, and cut/light-performance cluster copy cleanup; broad internal-linking authority pass; redirect-readiness documentation; fluorescence editorial visuals; clarity scale chart; cut/light-return diagrams.

**Supersedes for inventory accuracy:** `article-image-inventory.md` (June 30 snapshot — predates hero system and most editorial assets).

---

## 1. Executive summary

The Diamond Guide is a **100-article editorial library** with a mature data model (heroes, editorial images, CSS reference blocks, FAQPage schema on six flagships) and **strong consolidation work** across five technical clusters. Verified state: **23 live heroes**, **6 articles with raster editorial diagrams**, **6 articles with visible FAQ blocks and matching FAQPage JSON-LD**, and **no broken hero asset wiring**.

**Strengths**

- Five rewritten flagships (`how-to-read-a-diamond-certificate`, `natural-vs-lab-diamonds`, `what-is-diamond-fluorescence`, `what-is-diamond-clarity`, `what-is-diamond-cut`) deliver direct-answer openings, expert framing, Hourglass standards, and extractable FAQ sections.
- Internal linking pass connected certificate, lab, fluorescence, DI, Concierge, and trust destinations across buying, color, clarity, cut, and Charlotte articles.
- Shape guides (9 live heroes), Charlotte/advisor content, and proposal planning cluster provide differentiation beyond generic 4Cs copy.
- Editorial visual system (`editorial-image` blocks + CSS reference components) is live and on-brand.

**Gaps**

- **Color cluster** has no flagship-grade rewrite, no FAQPage schema, no hero, and no editorial scale chart — the largest remaining topical authority gap among the Four Cs.
- **Clarity and cut flagships** have editorial charts but **no live heroes** — visual identity lags certificate, lab, and fluorescence flagships (content is mature; hero is the gap).
- **Category hub pages** still promote merge-candidate satellites in “Start here” slots (e.g. clarity chart, cut-affects-sparkle) despite cluster cleanup defining different flagships.
- **56 articles** have weak authority pathways (0–1 trust/tool/conversion inline links); shape and color satellites are the densest weak zone.
- **22 articles** sit on merge/redirect watchlists (14 in `redirect-readiness-observation-plan.md` plus additional clarity/cut satellites documented in cluster cleanup notes); fluorescence cannibalization remains the highest-risk set until GSC confirms absorption.
- **Per-article OG images** are not wired (`ogImage` unused on all articles). This affects social/link previews only — not a substitute for content depth, schema accuracy, or hub alignment.

**Recommended next marketing sprint:** Phase 5A — Color cluster audit/consolidation, then Phase 5B clarity/cut flagship heroes.

---

## 2. Verified total article count

| Metric | Verified count | Method |
|--------|---------------:|--------|
| Articles in `articles.ts` | **100** | `slug: "` enumeration (excludes type field `slug: string`) |
| Distinct categories | **10** | Certification, Buying Guides, Charlotte Guides, Diamond Clarity, Diamond Color, Diamond Cut, Diamond Shapes, Diamond Size, Light Performance, Proposal Planning |
| Category hub routes | **9** | `diamond-guide/{category}` (Proposal Planning included) |
| `/all` index routes | **9** | Per-category `all/page.tsx` |
| Proposal Planning refs in `content.ts` | **7** | All resolve to articles in `articles.ts` |

**Word-count distribution (approximate, body text + headings only):**

| Band | Count |
|------|------:|
| Under 400 words | 23 |
| 400–699 | 40 |
| 700–999 | 21 |
| 1,000–1,299 | 6 |
| 1,300+ | 10 |

**Word count is not a ranking target.** Bands above describe current state only. Editorial targets by intent appear in §10 and §21.

---

## 3. Verified hero count

| Metric | Count |
|--------|------:|
| **Live heroes** (`visualStatus: "live"` + `heroImage` + `heroImageAlt` + asset on disk) | **23** |
| Articles without live hero | **77** |
| Hero assets in `public/diamond-guide/` (`*-hero.*`) | **24** |
| Hero metadata with missing/broken assets | **0** |
| `ogImage` fields live on any article | **0** |

**Confirmed:** Prior “23 live heroes” count is **still accurate** as of this audit.

### Live hero inventory (23)

| Slug | Hero asset path |
|------|-----------------|
| `asscher-diamond-guide` | `/diamond-guide/asscher-diamond-guide-hero.png` |
| `charlotte-diamond-advisor-guide` | `/diamond-guide/charlotte-diamond-advisor-guide-hero.png` |
| `cushion-diamond-guide` | `/diamond-guide/cushion-diamond-guide-hero.png` |
| `custom-engagement-rings-in-charlotte` | `/diamond-guide/custom-engagement-rings-in-charlotte-hero.png` |
| `diamond-carat-vs-size` | `/diamond-guide/diamond-carat-vs-size-hero.png` |
| `diamond-light-return-explained` | `/diamond-guide/diamond-light-return-explained-hero.png` |
| `diamond-size-chart` | `/diamond-guide/diamond-size-chart-hero.png` |
| `emerald-diamond-guide` | `/diamond-guide/emerald-diamond-guide-hero.png` |
| `fluorescence-in-natural-vs-lab-diamonds` | `/diamond-guide/fluorescence-in-natural-vs-lab-diamonds-hero.png` |
| `gia-diamond-certification-explained` | `/diamond-guide/gia-certificate-explained-hero.png` |
| `how-to-read-a-diamond-certificate` | `/diamond-guide/how-to-read-a-diamond-certificate-hero.png` |
| `independent-diamond-advisor-vs-jewelry-store` | `/diamond-guide/jewelry-store-vs-private-advisor-hero.png` |
| `marquise-diamond-guide` | `/diamond-guide/marquise-diamond-guide-hero.png` |
| `natural-vs-lab-diamonds` | `/diamond-guide/natural-vs-lab-diamonds-hero.png` |
| `oval-diamond-guide` | `/diamond-guide/oval-diamond-guide-hero.png` |
| `oval-vs-round-diamond` | `/diamond-guide/oval-vs-round-diamond-hero.png` |
| `pear-diamond-guide` | `/diamond-guide/pear-diamond-guide-hero.png` |
| `princess-diamond-guide` | `/diamond-guide/princess-diamond-guide-hero.png` |
| `radiant-diamond-guide` | `/diamond-guide/radiant-diamond-guide-hero.png` |
| `round-diamond-guide` | `/diamond-guide/round-diamond-guide-hero.png` |
| `what-is-diamond-fluorescence` | `/diamond-guide/what-is-diamond-fluorescence-hero.png` |
| `when-fluorescence-improves-a-diamond` | `/diamond-guide/when-fluorescence-improves-a-diamond-hero.png` |
| `why-work-with-a-graduate-gemologist` | `/diamond-guide/gia-graduate-gemologist-hero.png` |

---

## 4. Hero-gap inventory

**Important:** **77 articles without live heroes ≠ 77 production tasks.** Most gaps are intentional. Hero work should be selective.

### Hero backlog classification

| Class | Article count | Production intent |
|-------|--------------:|-------------------|
| **Already has live hero** | **23** | No hero task |
| **P0 — flagship hero gap** | **2** | Ship immediately after/with Phase 5B |
| **P1 — high-value pillar hero gap** | **3** | After color flagship (Phase 5A) |
| **P2 — selective support hero opportunity** | **4** | Commercial/local value only |
| **Intentionally no hero / text-led** | **68** | No hero recommended |

**P0 flagship hero gaps (immediate):**

| Slug | Editorial visual already in body |
|------|----------------------------------|
| `what-is-diamond-clarity` | GIA clarity scale chart |
| `what-is-diamond-cut` | Cut scale + light-return/leakage diagrams |

**P1 high-value pillar hero gaps:**

| Slug | Rationale |
|------|-----------|
| `what-is-diamond-color` | Four Cs flagship — ship with Phase 5A content |
| `diamond-buying-tips-from-jewelers` | Mature buying pillar (~1,565 words); identity + shareability |
| `are-all-diamond-certificates-the-same` | Second-tier cert comparison flagship |

**P2 selective support heroes:**

| Slug | Rationale |
|------|-----------|
| `charlotte-engagement-ring-guide` | Local commercial cornerstone |
| `buy-diamonds-in-charlotte` | Local entry point |
| `diamond-price-vs-quality` | Budget/commercial intent |
| `diamond-size-on-hand` | Studio pairing opportunity (hero optional) |

**Intentionally no hero (68 articles) — includes:**

- All **22 merge/redirect watch** articles (do not invest visuals pre-redirect)
- Certification lab appendices without heroes (IGI, AGS, HRD, GCAL — GIA already has hero)
- Grade-comparison and narrow-definitional URLs (`g-vs-h`, `what-is-a-carat`, etc.)
- Proposal-planning lifestyle cluster (7 articles — text-forward; `first-30-days-after-you-get-engaged` included)
- Shape guides already at 9/10 hero coverage — remaining gap is authority links, not heroes
- `what-diamond-shape-looks-the-largest` — CSS reference blocks carry visual story
- Mature flagships that already have heroes or editorial charts sufficient for in-page identity

### Assets and naming notes

| Asset | Status | Notes |
|-------|--------|-------|
| `millimeter-measurements-hero.png` | Wired as **editorial image** on `diamond-size-chart` | Not orphaned; misnamed (`-hero` on in-body chart) |

| Naming inconsistency | Example |
|---------------------|---------|
| Slug vs filename | `gia-diamond-certification-explained` → `gia-certificate-explained-hero.png` |
| Slug vs filename | `independent-diamond-advisor-vs-jewelry-store` → `jewelry-store-vs-private-advisor-hero.png` |
| Slug vs filename | `why-work-with-a-graduate-gemologist` → `gia-graduate-gemologist-hero.png` |

**New assets:** Standardize on `{slug}-hero.png`. Rename existing files only when touching those articles.

---

## 5. Editorial-image inventory

| Metric | Count |
|--------|------:|
| Articles with `editorial-image` blocks | **6** |
| Total raster editorial images in articles | **7** |
| CSS-only reference articles (no raster) | **1** (`what-diamond-shape-looks-the-largest`; `diamond-size-chart` has both raster + CSS) |

| Slug | Editorial src | Hero |
|------|---------------|------|
| `diamond-light-leakage-explained` | `diamond-light-return-light-leakage-diagram.png` | No |
| `diamond-light-return-explained` | Same diagram (shared asset) | Yes |
| `diamond-size-chart` | `millimeter-measurements-hero.png` | Yes |
| `what-is-diamond-clarity` | `what-is-diamond-clarity-scale-chart.png` | No |
| `what-is-diamond-cut` | `what-is-diamond-cut-scale-chart.png`, `diamond-light-return-light-leakage-diagram.png` | No |
| `what-is-diamond-fluorescence` | `what-is-diamond-fluorescence-scale-chart.png` | Yes |

**All editorial assets verified on disk.** No broken `src` paths.

---

## 6. FAQ / schema inventory

### Visible FAQ (question-style H2 blocks, ≥3 questions)

| Slug | FAQ headings | FAQPage schema |
|------|-------------|----------------|
| `how-to-read-a-diamond-certificate` | 5 | Yes (`certificateReaderFaqNode`) |
| `natural-vs-lab-diamonds` | 6+ | Yes (`labNaturalFaqNode`) |
| `what-is-diamond-fluorescence` | 6+ | Yes (`fluorescenceFaqNode`) |
| `what-is-diamond-clarity` | 6 | Yes (`clarityFaqNode`) |
| `what-is-diamond-cut` | 6 | Yes (`cutFaqNode`) |
| `charlotte-diamond-advisor-guide` | “Common Questions” section | Yes (`charlotteAdvisorFaqNode`) |

**Counts:** 6 visible FAQ · 6 FAQPage schema · **100% alignment** on wired slugs.

### FAQ / schema opportunities

| Target | Priority | Notes |
|--------|----------|-------|
| `what-is-diamond-color` | **P1** | Part of Phase 5A; create `color-educational.ts` |
| `diamond-buying-tips-from-jewelers` | **P2** | After color flagship |
| `why-work-with-a-graduate-gemologist` | **P2** | Trust surface |
| Shape guides | **P3** | Optional |

**Guardrail:** Do not add FAQ schema to merge/redirect watch articles.

---

## 7. Primary action classification (all 100 articles)

### Framework

Each article has **one mutually exclusive primary recommended action** for planning purposes. Counts **sum to 100**.

| Primary action | Count | Definition |
|----------------|------:|------------|
| **A — Mature / leave as-is** | **15** | Flagship-quality or cluster-complete; no substantive content work scheduled |
| **B — Substantial rewrite** | **1** | Flagship build or near-complete reconception |
| **C — Moderate expansion** | **24** | Add depth, tables, or expert framing where intent warrants |
| **D — Light refresh** | **27** | Openings, links, related arrays, minor copy — not length padding |
| **E — Intentionally concise** | **8** | Narrow intent fully served at current length |
| **F — Merge / redirect watch** | **22** | Do not expand; monitor GSC; execute redirects when absorption confirmed |
| **G — Bridge / linking only** | **3** | Cross-cluster connectors; linking and hub placement only |

**Overlap note:** Secondary tags (e.g. “needs hero” on mature clarity/cut flagships) are **not** separate primary actions. Hero work is tracked in §4. Hub misalignment is ecosystem work in §14, not an article primary action.

### Priority tier (next sprint relevance) — all 100 articles

Each article is assigned **exactly one** priority tier. **P0 + P1 + P2 + P3 = 100.**

| Tier | Count | Meaning |
|------|------:|---------|
| **P0** | **4** | Urgent: color flagship build + clarity/cut hero gaps |
| **P1** | **13** | Strategic: color support, buying pillar visual, hub-adjacent content |
| **P2** | **33** | Moderate: expansion, linking passes, Charlotte/size depth |
| **P3** | **50** | Low/defer: mature library, merge watch, concise URLs, shape polish |

**Prior appendix mismatch (resolved):** Totals of 8 + 22 + 38 + 31 = **99** because they counted **backlog themes** (hub fixes, cannibalization watches) mixed with article assignments, and **`first-30-days-after-you-get-engaged`** plus **`independent-diamond-advisor-vs-jewelry-store`** were not consistently classified. The table below assigns every slug.

### Full article register (slug → primary action → priority)

| # | Slug | Primary | Pri |
|---|------|---------|-----|
| 1 | `how-to-read-a-diamond-certificate` | A | P3 |
| 2 | `natural-vs-lab-diamonds` | A | P3 |
| 3 | `what-is-diamond-fluorescence` | A | P3 |
| 4 | `what-is-diamond-clarity` | A | **P0** |
| 5 | `what-is-diamond-cut` | A | **P0** |
| 6 | `charlotte-diamond-advisor-guide` | A | P3 |
| 7 | `independent-diamond-advisor-vs-jewelry-store` | A | P3 |
| 8 | `diamond-buying-tips-from-jewelers` | A | P1 |
| 9 | `best-places-to-propose-in-charlotte` | A | P3 |
| 10 | `how-to-plan-a-proposal-in-charlotte` | A | P3 |
| 11 | `how-to-plan-a-proposal-she-will-never-forget` | A | P3 |
| 12 | `most-romantic-restaurants-charlotte-engagement-celebration` | A | P3 |
| 13 | `first-30-days-after-you-get-engaged` | A | P3 |
| 14 | `best-charlotte-rooftop-proposal-locations` | A | P3 |
| 15 | `when-fluorescence-improves-a-diamond` | A | P3 |
| 16 | `what-is-diamond-color` | **B** | **P0** |
| 17 | `diamond-color-chart-explained` | F | P1 |
| 18 | `near-colorless-diamonds-explained` | C | P1 |
| 19 | `does-diamond-color-matter` | C | P1 |
| 20 | `can-you-see-diamond-color` | C | P1 |
| 21 | `best-diamond-color-for-engagement-rings` | C | P1 |
| 22 | `are-all-diamond-certificates-the-same` | C | P1 |
| 23 | `charlotte-engagement-ring-guide` | C | P1 |
| 24 | `buy-diamonds-in-charlotte` | C | P1 |
| 25 | `custom-engagement-rings-in-charlotte` | C | P1 |
| 26 | `diamond-price-vs-quality` | C | P1 |
| 27 | `diamond-size-on-hand` | C | P1 |
| 28 | `what-diamond-shape-looks-the-largest` | C | P1 |
| 29 | `ideal-diamond-cut-proportions` | C | P2 |
| 30 | `diamond-sparkle-explained` | C | P2 |
| 31 | `what-is-diamond-brilliance` | C | P2 |
| 32 | `diamond-fire-explained` | C | P2 |
| 33 | `what-is-diamond-scintillation` | C | P2 |
| 34 | `do-fancy-shape-diamonds-have-cut-grades` | C | P2 |
| 35 | `best-diamond-clarity-for-engagement-rings` | C | P2 |
| 36 | `diamond-size-chart` | C | P2 |
| 37 | `how-big-is-a-1-carat-diamond` | C | P2 |
| 38 | `how-big-is-a-2-carat-diamond` | C | P2 |
| 39 | `best-carat-size-for-an-engagement-ring` | C | P2 |
| 40 | `how-to-make-a-diamond-look-bigger` | C | P2 |
| 41 | `diamond-size-guide-for-charlotte-engagement-rings` | C | P2 |
| 42 | `how-lighting-affects-diamonds` | C | P2 |
| 43 | `diamond-contrast-patterns-explained` | C | P2 |
| 44 | `why-diamond-certification-matters` | C | P2 |
| 45 | `why-work-with-a-graduate-gemologist` | D | P2 |
| 46 | `excellent-vs-very-good-diamond-cut` | D | P2 |
| 47 | `eye-clean-diamonds-explained` | D | P2 |
| 48 | `vs1-vs-vs2-diamond-clarity` | D | P2 |
| 49 | `diamond-light-leakage-explained` | D | P2 |
| 50 | `diamond-light-return-explained` | D | P2 |
| 51 | `oval-vs-round-diamond` | D | P2 |
| 52 | `round-diamond-guide` | D | P2 |
| 53 | `oval-diamond-guide` | D | P2 |
| 54 | `cushion-diamond-guide` | D | P2 |
| 55 | `emerald-diamond-guide` | D | P2 |
| 56 | `pear-diamond-guide` | D | P2 |
| 57 | `marquise-diamond-guide` | D | P2 |
| 58 | `princess-diamond-guide` | D | P2 |
| 59 | `radiant-diamond-guide` | D | P2 |
| 60 | `asscher-diamond-guide` | D | P2 |
| 61 | `gia-diamond-certification-explained` | D | P2 |
| 62 | `gcal-8x-diamond-certification-explained` | D | P2 |
| 63 | `diamond-carat-vs-size` | D | P2 |
| 64 | `do-elongated-diamonds-look-bigger` | D | P2 |
| 65 | `diamond-cut-vs-polish-vs-symmetry` | D | P2 |
| 66 | `what-makes-a-diamond-cut-good-or-bad` | D | P2 |
| 67 | `is-diamond-cut-the-most-important-c` | G | P2 |
| 68 | `diamond-color-vs-clarity` | G | P2 |
| 69 | `diamond-cut-vs-diamond-shape` | G | P2 |
| 70 | `do-lab-grown-diamonds-have-certificates` | G | P2 |
| 71 | `what-is-a-carat` | E | P3 |
| 72 | `d-vs-e-vs-f-diamond-color` | E | P3 |
| 73 | `g-vs-h-diamond-color` | E | P3 |
| 74 | `are-colorless-diamonds-worth-it` | E | P3 |
| 75 | `when-is-the-best-time-to-buy-a-diamond` | E | P3 |
| 76 | `igi-diamond-certification-explained` | E | P3 |
| 77 | `does-diamond-cut-affect-size` | E | P3 |
| 78 | `fluorescence-in-natural-vs-lab-diamonds` | E | P3 |
| 79 | `best-diamond-shapes-charlotte` | D | P3 |
| 80 | `best-proposal-photographers-in-charlotte` | D | P3 |
| 81 | `what-is-a-diamond-certificate` | F | P3 |
| 82 | `what-is-a-diamond-report-number` | F | P3 |
| 83 | `ags-diamond-certification-explained` | F | P3 |
| 84 | `hrd-diamond-certification-explained` | F | P3 |
| 85 | `are-lab-diamonds-a-good-choice` | F | P3 |
| 86 | `is-diamond-fluorescence-good-or-bad` | F | P3 |
| 87 | `should-you-avoid-diamond-fluorescence` | F | P3 |
| 88 | `does-fluorescence-affect-diamond-value` | F | P3 |
| 89 | `can-you-see-diamond-fluorescence` | F | P3 |
| 90 | `strong-blue-fluorescence-diamond` | F | P3 |
| 91 | `diamond-fluorescence-chart-explained` | F | P3 |
| 92 | `when-fluorescence-is-bad` | F | P3 |
| 93 | `diamond-clarity-chart-explained` | F | P3 |
| 94 | `what-is-si1-clarity` | F | P3 |
| 95 | `can-you-see-diamond-inclusions` | F | P3 |
| 96 | `diamond-blemishes-vs-inclusions` | F | P3 |
| 97 | `are-flawless-diamonds-worth-it` | F | P3 |
| 98 | `how-diamond-cut-affects-sparkle` | F | P3 |
| 99 | `how-diamond-cut-affects-light-performance` | F | P3 |
| 100 | `best-light-performance-in-a-diamond` | F | P3 |

**Verification:** 15 + 1 + 24 + 27 + 8 + 22 + 3 = **100** primary actions · 4 + 13 + 33 + 50 = **100** priority tiers.

---

## 8. Cluster-by-cluster maturity review

| Cluster | Articles | Flagship | Hero cov. | Editorial | FAQ/schema | Maturity | Next phase |
|---------|----------:|----------|-----------|-----------|------------|----------|------------|
| **Certificate** | 11 | `how-to-read-a-diamond-certificate` | 2/11 | 0 | 1/1 FLG | Mature | 5E redirects |
| **Lab / natural** | 4 | `natural-vs-lab-diamonds` | 2/4 | 0 | 1/1 FLG | Mature | 5E merge watch |
| **Fluorescence** | 10 | `what-is-diamond-fluorescence` | 3/10 | 1 FLG | 1/1 FLG | Mature | 5E redirects |
| **Clarity** | 9 (+1 bridge) | `what-is-diamond-clarity` | 0/9 FLG | 1 FLG | 1/1 FLG | Copy mature | **5B hero** |
| **Cut / light** | 22 | `what-is-diamond-cut` | 1/22 FLG | 2 FLG + 1 SUP | 1/1 FLG | Copy mature | **5B hero**; 5C hub |
| **Color** | 11 | `what-is-diamond-color` | 0/11 | 0 | 0 | **Immature** | **5A** |
| **Carat / size** | 11 | `diamond-size-chart` | 2/11 | 1+CSS | 0 | Good | 5D linking |
| **Shapes** | 10 | Per-shape guides | 10/10 | 0 | 0 | Visual strong | **5D** linking |
| **Buying** | 9 | `diamond-buying-tips-from-jewelers` | 2/9 | 0 | 0 | Good | P1 hero optional |
| **Charlotte** | 6 | `charlotte-diamond-advisor-guide` | 2/6 | 0 | 1/1 FLG | Mature advisor | P2 satellites |
| **Proposal** | 7 | Places + plan Charlotte | 0/7 | 0 | 0 | Mature | P3 polish only |

---

## 9. Content-depth guidance (intent-based)

### Editorial length ranges (guidance only — not targets)

| Article type | Typical useful range | When shorter is correct |
|--------------|---------------------|-------------------------|
| **Flagship** | 1,200–1,800 words | Never pad; stop when intent is fully served |
| **Major support** | 900–1,300 words | Commercial guides with clear sections |
| **Narrow support / bridge** | 500–900 words | Comparisons, definitional primers |
| **Direct-answer / merge watch** | 250–600 words | Concise answer + pointer to flagship |

### Substantial rewrite (1 article)

| Slug | Current words | Notes |
|------|-------------:|-------|
| `what-is-diamond-color` | 899 | Only Four Cs cluster without flagship treatment, FAQ, schema, chart |

`diamond-color-chart-explained` is **merge/redirect watch** (absorb into color flagship), not a separate rewrite.

### Moderate expansion candidates (24 articles)

All **C — Moderate expansion** rows in §7: color satellites (5), Charlotte/size commercial (8), cut B/F/S and proportions (6), clarity engagement (1), cert comparison (1), size chart (1), lighting/contrast (2), cert trust primer (1).

### Intentionally concise (8 articles)

All **E** rows in §7 — comparisons, narrow definitions, bridges, seasonal timing.

### Merge / redirect watch (22 articles)

All **F** rows in §7. **Do not expand** before GSC observation. Full redirect inventory: `redirect-readiness-observation-plan.md` (14 URLs) plus clarity (5) and cut (3) satellites in cluster cleanup notes.

---

## 10. GEO / AI retrieval findings

### Strong surfaces

- Six FAQ flagships with question H2 + direct answers + Hourglass standards
- Long-form entity-rich prose on cert, lab, clarity, cut flagships
- Editorial scale charts (clarity, cut, fluorescence)
- CSS reference layouts (`diamond-size-chart`, `what-diamond-shape-looks-the-largest`)

### Weak surfaces

- Color cluster extractability lags other Four Cs flagships
- Shape guides lack direct-answer openings and GG/Hourglass framing
- Merge candidates create duplicate thin answers for AI crawlers
- 56 articles with ≤1 authority inline link

### GEO priorities (ranked)

1. Phase 5A color flagship (content + FAQ + schema)  
2. Phase 5C hub alignment (crawler/user hierarchy)  
3. Phase 5D shape linking + 2–3 sentence definitional openings  
4. Custom OG images (**P2** — preview differentiation only)  
5. GSC-driven redirect consolidation (Phase 5E)

---

## 11. Internal-linking and authority findings

| Destination | Articles linking |
|-------------|-----------------:|
| Diamond Intelligence | 37 |
| Concierge | 27 |
| Our Approach / The House | 27 |
| Graduate Gemologist article | 13 |
| Certificate flagship | 30 |
| Strong (3+ authority types) | 21 |
| Weak (0–1 authority types) | 56 |

**Next linking pass (Phase 5D):** Shape guides, color satellites post-flagship, merge-candidate hub de-emphasis. **Do not duplicate** Phase 2.4 cert/lab/fluorescence flagship reinforcement (`internal-linking-authority-pass.md`).

---

## 12. Diamond Guide hub / authority-section recommendations

### Known hub issues (Phase 5C)

| Location | Current issue | Fix |
|----------|---------------|-----|
| **Cut hub** `beginHereGuides` | Leads with `how-diamond-cut-affects-sparkle` | Prioritize **`what-is-diamond-cut`** |
| **Clarity hub** `beginHereGuides` | Includes merge candidate `diamond-clarity-chart-explained` | Prioritize **`what-is-diamond-clarity`** only |
| **Main hub** Popular Guides | Omits cert, clarity, cut, fluorescence flagships | Add flagship URLs alongside existing popular entries |

### Additional hub recommendations

| Priority | Recommendation |
|----------|----------------|
| P1 | “Start here” badge on flagship rows in `/all` index pages |
| P1 | Popular Guides refresh on main hub (cert, clarity, cut, fluorescence) |
| P2 | Contextual Diamond Intelligence module on Certification + Cut hubs |
| P2 | Breadcrumbs: `Diamond Guide / {Category} / {Title}` |
| P3 | Curated topic paths; last-reviewed dates (defer) |

---

## 13. Visual backlog

| Item | Type | Priority |
|------|------|----------|
| Hero: `what-is-diamond-clarity` | Photo/editorial | **P0** |
| Hero: `what-is-diamond-cut` | Photo/editorial | **P0** |
| Hero + chart: `what-is-diamond-color` | Photo + scale chart | **P1** (Phase 5A) |
| Hero: `diamond-buying-tips-from-jewelers` | Photo | **P1** |
| Hero: Charlotte/buying satellites | Photo | **P2** (selective) |
| Color temperature comparison diagram | Editorial | **P2** |
| Asset naming normalization | Hygiene | **P3** |

**Not recommended:** Heroes for all 77 non-hero articles.

---

## 14. Schema / FAQ opportunities

| Opportunity | Priority | Notes |
|-------------|----------|-------|
| `what-is-diamond-color` FAQPage | **P1** | Phase 5A |
| Buying tips / GG FAQPage | **P2** | After color |
| Article JSON-LD `image` | **P2** | Auto via live heroes (23 today) |
| **Custom `ogImage` per article** | **P2** | See §15 |
| FAQ on merge candidates | **No** | Conflicts with redirect plan |

---

## 15. Custom OG image priority (reclassified)

**Custom per-article OG images are not a core P0/P1 SEO requirement** based on current repo evidence.

### What OG images improve

- Social platform link previews (Facebook, LinkedIn, X)  
- Messaging-app link unfurls  
- Visual differentiation when URLs are shared  

### What OG images do **not** replace (higher priority)

1. Content depth and direct-answer structure  
2. Internal linking and authority pathways  
3. Hub alignment and flagship discoverability  
4. FAQPage schema accuracy where appropriate  
5. Crawler/AI clarity (headings, extractable sections, entity connections)  

### Default priority: **P2**

Wire `ogImage` on flagships **after** Phase 5A–5C unless a specific URL has unusual share volume (e.g. `natural-vs-lab-diamonds`, `charlotte-diamond-advisor-guide`). Rollout order: six FAQ flagships → commercial pillars → shape heroes. Site default OG (`/og/hourglass-diamonds-og.jpg`) remains acceptable until then.

---

## 16. Merge / redirect watchlist

**No redirects implemented.** 14 candidates in `redirect-readiness-observation-plan.md`; **22 articles** tagged **F — Merge/redirect watch** in §7 (includes clarity/cut satellites beyond the 14).

**Guardrails:** GSC observation 30–90 days · no expansion · hub de-emphasis before 301s · `first-30-days-after-you-get-engaged` is **not** a redirect candidate.

---

## 17. Recommended phased roadmap

### Phase 5A — Color cluster audit/consolidation

- Rewrite `what-is-diamond-color` to flagship standard (1,200–1,800 words if intent warrants)  
- Color scale editorial chart + hero  
- Visible FAQ + `colorFaqNode` schema  
- Plan absorption of `diamond-color-chart-explained`  
- Light refresh color satellites (openings + flagship pointers)

### Phase 5B — Clarity and Cut flagship heroes

- Live heroes for **`what-is-diamond-clarity`** and **`what-is-diamond-cut`**  
- Optional P1 hero: `diamond-buying-tips-from-jewelers`  
- No content rewrites required on clarity/cut flagships (already mature)

### Phase 5C — Hub authority alignment

- Cut hub “Begin here” → **`what-is-diamond-cut`**  
- Clarity hub → **`what-is-diamond-clarity`** only (remove chart merge candidate from start slot)  
- Main hub Popular Guides → cert, clarity, cut, fluorescence flagships  
- Flagship badges on `/all` pages  
- Optional DI module on cert/cut hubs

### Phase 5D — Shape authority / internal-linking pass

- Definitional openings on shape guides  
- Cut flagship + Studio + selective DI links  
- Color satellite linking after 5A  
- Do not mass-expand shape word count

### Phase 5E — GSC-based redirect decisions

- Execute `redirect-readiness-observation-plan.md` in batches  
- Fluorescence cluster first if absorption confirmed  
- Clarity/cut satellite redirects after flagship ranking proof

### Phase 5F — Polish (ongoing, P2–P3)

- Custom OG images (P2)  
- Asset naming hygiene (P3)  
- Proposal optional heroes (P3)  
- Topic path UI (P3)

---

## 18. Immediate next sprint recommendation

**Phase 5A — Color cluster audit/consolidation**

1. Flagship rewrite `what-is-diamond-color`  
2. `what-is-diamond-color-scale-chart.png` + hero  
3. `color-educational.ts` + FAQPage wiring  
4. Satellite opening pointers; chart article absorption plan  
5. Schedule Phase 5B clarity/cut heroes in parallel (assets only)

**Out of scope:** Redirects, sitemap, unrelated hub code, OG rollout (defer to 5F).

---

## 19. Interpretation of the numbers

### Why 77 missing heroes ≠ 77 tasks

Only **9 articles** have recommended hero work among the 77 without live heroes (2 P0 + 3 P1 + 4 P2 selective). The other **68** are text-led, merge-watch, already visualized via CSS, or commercially low-leverage. Uniform hero coverage would add production cost without proportional SEO or conversion return.

### Why not every article should exceed 1,000 words

**23 articles** are under 400 words; **22** are merge/redirect watch where expansion would complicate consolidation. Comparison URLs (`g-vs-h`, `d-vs-e-vs-f`) and definitional primers (`what-is-a-carat`) satisfy intent concisely. Padding would dilute flagship authority and confuse AI extractors with duplicate prose.

### Why mature flagships and hub alignment matter more than mechanical expansion

**15 articles** are already mature (including `first-30-days-after-you-get-engaged` and `independent-diamond-advisor-vs-jewelry-store`, which were omitted from the prior priority rollup). The highest leverage is: (1) complete the **one** immature Four Cs cluster (color), (2) close **two** flagship hero gaps, (3) fix **hub misalignment** so users and crawlers see correct hierarchy, (4) observe GSC before redirects. Expanding all 100 pages would cost more than it returns.

### Why redirects remain deferred

**22 articles** overlap flaggedship intent. Phase 2 copy consolidation added pointers and FAQ absorption on flagships, but URLs remain live so GSC can show whether queries moved. Premature 301s risk losing rankings on satellite URLs that still earn clicks. Redirects are a **Phase 5E** decision, not a marketing-sprint default.

### Priority count correction summary

| Issue | Resolution |
|-------|------------|
| 8+22+38+31 = 99 | Old appendix mixed **backlog themes** with article counts |
| Missing article | **`first-30-days-after-you-get-engaged`** (mature P3) and **`independent-diamond-advisor-vs-jewelry-store`** (mature P3) were not in the theme rollup |
| New standard | **§7 register** assigns every slug exactly one primary action (100) and one priority tier (100) |

---

## 20. Risks and guardrails

| Risk | Mitigation |
|------|------------|
| Expanding merge candidates | Tag **F** — no expansion pre-redirect |
| Word-count padding | Intent/complexity test; use §9 ranges as guidance only |
| FAQ schema on thin URLs | Flagships only |
| Hero uniformity creep | §4 selective framework |
| OG over-prioritization | §15 — P2 default |
| Hub ahead of content | 5C after 5A color flagship |
| Cannibalization impatience | 5E GSC windows |
| Stale planning docs | This audit + cluster cleanup notes are current |

---

## Appendix A — Summary counts

| Metric | Count |
|--------|------:|
| Total articles | 100 |
| Live heroes | 23 |
| Without live hero | 77 |
| Hero production recommended | 9 (2 P0 + 3 P1 + 4 P2) |
| Intentionally no hero (among 77 gaps) | 68 |
| Editorial image articles | 6 |
| Visible FAQ | 6 |
| FAQPage schema | 6 |
| Broken hero wiring | 0 |

### Primary action totals (mutually exclusive)

| Action | Count |
|--------|------:|
| A — Mature | 15 |
| B — Substantial rewrite | 1 |
| C — Moderate expansion | 24 |
| D — Light refresh | 27 |
| E — Intentionally concise | 8 |
| F — Merge/redirect watch | 22 |
| G — Bridge/linking only | 3 |
| **Total** | **100** |

### Priority tier totals (mutually exclusive)

| Tier | Count |
|------|------:|
| P0 | 4 |
| P1 | 13 |
| P2 | 33 |
| P3 | 50 |
| **Total** | **100** |

## Appendix B — Rendering / schema reference

| Surface | Location | Behavior |
|---------|----------|----------|
| Article data | `app/diamond-guide/articles.ts` | 100 articles; hero + editorial blocks |
| Page render | `app/diamond-guide/[slug]/page.tsx` | Hero, blocks, related, Concierge CTA |
| Hero gate | `lib/diamond-guide/article-imagery.ts` | `enableHeroImagery: true`; live status required |
| FAQ schema | `lib/seo/schema/entities.ts` + educational modules | 6 slugs in `buildPageJsonLd` |
| Metadata | `lib/seo/diamond-guide-metadata.ts` | Default OG when no `ogImage` |

---

*Audit performed read-only against repo state July 6, 2026. Article register traced to `articles.ts` slug enumeration (100 slugs). Prior priority appendix superseded by §7.*
