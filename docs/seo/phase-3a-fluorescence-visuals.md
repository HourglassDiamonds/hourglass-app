# Phase 3A — Fluorescence Support Article Visual Sprint

**Sprint date:** June 30, 2026  
**Status:** Complete — ready for commit review  
**Prior work:** Phase 2.3B flagship visuals (`71dd4c4`), Phase 2.4 internal linking (`cd0e04f`), Phase 2.5 redirect plan (`03c511b`)

---

## Goal

Wire live editorial heroes for the two surviving fluorescence **support** articles, completing the visual system for the post-consolidation cluster:

1. **Flagship:** `what-is-diamond-fluorescence` (live from Phase 2.3B)
2. **Buying satellite:** `when-fluorescence-improves-a-diamond`
3. **Origin bridge:** `fluorescence-in-natural-vs-lab-diamonds`

---

## Target articles (this sprint only)

| Slug | Hero path | Alt |
|------|-----------|-----|
| `when-fluorescence-improves-a-diamond` | `/diamond-guide/when-fluorescence-improves-a-diamond-hero.png` | Diamond viewed under soft ultraviolet light on a warm jeweler workspace, suggesting when fluorescence can improve appearance |
| `fluorescence-in-natural-vs-lab-diamonds` | `/diamond-guide/fluorescence-in-natural-vs-lab-diamonds-hero.png` | Two loose diamonds under controlled jeweler lighting, representing fluorescence comparison in natural and lab grown diamonds |

Metadata wired: `visualStatus: "live"`, `visualCategory: "original-photo"`, no `ogImage`.

---

## Assets verified

| File | Status |
|------|--------|
| `public/diamond-guide/when-fluorescence-improves-a-diamond-hero.png` | **Present** |
| `public/diamond-guide/fluorescence-in-natural-vs-lab-diamonds-hero.png` | **Present** |

### Not wired / not repurposed (confirmed)

| File | Status | Notes |
|------|--------|-------|
| `public/diamond-guide/clarity-scale-hero.png` | Present on disk (untracked) | Not referenced; clarity chart sprint deferred |
| `public/diamond-guide/what-is-diamond-fluorescence-scale-chart.png` | Present (committed) | In-article only on flagship via `editorial-image` block |

---

## Heroes wired

| Slug | `heroImage` | `visualStatus` |
|------|-------------|----------------|
| `when-fluorescence-improves-a-diamond` | `/diamond-guide/when-fluorescence-improves-a-diamond-hero.png` | `live` |
| `fluorescence-in-natural-vs-lab-diamonds` | `/diamond-guide/fluorescence-in-natural-vs-lab-diamonds-hero.png` | `live` |

No placeholders, borrowed images, or generated assets.

---

## Articles intentionally not given heroes

Merge/redirect candidates — heroes deferred until Phase 2.6 observation and redirect decisions:

- `is-diamond-fluorescence-good-or-bad`
- `should-you-avoid-diamond-fluorescence`
- `when-fluorescence-is-bad`
- `does-fluorescence-affect-diamond-value`
- `can-you-see-diamond-fluorescence`
- `strong-blue-fluorescence-diamond`
- `diamond-fluorescence-chart-explained`

---

## Live hero article count

| | Count |
|---|------:|
| Before sprint | 21 |
| After sprint | **23** |

Both new slugs added to `lib/seo/schema/validate-schema.test.ts` live hero set. Article JSON-LD `image` emits only for live hero articles.

---

## Confirmations

| Check | Result |
|-------|--------|
| OG stayed default | Yes — no `ogImage` on either support article |
| Fluorescence scale chart in-article only | Yes — remains `editorial-image` on `what-is-diamond-fluorescence` only |
| Clarity chart not touched | Yes — `clarity-scale-hero.png` not wired |
| Redirects implemented | No |
| Article copy rewritten | No — visual metadata only |
| Sitemap / middleware / `next.config.ts` | Not touched |

---

## Production files changed this sprint

| File | Change |
|------|--------|
| `app/diamond-guide/articles.ts` | Hero metadata on 2 support articles |
| `lib/seo/schema/validate-schema.test.ts` | Live hero slug set 21 → 23 |
| `public/diamond-guide/when-fluorescence-improves-a-diamond-hero.png` | New asset |
| `public/diamond-guide/fluorescence-in-natural-vs-lab-diamonds-hero.png` | New asset |
| `docs/seo/phase-3a-fluorescence-visuals.md` | Updated from blocked status to complete |

---

## Fluorescence cluster visual end-state

| Slug | Role | Hero |
|------|------|------|
| `what-is-diamond-fluorescence` | Flagship | Live (Phase 2.3B) + in-article scale chart |
| `when-fluorescence-improves-a-diamond` | Buying satellite | Live (Phase 3A) |
| `fluorescence-in-natural-vs-lab-diamonds` | Origin bridge | Live (Phase 3A) |
| 7 merge/redirect candidates | Deferred | No hero |
