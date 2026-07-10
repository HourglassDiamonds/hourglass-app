# Final Article Authority Pass — Phases 6A / 6B / 6C

**Date:** July 10, 2026  
**Scope:** Carat/size cluster pass, buying/trust/engagement polish, P1 hero readiness check  
**Source of truth:** `app/diamond-guide/articles.ts`, `public/diamond-guide/`, `docs/seo/diamond-guide-comprehensive-audit.md`  
**Guardrails:** No redirects, no GSC redirect work, no sitemap/middleware/next.config changes, no Shape Studio links, no new articles, no speculative hero wiring, no OG changes, no broad FAQ/schema.

---

## 1. Confirmed carat / size cluster inventory

### Diamond Size category (7)

| Slug | Role | Live hero |
|------|------|-----------|
| `diamond-size-chart` | **Flagship** — mm chart, spread, finger coverage | Yes |
| `diamond-carat-vs-size` | Weight vs face-up size bridge | Yes |
| `diamond-size-on-hand` | Finger coverage / presence | No |
| `do-elongated-diamonds-look-bigger` | Elongated spread | No |
| `how-big-is-a-1-carat-diamond` | 1 ct size intent | No |
| `how-big-is-a-2-carat-diamond` | 2 ct size intent | No |
| `what-is-a-carat` | Definitional primer | No |

### Size-adjacent bridges (other categories)

| Slug | Category | Role |
|------|----------|------|
| `best-carat-size-for-an-engagement-ring` | Buying Guides | Engagement carat decision |
| `how-to-make-a-diamond-look-bigger` | Buying Guides | Design / presence tactics |
| `diamond-size-guide-for-charlotte-engagement-rings` | Charlotte Guides | Local size commercial |
| `does-diamond-cut-affect-size` | Diamond Cut | Cut → spread bridge |
| `what-diamond-shape-looks-the-largest` | Diamond Shapes | Shape → face-up size bridge |

### Not present in repo (requested but absent)

- Dedicated 3-carat or 4-carat articles
- Slug variants such as `what-is-diamond-carat` (actual: `what-is-a-carat`)
- Separate “millimeter measurements” article (chart lives on `diamond-size-chart` editorial image)

**Cluster total for this pass:** 12 articles (7 Size + 5 adjacent bridges).

---

## 2. Carat / size flagship decision

**Flagship:** `diamond-size-chart`

**Why:**

- Audit §9 already names it as the carat/size flagship
- Strongest existing surface: live hero, millimeter editorial chart, CSS shape-spread table, Studio + Concierge pathways
- Direct-answer opening already distinguishes carat weight from face-up millimeters
- Better anchor than `diamond-carat-vs-size` (comparison bridge) or `what-is-a-carat` (definitional primer)

No new article created.

---

## 3. Carat / size edits made

### Flagship strengthened (moderate, not a rewrite)

`diamond-size-chart`

- Shape section → links to `what-diamond-shape-looks-the-largest` and `do-elongated-diamonds-look-bigger`
- Cut section → links to `what-is-diamond-cut` and `does-diamond-cut-affect-size`
- Related array refreshed toward cut + shape-size authority (removed redundant 1-carat-only related)

### Support / bridge articles (light openings + related cleanup)

| Slug | Edit focus |
|------|------------|
| `diamond-carat-vs-size` | Opening pointer to size chart; shape/cut flagship links; Concierge close; related refresh |
| `what-is-a-carat` | Opening pointer to size chart; close pointer to carat-vs-size; related prioritizes size chart |
| `how-big-is-a-1-carat-diamond` | Opening pointer; Concierge close; related prioritizes size chart |
| `how-big-is-a-2-carat-diamond` | Opening pointer; Concierge close; related prioritizes size chart |
| `diamond-size-on-hand` | Opening pointer to size chart |
| `do-elongated-diamonds-look-bigger` | Opening pointer; related adds size chart |
| `best-carat-size-for-an-engagement-ring` | Opening pointer; cut flagship link; fixed duplicate related entry |
| `how-to-make-a-diamond-look-bigger` | Opening pointer; elongated + cut links; Concierge close; related refresh |
| `diamond-size-guide-for-charlotte-engagement-rings` | Opening pointer; Concierge close; related adds carat-vs-size |
| `does-diamond-cut-affect-size` | Size-chart pointer; Studio + Concierge close; related adds size chart / carat-vs-size |
| `what-diamond-shape-looks-the-largest` | Opening pointer to size chart |

All Studio links remain `/diamond-studio`. No `/diamond-shape-studio` links added.

---

## 4. Buying / trust / engagement inventory

### Buying Guides (high leverage)

| Slug | Role |
|------|------|
| `diamond-buying-tips-from-jewelers` | **Buying pillar** |
| `diamond-price-vs-quality` | Budget / tradeoff |
| `why-work-with-a-graduate-gemologist` | Trust / GG |
| `independent-diamond-advisor-vs-jewelry-store` | Trust / model comparison |
| `are-lab-diamonds-a-good-choice` | Origin satellite |
| `natural-vs-lab-diamonds` | Origin flagship (already mature) |
| `when-is-the-best-time-to-buy-a-diamond` | Timing satellite |
| `best-carat-size-for-an-engagement-ring` | Size decision (also in carat cluster) |
| `how-to-make-a-diamond-look-bigger` | Presence tactics (also in carat cluster) |

### Charlotte / local trust

| Slug | Role |
|------|------|
| `charlotte-diamond-advisor-guide` | Local advisor flagship |
| `buy-diamonds-in-charlotte` | Local entry |
| `charlotte-engagement-ring-guide` | Local engagement process |
| `custom-engagement-rings-in-charlotte` | Custom local |
| `diamond-size-guide-for-charlotte-engagement-rings` | Local size |
| `best-diamond-shapes-charlotte` | Local shape preference |

### Proposal Planning (lifestyle; keep warm)

| Slug |
|------|
| `best-places-to-propose-in-charlotte` |
| `how-to-plan-a-proposal-in-charlotte` |
| `best-proposal-photographers-in-charlotte` |
| `most-romantic-restaurants-charlotte-engagement-celebration` |
| `best-charlotte-rooftop-proposal-locations` |
| `how-to-plan-a-proposal-she-will-never-forget` |
| `first-30-days-after-you-get-engaged` |

**Buying pillar:** `diamond-buying-tips-from-jewelers` (audit-aligned; mature ~1.5k-word surface).

---

## 5. Buying / trust edits made

### Pillar strengthened (targeted, not a rewrite)

`diamond-buying-tips-from-jewelers`

- Light Charlotte / South Charlotte / Waxhaw advisor framing in opening
- Link to independent-advisor comparison
- Explicit Four Cs flagship links: cut, clarity, color
- Related array rebuilt toward certificate + Four Cs + Charlotte advisor (removed weaker shape/timing satellites)

### Support / local authority pathways

| Slug | Edit focus |
|------|------------|
| `buy-diamonds-in-charlotte` | Opening pointer to buying pillar; Four Cs + GG links; related refresh |
| `diamond-price-vs-quality` | Related → buying pillar, cut flagship, GG, certificate |
| `why-work-with-a-graduate-gemologist` | Concierge close; related prioritizes buying pillar |
| `charlotte-engagement-ring-guide` | Related adds buying pillar (body already mature) |

### Intentionally left unchanged (mature or lifestyle)

- `independent-diamond-advisor-vs-jewelry-store` — already mature; related already strong
- `charlotte-diamond-advisor-guide` — already mature FAQ flagship
- `custom-engagement-rings-in-charlotte` — already linked; no rewrite needed
- `natural-vs-lab-diamonds` / `are-lab-diamonds-a-good-choice` — origin cluster already complete
- `when-is-the-best-time-to-buy-a-diamond` — already Concierge-linked; light satellite
- All seven Proposal Planning articles — warm/lifestyle; already Concierge/Our Approach where natural; not turned into SEO filler
- `first-30-days-after-you-get-engaged` — mature; not a redirect candidate

No FAQ/schema added in this pass.

---

## 6. P1 hero backlog (Phase 6C)

### Live hero count

| Metric | Count |
|--------|------:|
| Live heroes **before** this pass | **25** |
| Heroes wired in this pass | **0** |
| Live heroes **after** this pass | **25** |

(25 includes prior clarity + cut flagship heroes from earlier sprints; audit’s “23” snapshot is outdated for current repo state.)

### Approved assets checked in `public/diamond-guide/`

**No approved P1 hero assets exist** for:

| Candidate | Suggested filename | Suggested alt text | Why a hero |
|-----------|--------------------|--------------------|------------|
| `what-is-diamond-color` | `what-is-diamond-color-hero.png` | Color-graded diamond row on a warm jeweler surface showing near-colorless to colorless face-up differences | Four Cs flagship still without visual identity |
| `diamond-buying-tips-from-jewelers` | `diamond-buying-tips-from-jewelers-hero.png` | Private diamond consultation table with report, loupe, and engagement ring | Mature buying pillar; shareability + conversion identity |
| `are-all-diamond-certificates-the-same` | `are-all-diamond-certificates-the-same-hero.png` | Side-by-side grading reports from different laboratories with a loose diamond | Second-tier cert comparison flagship |

**Existing hero-named files that are not unused P1 assets:**

- `diamond-clarity-hero.png` / `diamond-cut-hero.png` — already wired (P0 complete)
- `millimeter-measurements-hero.png` — editorial image on size chart, not a missing hero
- `guide-hero-top.png` — hub/shared asset, not article-specific

**Decision:** No heroes wired. Document backlog only.

### Optional P2 backlog (not produced this sprint)

- `charlotte-engagement-ring-guide`
- `buy-diamonds-in-charlotte`
- `diamond-price-vs-quality`
- `diamond-size-on-hand`

---

## 7. Deferred work (explicit)

### GSC redirects — deferred

No redirects added. No GSC redirect evaluation in this sprint. Redirect decisions remain deferred until **after Shape Tool launch**, then GSC review.

### Shape Tool — deferred

No `/diamond-shape-studio` links. Shape Tool launch is the next major product sprint after this article pause. Continue using `/diamond-studio` for size/shape/finger visualization.

---

## 8. Remaining article work (after this pause)

Article-side Diamond Guide SEO can pause after this pass. Remaining items are intentionally deferred or product-gated:

1. **Shape Tool launch** (product) — then selective editorial linking if/when indexable
2. **GSC redirect evaluation** — after Shape Tool; observe merge-watch satellites first
3. **P1 hero production** — color, buying tips, cert-comparison assets (outside Cursor)
4. **Color flagship depth** — if further GEO/FAQ polish is still desired beyond prior color work
5. **Optional P2 heroes** — Charlotte/buying satellites only if commercial share value justifies

---

## 9. Risks and guardrails

- Unrelated dirty/untracked files may exist in the working tree — do not stage or clean them with this sprint
- Do not invent hero assets or wire speculative filenames
- Do not expand merge/redirect-watch satellites into competing flagships
- Do not add FAQPage schema without a visible FAQ intentionally added to one approved pillar
- Do not change OG images, canonicals, sitemap, middleware, or next.config
- Keep proposal lifestyle articles warm; avoid SEO padding
- Preserve unique search intent on 1ct / 2ct / elongated / look-bigger URLs

---

## 10. Files changed

- `app/diamond-guide/articles.ts`
- `docs/seo/final-article-authority-pass-notes.md`

No comprehensive-audit edits. No factual audit correction required beyond noting that live hero count is now 25 (clarity + cut heroes shipped after the July 6 audit’s 23 count).
