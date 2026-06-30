# Diamond Guide — Article Visual System

**Batch:** AI Search Authority Sprint, Batch 3  
**Status:** Foundation wired; first 3 articles **pending** assets  
**Related:** [`article-image-inventory.md`](./article-image-inventory.md), [`article-visual-opportunity-report.md`](./article-visual-opportunity-report.md)

---

## Overview

Diamond Guide articles optionally declare hero and OG imagery on the `Article` type. Rendering, Open Graph overrides, and Article JSON-LD `image` fields activate only when **both**:

1. `visualStatus: "live"` on the article, and  
2. `ARTICLE_IMAGERY.enableHeroImagery === true` in `lib/diamond-guide/article-imagery.ts`

Articles without images, or with `visualStatus: "pending"`, behave exactly as before.

---

## Optional article fields

| Field | Type | Purpose |
|-------|------|---------|
| `heroImage` | `string` | Public path, e.g. `/diamond-guide/{slug}-hero.jpg` |
| `heroImageAlt` | `string` | Required when hero renders; descriptive alt text |
| `heroImageCaption` | `string` | Optional editorial caption below hero |
| `ogImage` | `string` | Article-specific OG path (1200×630); falls back to `heroImage` when live |
| `visualCategory` | `ArticleVisualCategory` | Creative direction tag for production |
| `visualStatus` | `"pending" \| "live"` | Gates render, OG override, and JSON-LD image |

### Visual categories

- `original-photo` — consultation table, loupe, hands, stones  
- `editorial-graphic` — annotated diagrams, report callouts  
- `comparison-visual` — side-by-side stones or settings  
- `tool-screenshot` — Diamond Studio / Intelligence captures (styled)  
- `video-still` — frame from paired social/video sprint  

---

## Asset specifications

| Asset | Dimensions | Format | Notes |
|-------|------------|--------|-------|
| **Hero** | **1600 × 1000** (16:10) | JPG or WebP | Editorial crop; quiet luxury; warm ivory/gold palette |
| **OG** | **1200 × 630** | JPG or WebP | Social/AI preview; may differ from hero crop |
| **Alt text** | — | — | Specific and factual; avoid generic stock phrasing |

Store files under `public/diamond-guide/`:

```
public/diamond-guide/charlotte-diamond-advisor-guide-hero.jpg
public/diamond-guide/charlotte-diamond-advisor-guide-og.jpg
public/diamond-guide/how-to-read-a-diamond-certificate-hero.jpg
public/diamond-guide/how-to-read-a-diamond-certificate-og.jpg
public/diamond-guide/natural-vs-lab-diamonds-hero.jpg
public/diamond-guide/natural-vs-lab-diamonds-og.jpg
```

---

## Activation checklist (when assets ship)

1. Add hero and OG files to `public/diamond-guide/`
2. Set `visualStatus: "live"` on target articles in `articles.ts`
3. Set `ARTICLE_IMAGERY.enableHeroImagery = true` in `lib/diamond-guide/article-imagery.ts`
4. Verify hero render, OG tags, and JSON-LD `image` in production preview

---

## First 3 candidates (pending)

| Slug | Hero path | OG path | Category |
|------|-----------|---------|----------|
| `charlotte-diamond-advisor-guide` | `/diamond-guide/charlotte-diamond-advisor-guide-hero.jpg` | `/diamond-guide/charlotte-diamond-advisor-guide-og.jpg` | `original-photo` |
| `how-to-read-a-diamond-certificate` | `/diamond-guide/how-to-read-a-diamond-certificate-hero.jpg` | `/diamond-guide/how-to-read-a-diamond-certificate-og.jpg` | `editorial-graphic` |
| `natural-vs-lab-diamonds` | `/diamond-guide/natural-vs-lab-diamonds-hero.jpg` | `/diamond-guide/natural-vs-lab-diamonds-og.jpg` | `comparison-visual` |

---

## Code map

| File | Role |
|------|------|
| `app/diamond-guide/articles.ts` | `Article` type + optional visual fields |
| `lib/diamond-guide/article-imagery.ts` | Gates, resolvers, size constants |
| `app/diamond-guide/components/ArticleHeroImage.tsx` | Editorial hero below byline |
| `app/diamond-guide/[slug]/page.tsx` | Renders hero when live |
| `lib/seo/diamond-guide-metadata.ts` | Per-article OG when live |
| `lib/seo/schema/articles.ts` | Article JSON-LD `image` when live |

---

## Style guidance

See [`article-visual-opportunity-report.md`](./article-visual-opportunity-report.md) — quiet luxury, macro details, consultation context. No generic jewelry-store stock, proposal clichés, or bright sale imagery.
