# Clarity Cluster — Phase 3C Cleanup Notes

**Sprint date:** June 30, 2026  
**Flagship:** `what-is-diamond-clarity`  
**Status:** Content consolidated + FAQ/schema wired; redirects not implemented (deferred)

---

## Final end-state (5 clarity-relevant URLs)

| Slug | Role after cleanup |
|------|-------------------|
| `what-is-diamond-clarity` | **Flagship** (major rewrite + GIA scale section placeholder + visible FAQ + FAQPage JSON-LD) |
| `eye-clean-diamonds-explained` | **Supporting** (eye-clean concept satellite) |
| `best-diamond-clarity-for-engagement-rings` | **Supporting** (engagement buying / conversion) |
| `vs1-vs-vs2-diamond-clarity` | **Supporting** (grade comparison) |
| `diamond-color-vs-clarity` | **Color-cluster bridge** (tradeoff article; light touch) |

---

## Phase 3C changes shipped

### Flagship (`what-is-diamond-clarity`)

- Major rewrite and expansion (~1,200+ words)
- Direct answer near top; advisor opening anecdote retained
- Absorbed content themes from merge candidates:
  - Inclusions vs blemishes (from `diamond-blemishes-vs-inclusions`)
  - Full GIA scale FL through I1/I2/I3 (from `diamond-clarity-chart-explained`)
  - Eye-clean definition (summarized; deep dive stays on satellite)
  - Visibility / when inclusions show (from `can-you-see-diamond-inclusions`)
  - FL worth-it framing (from `are-flawless-diamonds-worth-it`)
  - SI1/SI2 practical guidance (from `what-is-si1-clarity`)
- Added **“The GIA Clarity Scale”** section as written placeholder (no chart image wired)
- Hourglass standards documented: no I1–I3; SI2 requires inspection
- Graduate Gemologist perspective + Charlotte/regional/national context
- Natural links to DI, Concierge, cert flagship, support articles, cut/color hubs, GG article
- Six visible FAQ H2 blocks matching `CLARITY_FAQS`
- New `lib/seo/clarity-educational.ts` + `clarityFaqNode()` in `page.tsx`
- **No hero, no OG, no in-article chart image**

### Support articles

| Article | Edit level | Changes |
|---------|------------|---------|
| `eye-clean-diamonds-explained` | Light–moderate | Opening pointer to flagship; SI2 inspection note; related cleanup |
| `best-diamond-clarity-for-engagement-rings` | Light–moderate | Hourglass I1–I3 / SI2 standards; related cleanup (flagship first) |
| `vs1-vs-vs2-diamond-clarity` | Light | Opening pointer to flagship; eye-clean link; related cleanup |
| `diamond-color-vs-clarity` | Light | Clarity + color flagship links in opening; related adds clarity flagship |

### Merge candidates (opening pointers only; bodies intact)

| Slug | Pointer added |
|------|---------------|
| `diamond-clarity-chart-explained` | Yes |
| `what-is-si1-clarity` | Yes |
| `can-you-see-diamond-inclusions` | Yes |
| `diamond-blemishes-vs-inclusions` | Yes |
| `are-flawless-diamonds-worth-it` | Yes |

Related arrays updated to list flagship first where applicable.

---

## Recommended merges and redirects (not implemented)

Execute after GSC observation (30–90 days suggested; mirror fluorescence Phase 2.5/2.6).

| Source slug | Target slug | Content absorbed into | Redirect | Timing |
|-------------|-------------|----------------------|----------|--------|
| `diamond-clarity-chart-explained` | `what-is-diamond-clarity` | GIA scale H2s + per-grade practice | 301 deferred | 60–90d GSC |
| `what-is-si1-clarity` | `what-is-diamond-clarity` | SI1/SI2 practice section | 301 deferred | 30–60d GSC |
| `can-you-see-diamond-inclusions` | `what-is-diamond-clarity` | Visibility + cut masking | 301 deferred | 30d GSC |
| `diamond-blemishes-vs-inclusions` | `what-is-diamond-clarity` | Inclusions vs blemishes H2 | 301 deferred | 30d GSC |
| `are-flawless-diamonds-worth-it` | `what-is-diamond-clarity` | FL/IF worth-it FAQ + overpayment | 301 deferred | 60–90d GSC |

**Do not redirect yet:**

- Flagship must rank for definitional + chart + eye-clean queries first
- Support satellites must retain distinct commercial/concept intent
- Update inbound links before redirect batch

---

## Content preserved by target

### Flagship (`what-is-diamond-clarity`)

- FL–I3 scale definitions from `diamond-clarity-chart-explained`
- Inclusion vs blemish definitions from `diamond-blemishes-vs-inclusions`
- Naked-eye visibility from `can-you-see-diamond-inclusions`
- FL premium / worth-it from `are-flawless-diamonds-worth-it`
- SI1 eye-clean value from `what-is-si1-clarity`

### Satellites (unchanged role)

- `eye-clean-diamonds-explained` keeps eye-clean deep dive
- `best-diamond-clarity-for-engagement-rings` keeps engagement-specific guidance
- `vs1-vs-vs2-diamond-clarity` keeps VS comparison detail

---

## Future visual plan (Phase 4A/4B — not this sprint)

| Asset | Action |
|-------|--------|
| `public/diamond-guide/clarity-scale-hero.png` | Rename to `what-is-diamond-clarity-scale-chart.png` at wiring time |
| Scale chart | Insert as `editorial-image` under **“The GIA Clarity Scale”** on flagship only |
| Flagship hero | Separate photographic hero (`what-is-diamond-clarity-hero.png`) in Phase 4A |
| Support heroes | `eye-clean-diamonds-explained`, `best-diamond-clarity-for-engagement-rings` in Phase 4B |

**Not wired in Phase 3C.** Live hero count remains **23**.

---

## Risks / human approval

| Risk | Mitigation |
|------|------------|
| Chart URL redirect loses exact-match traffic | Defer `diamond-clarity-chart-explained`; observe GSC 60–90d |
| SI1 URL redirect loses grade long-tail | Ensure flagship ranks for SI1 queries first |
| Hourglass I1–I3 policy in content | GG review if wording needs softening |
| FAQ/schema duplication | Shared `clarity-educational.ts` mirrors fluorescence pattern |

---

## Explicit guardrails confirmed

- No visuals wired
- `clarity-scale-hero.png` not touched, renamed, or referenced
- No redirects implemented
- No sitemap / middleware / `next.config.ts` changes
- Live hero count unchanged (23)

---

*Companion: [`clarity-cluster-visual-plan.md`](./clarity-cluster-visual-plan.md)*
