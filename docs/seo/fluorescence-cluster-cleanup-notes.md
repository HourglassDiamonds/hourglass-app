# Fluorescence Cluster — Phase 2.3B Cleanup Notes

**Sprint date:** June 30, 2026  
**Flagship:** `what-is-diamond-fluorescence`  
**Status:** Content upgraded + flagship visuals wired; redirects not implemented (deferred)

---

## Final end-state (3 URLs)

| Slug | Role after cleanup |
|------|-------------------|
| `what-is-diamond-fluorescence` | **Flagship** (hero + in-article scale chart + FAQ) |
| `when-fluorescence-improves-a-diamond` | **Supporting** (buying: helps vs hurts) |
| `fluorescence-in-natural-vs-lab-diamonds` | **Supporting** (origin bridge) |

---

## Phase 2.3B changes shipped

- Major rewrite of flagship (~1,200+ words) with direct answer, GIA scale, per-grade guidance, value/color/origin sections, GG perspective, Charlotte/regional + national context, DI and Concierge CTAs, visible FAQ, FAQPage JSON-LD
- Hero wired: `what-is-diamond-fluorescence-hero.png` (`visualStatus: "live"`, `visualCategory: "original-photo"`)
- In-article chart wired: `what-is-diamond-fluorescence-scale-chart.png` via `editorial-image` block (not page hero)
- Source assets normalized: `fluorescence hero.png` and `fluor-hero.png` removed after slug-based copies created
- Major rewrite of `when-fluorescence-improves-a-diamond` as buying satellite (absorbs negative-case ideas from `when-fluorescence-is-bad`)
- Light edit of `fluorescence-in-natural-vs-lab-diamonds` (flagship + cert + DI pointers)
- Seven merge candidates received opening flagship pointers only; bodies otherwise intact
- `lib/seo/fluorescence-educational.ts` + `fluorescenceFaqNode()` wired in `page.tsx`
- Live hero count in schema test: 20 → **21**
- No `ogImage` on flagship (site default OG retained)
- `clarity-scale-hero.png` not touched

---

## Recommended merges and redirects (not implemented)

Execute after monitoring flagship performance and search absorption (8–12 weeks suggested).

| Source slug | Target slug | Content absorbed into | Redirect | Timing |
|-------------|-------------|----------------------|----------|--------|
| `is-diamond-fluorescence-good-or-bad` | `what-is-diamond-fluorescence` | Flagship FAQ + good/bad H2s | 301 deferred | After GSC absorption |
| `should-you-avoid-diamond-fluorescence` | `what-is-diamond-fluorescence` | Flagship FAQ + harmless/inspect H2s | 301 deferred | After GSC absorption |
| `does-fluorescence-affect-diamond-value` | `what-is-diamond-fluorescence` | Flagship value/pricing section | 301 deferred | After GSC absorption |
| `can-you-see-diamond-fluorescence` | `what-is-diamond-fluorescence` | Flagship visibility + grade sections | 301 deferred | After GSC absorption |
| `strong-blue-fluorescence-diamond` | `what-is-diamond-fluorescence` | Flagship Strong/Very Strong + buying satellite context | 301 deferred | After GSC absorption |
| `diamond-fluorescence-chart-explained` | `what-is-diamond-fluorescence` | In-flagship scale chart + per-grade H2s | 301 deferred | After GSC absorption |
| `when-fluorescence-is-bad` | `when-fluorescence-improves-a-diamond` | Buying satellite "When Fluorescence Can Hurt" | 301 deferred | After GSC absorption |

**Do not redirect yet:**

- Flagship must rank for definitional + chart + good/bad queries first
- Buying satellite must absorb "when is fluorescence bad" intent
- Update all inbound `related` links and inline refs before redirect batch

---

## Content preserved by target

### Flagship (`what-is-diamond-fluorescence`)

- Five-grade scale definitions from `diamond-fluorescence-chart-explained`
- Visibility / UV demonstration from `can-you-see-diamond-fluorescence`
- Good/bad framing from `is-diamond-fluorescence-good-or-bad`
- Avoidance / opportunity from `should-you-avoid-diamond-fluorescence`
- Pricing from `does-fluorescence-affect-diamond-value`
- Strong blue context from `strong-blue-fluorescence-diamond`

### Buying satellite (`when-fluorescence-improves-a-diamond`)

- Negative cases from `when-fluorescence-is-bad` (haze, high color scrutiny)
- Strong blue buying checklist (from `strong-blue-fluorescence-diamond`)

### Origin bridge (unchanged role)

- `fluorescence-in-natural-vs-lab-diamonds` keeps growth-origin distinction

---

## Visual batch deferred

| Slug | Hero in 2.3B? | Notes |
|------|---------------|-------|
| `what-is-diamond-fluorescence` | **Yes** | Hero + scale chart |
| `when-fluorescence-improves-a-diamond` | No | Future visual batch |
| `fluorescence-in-natural-vs-lab-diamonds` | No | Future visual batch |
| 7 merge candidates | No | Redirect after absorption |

---

## Risks

| Risk | Mitigation |
|------|------------|
| Duplicate URLs until redirect batch | Opening paragraphs on satellites point to flagship |
| "Good or bad" exact-match URL retained temporarily | Flagship FAQ targets query |
| Strong fluorescence pricing claims | Balanced copy; GG review if needed |
| Chart asset only on flagship | Do not replicate on satellites |

---

*Companion: [`fluorescence-cluster-consolidation-plan.md`](./fluorescence-cluster-consolidation-plan.md)*
