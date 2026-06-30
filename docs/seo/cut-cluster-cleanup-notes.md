# Cut / Light Performance Cluster — Phase 4B Cleanup Notes

**Sprint date:** June 30, 2026  
**Flagship:** `what-is-diamond-cut`  
**Status:** Content consolidated + FAQ/schema wired; redirects not implemented (deferred)  
**Companion audit:** [`cut-light-performance-cluster-visual-plan.md`](./cut-light-performance-cluster-visual-plan.md)

---

## Final end-state (12 surviving core URLs + bridges)

| Slug | Role after cleanup |
|------|-------------------|
| `what-is-diamond-cut` | **Flagship** (major rewrite + GIA scale section placeholder + visible FAQ + FAQPage JSON-LD) |
| `excellent-vs-very-good-diamond-cut` | **Support** (grade bucket comparison) |
| `ideal-diamond-cut-proportions` | **Support** (proportion reference ranges) |
| `diamond-cut-vs-polish-vs-symmetry` | **Support** (report field definitions) |
| `diamond-sparkle-explained` | **Support** (sparkle vocabulary hub) |
| `diamond-light-return-explained` | **Support** (light return satellite; live hero retained) |
| `what-is-diamond-brilliance` | **Support** (B/F/S trilogy) |
| `diamond-fire-explained` | **Support** (B/F/S trilogy) |
| `what-is-diamond-scintillation` | **Support** (B/F/S trilogy) |
| `what-makes-a-diamond-cut-good-or-bad` | **Tier 2 watch** (light touch) |
| `do-fancy-shape-diamonds-have-cut-grades` | **Tier 2 watch** (light touch) |
| `diamond-contrast-patterns-explained` | **Tier 2 watch** (light touch) |
| `diamond-cut-vs-diamond-shape` | **Bridge** (shapes cluster) |
| `is-diamond-cut-the-most-important-c` | **Bridge** (Four Cs) |
| `does-diamond-cut-affect-size` | **Bridge** (size cluster) |
| `how-lighting-affects-diamonds` | **Bridge** (viewing / environment) |

---

## Phase 4B changes shipped

### Flagship (`what-is-diamond-cut`)

- Major rewrite and expansion (~1,300–1,700 words)
- Direct answer near top; advisor anecdote (two Excellent rounds, different performance)
- Sections added or strengthened:
  - What diamond cut actually measures
  - Why cut is the most important quality factor
  - Cut vs shape
  - **“The GIA Cut Scale”** (written placeholder; no chart image wired)
  - What Excellent actually means
  - Cut vs polish vs symmetry (Triple Ex mentioned)
  - Proportions and why they matter
  - Brilliance, fire, and scintillation
  - Light return and light leakage
  - Why two Excellent diamonds can perform differently
  - Fancy shape cut considerations
  - Diamond Intelligence and beyond the grading report
  - Hourglass cut standards
  - Graduate Gemologist perspective
  - Charlotte / regional / national buying context
- Absorbed content themes from merge candidates (summarized; deep dives stay on satellites):
  - Cut → sparkle mechanics (`how-diamond-cut-affects-sparkle`)
  - Cut → full light performance (`how-diamond-cut-affects-light-performance`, `best-light-performance-in-a-diamond`)
  - Light leakage causes (`diamond-light-leakage-explained`)
- Natural links to DI, Concierge, cert flagship, support articles, clarity/color/natural/GG/Our Approach
- Six visible FAQ H2 blocks matching `CUT_FAQS`
- New `lib/seo/cut-educational.ts` + `cutFaqNode()` in `page.tsx` (mirrors clarity/fluorescence pattern)
- **No hero, no OG, no in-article chart image**

### Support articles (light–moderate)

| Article | Edit level | Changes |
|---------|------------|---------|
| `excellent-vs-very-good-diamond-cut` | Light–moderate | Opening pointer to flagship; strengthened transitions; related cleanup (flagship first) |
| `ideal-diamond-cut-proportions` | Light–moderate | Opening pointer; internal links to flagship + cert; related cleanup |
| `diamond-cut-vs-polish-vs-symmetry` | Light–moderate | Opening pointer; Triple Ex context; related cleanup |
| `diamond-sparkle-explained` | Light–moderate | Opening pointer; B/F/S cross-links; related cleanup |
| `diamond-light-return-explained` | Light–moderate | Opening pointer; flagship + leakage context; related cleanup |
| `what-is-diamond-brilliance` | Light–moderate | Opening pointer; sparkle umbrella link; related cleanup |
| `diamond-fire-explained` | Light–moderate | Opening pointer; trilogy links; related cleanup |
| `what-is-diamond-scintillation` | Light–moderate | Opening pointer; contrast patterns link; related cleanup |

### Tier 2 watch (very light)

| Article | Changes |
|---------|---------|
| `what-makes-a-diamond-cut-good-or-bad` | Opening pointer to flagship only |
| `do-fancy-shape-diamonds-have-cut-grades` | Opening pointer to flagship only |
| `diamond-contrast-patterns-explained` | Opening pointer to flagship only |

### Bridge articles (light touch)

| Article | Changes |
|---------|---------|
| `diamond-cut-vs-diamond-shape` | Opening flagship reference strengthened |
| `does-diamond-cut-affect-size` | Opening flagship reference strengthened |
| `is-diamond-cut-the-most-important-c` | Opening flagship reference strengthened |
| `how-lighting-affects-diamonds` | Opening flagship reference (environment vs craftsmanship) |

### Merge candidates (opening pointers only; bodies intact)

| Slug | Pointer added |
|------|---------------|
| `how-diamond-cut-affects-sparkle` | Yes → flagship |
| `how-diamond-cut-affects-light-performance` | Yes → flagship |
| `best-light-performance-in-a-diamond` | Yes → flagship |
| `diamond-light-leakage-explained` | Yes → flagship + light-return satellite |

Related arrays updated to list flagship first where applicable.

---

## Recommended merges and redirects (not implemented)

Execute after GSC observation (30–90 days suggested; mirror clarity Phase 3C/3D).

| Source slug | Target slug | Content absorbed into | Redirect | Timing |
|-------------|-------------|----------------------|----------|--------|
| `how-diamond-cut-affects-sparkle` | `what-is-diamond-cut` | Brilliance/fire/scintillation + sparkle FAQ | 301 deferred | 30–60d GSC |
| `how-diamond-cut-affects-light-performance` | `what-is-diamond-cut` | Light performance overview sections | 301 deferred | 30–60d GSC |
| `best-light-performance-in-a-diamond` | `what-is-diamond-cut` | Performance-first buying themes | 301 deferred | 60–90d GSC |
| `diamond-light-leakage-explained` | `diamond-light-return-explained` or flagship | Light leakage H2 on flagship; deep dive on return satellite | 301 deferred | 60–90d GSC |

**Do not redirect yet:**

- Flagship must rank for definitional + GIA scale + performance queries first
- Support satellites must retain distinct commercial/concept intent (B/F/S trilogy, proportions, grade comparison)
- `diamond-light-return-explained` retains live hero; absorb leakage after flagship ranks
- Update inbound links before redirect batch

---

## Content preserved by target

### Flagship (`what-is-diamond-cut`)

- Cut → sparkle summary from `how-diamond-cut-affects-sparkle`
- Holistic light performance framing from `how-diamond-cut-affects-light-performance` and `best-light-performance-in-a-diamond`
- Light leakage overview from `diamond-light-leakage-explained`

### Satellites (unchanged role)

- `excellent-vs-very-good-diamond-cut` keeps grade bucket comparison detail
- `ideal-diamond-cut-proportions` keeps proportion reference tables
- `diamond-cut-vs-polish-vs-symmetry` keeps report field definitions
- B/F/S trilogy articles keep per-effect deep dives
- `diamond-light-return-explained` keeps return mechanics + live hero
- Tier 2 articles keep niche evaluation content

---

## Future visual plan (Phase 4C+ — not this sprint)

| Asset / action | Notes |
|----------------|-------|
| GIA Cut Scale chart | Insert as `editorial-image` under **“The GIA Cut Scale”** on flagship only (text placeholder ready) |
| Flagship hero | `what-is-diamond-cut-hero.png` per visual plan Phase 4C |
| `diamond-light-return-explained` hero | Already live; retain |
| Support heroes | B/F/S trilogy, sparkle hub, proportions per visual plan backlog |
| Hearts & Arrows / Triple Ex / AGS Ideal | No dedicated articles today; consider future support or cert-bridge expansion |

**Not wired in Phase 4B.** Live hero count remains **23**.

---

## Implementation notes

| File | Change |
|------|--------|
| `lib/seo/cut-educational.ts` | New — `CUT_FAQS` (6 items) shared by article body and schema |
| `lib/seo/schema/entities.ts` | `cutFaqNode()` exports FAQPage JSON-LD |
| `app/diamond-guide/[slug]/page.tsx` | `CUT_SLUG` + conditional `cutFaqNode()` in `buildPageJsonLd` |
| `app/diamond-guide/articles.ts` | Flagship rewrite + cluster article edits |

**Schema isolation:** FAQPage JSON-LD only on `what-is-diamond-cut` (same pattern as clarity flagship).

**Internal linking targets strengthened:** Diamond Intelligence, how-to-read-a-diamond-certificate, what-is-diamond-clarity, what-is-diamond-color, natural-vs-lab-diamonds, Graduate Gemologist article, Concierge.

---

## Risks / human approval

| Risk | Mitigation |
|------|------------|
| Merge-candidate URLs lose long-tail traffic | Defer redirects; observe GSC 30–90d |
| Flagship cannibalizes support satellites | Support articles retain distinct H1/intent; flagship links out |
| Excellent-grade buyer confusion | FAQ + “two Excellent diamonds” section set expectations |
| FAQ/schema duplication | Shared `cut-educational.ts` mirrors clarity/fluorescence pattern |
| Light-return hero orphan if leakage merges | Defer leakage redirect until return satellite ranks |

---

## Explicit guardrails confirmed

- No visuals wired
- No hero images added
- No OG / article metadata changes (except FAQ/schema)
- No redirects implemented
- No sitemap / middleware / `next.config.ts` changes
- Diamond Intelligence, Supabase, homepage, Custom Design, Shape Studio untouched
- Live hero count unchanged (23)

---

*Companion: [`cut-light-performance-cluster-visual-plan.md`](./cut-light-performance-cluster-visual-plan.md)*
