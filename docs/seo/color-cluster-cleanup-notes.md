# Color Cluster — Phase 5A Cleanup Notes

**Sprint date:** July 6, 2026  
**Flagship:** `what-is-diamond-color`  
**Status:** Content consolidated + FAQ/schema wired; redirects not implemented (deferred)  
**Companion audit:** [`diamond-guide-comprehensive-audit.md`](./diamond-guide-comprehensive-audit.md)

---

## Confirmed cluster inventory

### Core color cluster (10 articles)

| Slug | Role after Phase 5A |
|------|----------------------|
| `what-is-diamond-color` | **Flagship** (major rewrite + visible FAQ + FAQPage JSON-LD) |
| `near-colorless-diamonds-explained` | **Support** (G–J practical range) |
| `best-diamond-color-for-engagement-rings` | **Support** (commercial engagement guidance) |
| `does-diamond-color-matter` | **Support** (when color changes decisions) |
| `can-you-see-diamond-color` | **Support** (visibility vs laboratory grading) |
| `d-vs-e-vs-f-diamond-color` | **Narrow support** (colorless comparison) |
| `g-vs-h-diamond-color` | **Narrow support** (near colorless comparison) |
| `are-colorless-diamonds-worth-it` | **Narrow support** (D–F value framing) |
| `diamond-color-vs-clarity` | **Bridge** (color × clarity tradeoffs) |
| `diamond-color-chart-explained` | **Merge / redirect watch** (see decision below) |

### Related articles in `Diamond Color` category (fluorescence cluster — not Phase 5A scope)

These remain under the fluorescence flagship (`what-is-diamond-fluorescence`). Phase 5A did not rewrite them.

| Slug | Role |
|------|------|
| `what-is-diamond-fluorescence` | Fluorescence flagship |
| `when-fluorescence-improves-a-diamond` | Fluorescence support |
| `when-fluorescence-is-bad` | Merge watch |
| `is-diamond-fluorescence-good-or-bad` | Merge watch |
| `should-you-avoid-diamond-fluorescence` | Merge watch |
| `does-fluorescence-affect-diamond-value` | Merge watch |
| `can-you-see-diamond-fluorescence` | Merge watch |
| `strong-blue-fluorescence-diamond` | Merge watch |
| `diamond-fluorescence-chart-explained` | Merge watch |
| `fluorescence-in-natural-vs-lab-diamonds` | Bridge (origin × fluorescence) |

### Fancy color

No fancy-color articles exist in the Diamond Guide corpus. D–Z white-diamond color only.

---

## Phase 5A changes shipped

### Flagship (`what-is-diamond-color`)

- Major rewrite with direct answer near top; advisor anecdote retained
- Sections added or strengthened:
  - What diamond color actually measures
  - Why color usually means absence of color
  - **The GIA Diamond Color Scale** (text-only placeholder; no chart image)
  - What each range means in practice (colorless through faint/lower)
  - What buyers actually notice
  - Face-up appearance versus laboratory grading
  - Shape, carat, and metal influences (white gold/platinum; yellow/rose gold)
  - Color versus clarity; color versus cut
  - Natural versus lab-grown color
  - Why two same-grade stones differ
  - Fluorescence interaction (pointer to fluorescence flagship)
  - Report limitations
  - Hourglass color standards
  - Graduate Gemologist perspective
  - Charlotte / regional / national context
  - Diamond Intelligence and Concierge pathways
- Six visible FAQ H2 blocks matching `COLOR_FAQS` verbatim
- New `lib/seo/color-educational.ts` + `colorFaqNode()` in `page.tsx` and `entities.ts`
- **No hero, no OG, no in-article chart image** (deferred to visual sprint)

### Support articles (light–moderate)

| Article | Changes |
|---------|---------|
| `near-colorless-diamonds-explained` | Opening flagship pointer; related reordered (flagship first) |
| `does-diamond-color-matter` | Opening flagship pointer; related reordered |
| `best-diamond-color-for-engagement-rings` | Opening strengthened; related reordered |
| `can-you-see-diamond-color` | Opening flagship pointer; related reordered |
| `d-vs-e-vs-f-diamond-color` | Opening flagship pointer only |
| `g-vs-h-diamond-color` | Opening flagship pointer only |
| `are-colorless-diamonds-worth-it` | Opening flagship pointer only |

### Bridge (`diamond-color-vs-clarity`)

- Added cut flagship link in tradeoff section
- Related reordered: color flagship first, then clarity flagship, then cut

### Merge watch (`diamond-color-chart-explained`)

**Decision: Treatment B — merge/redirect watchlist**

- Body retained intact for GSC observation
- Opening pointer added to color flagship
- Related reordered with flagship first; chart article remains live
- Rationale: scale content substantially overlaps flagship GIA scale section, but URL may still earn chart-intent queries; absorb after flagship ranks

**Do not redirect yet:** Execute after 60–90 days GSC observation per comprehensive audit Phase 5E.

---

## FAQ / schema

| File | Purpose |
|------|---------|
| `lib/seo/color-educational.ts` | `COLOR_FAQS` single source of truth |
| `lib/seo/schema/entities.ts` | `colorFaqNode()` |
| `app/diamond-guide/[slug]/page.tsx` | `COLOR_SLUG` + FAQ graph merge |

FAQPage JSON-LD emitted **only** on `what-is-diamond-color`. Visible FAQ copy matches schema answers exactly.

---

## Internal linking added or strengthened

**From flagship:**

- `what-is-diamond-clarity`, `what-is-diamond-cut`, `what-is-diamond-fluorescence`
- `natural-vs-lab-diamonds`, `how-to-read-a-diamond-certificate`
- `why-work-with-a-graduate-gemologist`, `diamond-color-vs-clarity`
- `/diamond-intelligence`, `/concierge`, `/our-approach`

**Into flagship (from support/bridge):**

- All core support articles now open with flagship pointer
- Bridge and merge-watch articles link flagship first in related arrays

---

## Deferred visual work (Phase 5B+)

- Color scale editorial chart (`what-is-diamond-color-scale-chart.png`)
- Flagship hero image
- Per-article `ogImage`
- Do not ship until dedicated color visual sprint

---

## Risks and guardrails

- Do not expand `diamond-color-chart-explained` before GSC shows flagship absorption
- Do not add FAQ schema to support or merge-watch URLs
- Do not pad flagship for word count; length follows intent
- Fluorescence articles remain separate cluster; color flagship links out, does not absorb fluorescence bodies

---

## Future GSC observation (redirect candidate)

| Source slug | Target | When |
|-------------|--------|------|
| `diamond-color-chart-explained` | `what-is-diamond-color` | After flagship ranks for chart/scale queries; 60–90d suggested |

---

*Prior cluster docs: fluorescence, clarity, cut cleanup notes in `docs/seo/`. Comprehensive audit: [`diamond-guide-comprehensive-audit.md`](./diamond-guide-comprehensive-audit.md).*
