# Clarity Cluster — Visual Audit and Plan (Phase 3B)

**Sprint date:** June 30, 2026  
**Status:** Planning only — no production changes  
**Prior work:** Certificate (`a29948b`), lab/natural (`528796c`), fluorescence content (`71dd4c4`), internal linking (`cd0e04f`), redirect plan (`03c511b`), fluorescence visuals (`bc9fa7c`)  
**Live hero count:** 23 (unchanged)  
**Local asset:** `public/diamond-guide/clarity-scale-hero.png` — present, untracked, **not wired**

---

## 1. Executive summary

The Diamond Guide clarity cluster contains **nine** articles in category `Diamond Clarity`, plus **one** adjacent tradeoff article (`diamond-color-vs-clarity`) in `Diamond Color`. None have live heroes, custom OG images, or FAQ/schema JSON-LD today.

**Recommended flagship:** `what-is-diamond-clarity` — strongest advisor voice (~880 words), category hub positions it first, highest clarity-specific inbound links (~14 body/related references), and already links to certificate flagship, Diamond Intelligence, and Graduate Gemologist content.

**Recommended long-term structure (5 surviving URLs + 1 color-cluster bridge):**

| Role | Slug |
|------|------|
| **Flagship** | `what-is-diamond-clarity` |
| **Concept satellite** | `eye-clean-diamonds-explained` |
| **Conversion satellite** | `best-diamond-clarity-for-engagement-rings` |
| **Grade comparison** | `vs1-vs-vs2-diamond-clarity` |
| **Color tradeoff (color cluster)** | `diamond-color-vs-clarity` |
| **4 merge/redirect candidates** | `diamond-clarity-chart-explained`, `what-is-si1-clarity`, `can-you-see-diamond-inclusions`, `diamond-blemishes-vs-inclusions` |
| **1 optional demote** | `are-flawless-diamonds-worth-it` — keep short-term, merge value section into flagship later |

**Clarity scale asset:** `clarity-scale-hero.png` should **not** be used as a page hero. Rename to `what-is-diamond-clarity-scale-chart.png` before wiring (mirroring fluorescence scale naming). Wire as an **in-article `editorial-image`** on the flagship under a dedicated GIA scale section — **not** on `diamond-clarity-chart-explained` if that URL is eventually redirected.

**Do not wire visuals until** content consolidation defines the flagship hierarchy (Phase 3C), similar to fluorescence Phase 2.3 before Phase 3A.

**No visuals were wired. No redirects were implemented.**

---

## 2. Full clarity article inventory

### 2.1 Core cluster (category: Diamond Clarity) — 9 articles

| # | Slug | Title | ~Words | Live hero | FAQ/schema |
|---|------|-------|-------:|:---------:|:----------:|
| 1 | `what-is-diamond-clarity` | What is Diamond Clarity | 880 | No | No |
| 2 | `diamond-clarity-chart-explained` | Diamond Clarity Chart Explained | 560 | No | No |
| 3 | `eye-clean-diamonds-explained` | Eye Clean Diamonds Explained | 530 | No | No |
| 4 | `vs1-vs-vs2-diamond-clarity` | VS1 vs VS2 Diamond Clarity | 630 | No | No |
| 5 | `what-is-si1-clarity` | What is SI1 Clarity | 610 | No | No |
| 6 | `best-diamond-clarity-for-engagement-rings` | Best Diamond Clarity for Engagement Rings | 430 | No | No |
| 7 | `can-you-see-diamond-inclusions` | Can You See Diamond Inclusions | 470 | No | No |
| 8 | `diamond-blemishes-vs-inclusions` | Diamond Blemishes vs Inclusions | 490 | No | No |
| 9 | `are-flawless-diamonds-worth-it` | Are Flawless Diamonds Worth It | 400 | No | No |

### 2.2 Adjacent tradeoff article — 1 article

| Slug | Title | Category | ~Words | Live hero | FAQ/schema |
|------|-------|----------|-------:|:---------:|:----------:|
| `diamond-color-vs-clarity` | Diamond Color vs Clarity | Diamond Color | 790 | No | No |

Stays in the **color cluster** for taxonomy but is essential clarity-adjacent buying guidance. Cross-links both clusters.

### 2.3 Category hub (not an article)

`/diamond-guide/diamond-clarity` — lists all nine clarity articles in three groups (Understanding Clarity, What You Can Actually See, Making Practical Decisions). Positions `what-is-diamond-clarity` and `diamond-clarity-chart-explained` as entry points.

### 2.4 Peripheral clarity mentions (out of scope for merge)

Shape guides (Asscher, emerald, etc.), cut articles, and `how-to-read-a-diamond-certificate` discuss clarity requirements or inclusion plots but are not clarity-cluster members. Link **to** the clarity flagship from those pages in a future internal-linking pass; do not absorb them into the clarity cluster.

---

## 3. Per-article assessment

### `what-is-diamond-clarity`

| Field | Assessment |
|-------|------------|
| **Primary intent** | Pillar — clarity fundamentals with advisor framing (eye-clean > paper grade) |
| **Secondary intent** | Inclusion placement, shape/setting context, overpayment avoidance |
| **Current role** | De facto flagship; not yet visually or structurally upgraded |
| **Live hero** | No |
| **FAQ/schema** | No |
| **Body links** | DI ✓ · Concierge ✗ · cert flagship ✓ · lab/natural ✗ · fluorescence ✗ · cut/light ✗ (prose only) · color tradeoff ✓ · GG ✓ |
| **Inbound** | ~14 references across `articles.ts` |
| **Overlap risk** | High with chart, SI1, eye-clean, can-you-see — all restate scale or visibility |
| **Recommended action** | **MAJOR EDIT** — absorb scale chart content, per-grade H2s, blemish/inclusion defs, visibility FAQ; add in-article scale chart; flagship hero in Phase 4A |

### `diamond-clarity-chart-explained`

| Field | Assessment |
|-------|------------|
| **Primary intent** | Reference — FL→I3 GIA scale walkthrough |
| **Secondary intent** | Report literacy |
| **Current role** | Competing glossary with flagship and hub “begin here” slot |
| **Live hero** | No |
| **FAQ/schema** | No |
| **Body links** | cert flagship ✓ only |
| **Inbound** | ~6 |
| **Overlap risk** | **Very high** — duplicate scale prose; exact-match URL for “clarity chart” queries |
| **Recommended action** | **MERGE INTO FLAGSHIP** → **REDIRECT LATER** (deferred GSC) |

### `eye-clean-diamonds-explained`

| Field | Assessment |
|-------|------------|
| **Primary intent** | Concept — eye-clean as practical buying standard |
| **Secondary intent** | SI1/VS context, plot limitations |
| **Current role** | Strong supporting satellite; Hourglass thesis article |
| **Live hero** | No |
| **FAQ/schema** | No |
| **Body links** | DI ✓ · Concierge ✓ · cert flagship ✓ |
| **Inbound** | ~8 |
| **Overlap risk** | Medium with flagship eye-clean sections |
| **Recommended action** | **KEEP** as concept satellite · **LIGHT EDIT** — opening pointer to flagship · hero in Phase 4B |

### `vs1-vs-vs2-diamond-clarity`

| Field | Assessment |
|-------|------------|
| **Primary intent** | Comparison — VS1 vs VS2 value and appearance |
| **Secondary intent** | When VS2 is smarter buy |
| **Current role** | Grade-comparison spoke |
| **Live hero** | No |
| **FAQ/schema** | No |
| **Body links** | DI ✓ · cert flagship ✓ |
| **Inbound** | ~6 |
| **Overlap risk** | Medium — VS grades also on chart article and flagship |
| **Recommended action** | **KEEP** · **LIGHT EDIT** · optional hero Phase 4B (lower priority than eye-clean / best-clarity) |

### `what-is-si1-clarity`

| Field | Assessment |
|-------|------------|
| **Primary intent** | Grade deep-dive — SI1 definition and value |
| **Secondary intent** | Eye-clean potential |
| **Current role** | Thin competing grade URL |
| **Live hero** | No |
| **FAQ/schema** | No |
| **Body links** | DI ✓ · cert flagship ✓ |
| **Inbound** | ~5 |
| **Overlap risk** | **High** with chart SI paragraphs and flagship SI section |
| **Recommended action** | **MERGE INTO FLAGSHIP** (SI1/SI2 H2s) → **REDIRECT LATER** |

### `best-diamond-clarity-for-engagement-rings`

| Field | Assessment |
|-------|------------|
| **Primary intent** | Commercial — practical clarity range for engagement rings |
| **Secondary intent** | Budget, shape, cut interaction |
| **Current role** | Conversion satellite |
| **Live hero** | No |
| **FAQ/schema** | No |
| **Body links** | DI ✓ · Concierge ✓ · cert flagship ✓ · color tradeoff ✓ |
| **Inbound** | ~4 |
| **Overlap risk** | Medium with flagship “common overpayments” section |
| **Recommended action** | **KEEP** · **LIGHT EDIT** · hero in Phase 4B |

### `can-you-see-diamond-inclusions`

| Field | Assessment |
|-------|------------|
| **Primary intent** | Informational — naked-eye visibility of inclusions |
| **Secondary intent** | Cut interaction, eye-clean bridge |
| **Current role** | Thin satellite; encyclopedic tone |
| **Live hero** | No |
| **FAQ/schema** | No |
| **Body links** | DI ✓ |
| **Inbound** | ~5 |
| **Overlap risk** | **High** with flagship visibility + eye-clean |
| **Recommended action** | **MERGE INTO FLAGSHIP** → **REDIRECT LATER** |

### `diamond-blemishes-vs-inclusions`

| Field | Assessment |
|-------|------------|
| **Primary intent** | Educational — internal vs surface features |
| **Secondary intent** | Report literacy |
| **Current role** | Glossary satellite |
| **Live hero** | No |
| **FAQ/schema** | No |
| **Body links** | None to priority destinations |
| **Inbound** | ~3 |
| **Overlap risk** | Medium — chart article opens with same distinction |
| **Recommended action** | **MERGE INTO FLAGSHIP** (definitions H2) → **REDIRECT LATER** |

### `are-flawless-diamonds-worth-it`

| Field | Assessment |
|-------|------------|
| **Primary intent** | Value — FL/IF premium justification |
| **Secondary intent** | Rarity vs visible difference |
| **Current role** | Top-of-scale FAQ-style article |
| **Live hero** | No |
| **FAQ/schema** | No |
| **Body links** | None to priority destinations |
| **Inbound** | ~3 |
| **Overlap risk** | Medium with flagship overpayment section |
| **Recommended action** | **DEMOTE TO SUPPORTING** short-term · **MERGE INTO FLAGSHIP** later (FL/IF worth-it H2) · **REDIRECT LATER** · no hero |

### `diamond-color-vs-clarity` (adjacent)

| Field | Assessment |
|-------|------------|
| **Primary intent** | Budget tradeoff — color vs clarity compromise |
| **Secondary intent** | Cut-first framing |
| **Current role** | Color-cluster supporting article |
| **Live hero** | No |
| **FAQ/schema** | No |
| **Body links** | DI ✓ · GG ✓ |
| **Inbound** | Linked from clarity flagship + best-clarity article |
| **Overlap risk** | Low with clarity cluster (complementary) |
| **Recommended action** | **KEEP** in color cluster · **LIGHT EDIT** — add clarity flagship link if missing · optional hero in color visual batch, not clarity batch |

---

## 4. Overlap / cannibalization analysis

| Query theme | Competing URLs | Risk | Resolution |
|-------------|----------------|------|------------|
| “What is diamond clarity” | `what-is-diamond-clarity` vs fragments in chart, eye-clean | Medium | Strengthen flagship; satellites point up |
| “Diamond clarity chart / scale” | `diamond-clarity-chart-explained` vs flagship (no chart yet) | **High** | Absorb chart on flagship; defer redirect |
| “Eye clean diamond” | `eye-clean-diamonds-explained` vs flagship H2s | Medium | Keep satellite; flagship summarizes, links down |
| “SI1 clarity” | `what-is-si1-clarity` vs chart SI paragraph | **High** | Merge SI1/SI2 into flagship; redirect later |
| “VS1 vs VS2” | `vs1-vs-vs2-diamond-clarity` only | Low | Keep dedicated comparison URL |
| “Can you see inclusions” | `can-you-see-diamond-inclusions` vs eye-clean + flagship | **High** | Merge into flagship visibility section |
| “Blemishes vs inclusions” | `diamond-blemishes-vs-inclusions` vs chart intro | Medium | Merge definitions into flagship |
| “Flawless diamonds worth it” | `are-flawless-diamonds-worth-it` vs flagship overpayment | Medium | Demote then merge |
| “Best clarity engagement ring” | `best-diamond-clarity-for-engagement-rings` vs flagship | Low | Keep conversion satellite |
| “Color vs clarity” | `diamond-color-vs-clarity` | Low | Keep; cross-link both flagships |

**Pattern match:** Mirrors pre-consolidation fluorescence cluster (flagship + chart URL + grade satellites + thin visibility pages). Apply the same sequence: content consolidation → internal linking → redirect observation plan → visuals.

---

## 5. Recommended final hierarchy

```
what-is-diamond-clarity                    [FLAGSHIP — hero + in-article scale chart + FAQ]
├── eye-clean-diamonds-explained           [CONCEPT SATELLITE — hero]
├── best-diamond-clarity-for-engagement-rings [CONVERSION SATELLITE — hero]
├── vs1-vs-vs2-diamond-clarity             [GRADE COMPARISON — optional hero]
└── diamond-color-vs-clarity               [COLOR CLUSTER BRIDGE — cross-link only]

Deferred merge/redirect (7 → 4 active candidates):
  diamond-clarity-chart-explained
  what-is-si1-clarity
  can-you-see-diamond-inclusions
  diamond-blemishes-vs-inclusions
  are-flawless-diamonds-worth-it (later)
```

**Target surviving URL count:** 4 clarity-category articles + 1 color tradeoff (unchanged category) = **5 clarity-relevant URLs** (down from 9), comparable to fluorescence’s 3-URL end-state plus deferred satellites.

---

## 6. Clarity scale chart recommendation

### Asset: `public/diamond-guide/clarity-scale-hero.png`

| Question | Recommendation |
|----------|----------------|
| **Rename before wiring?** | **Yes.** Current filename implies page hero; content is an educational scale graphic. Rename to `what-is-diamond-clarity-scale-chart.png` (committed alongside wiring sprint). Do not rename in Phase 3B. |
| **Which article?** | `what-is-diamond-clarity` (flagship only) |
| **Hero or in-article?** | **In-article `editorial-image` only** — mirror `what-is-diamond-fluorescence-scale-chart.png` on fluorescence flagship |
| **Placement** | After new or expanded H2 **“The GIA Clarity Scale”** (between scale introduction and per-grade practice H2s). Flagship currently lacks a dedicated scale section; **content sprint must add this block before wiring** |
| **Ever use as page hero?** | **No.** Page hero should be original photography (loupe, tweezers, loose diamond, inclusion plot on warm jeweler surface) |
| **Use on chart article?** | **No** — if `diamond-clarity-chart-explained` is redirected, chart lives only on flagship |
| **Wire in Phase 3B?** | **No** |

---

## 7. Merge / redirect decision table

| Source slug | Current title | Recommended target | Action | Content to preserve | Reason | Risk | Redirect timing |
|-------------|---------------|-------------------|--------|---------------------|--------|------|-----------------|
| `what-is-diamond-clarity` | What is Diamond Clarity | — | **KEEP** (flagship) | All advisor framing | Hub + inbound leader | — | — |
| `eye-clean-diamonds-explained` | Eye Clean Diamonds Explained | — | **KEEP** | Eye-clean definition, SI context | Core Hourglass thesis | Low | — |
| `best-diamond-clarity-for-engagement-rings` | Best Diamond Clarity for Engagement Rings | — | **KEEP** | Engagement-specific ranges, mistakes | High conversion intent | Low | — |
| `vs1-vs-vs2-diamond-clarity` | VS1 vs VS2 Diamond Clarity | — | **KEEP** | VS comparison detail | Exact-match comparison query | Low | — |
| `diamond-color-vs-clarity` | Diamond Color vs Clarity | — | **KEEP** (color cluster) | Tradeoff framework | Complementary, not duplicate | Low | — |
| `diamond-clarity-chart-explained` | Diamond Clarity Chart Explained | `what-is-diamond-clarity` | **MERGE → REDIRECT LATER** | FL–I3 grade definitions, “middle of scale” | Chart + scale overlap | **High** | Deferred 60–90d GSC |
| `what-is-si1-clarity` | What is SI1 Clarity | `what-is-diamond-clarity` | **MERGE → REDIRECT LATER** | SI1 eye-clean, value positioning | Grade URL duplicates chart | Medium | Deferred 30–60d GSC |
| `can-you-see-diamond-inclusions` | Can You See Diamond Inclusions | `what-is-diamond-clarity` | **MERGE → REDIRECT LATER** | Visibility, cut masking | Thin; overlaps eye-clean | Medium | Deferred 30d GSC |
| `diamond-blemishes-vs-inclusions` | Diamond Blemishes vs Inclusions | `what-is-diamond-clarity` | **MERGE → REDIRECT LATER** | Inclusion vs blemish defs | Glossary fragment | Low | Deferred 30d GSC |
| `are-flawless-diamonds-worth-it` | Are Flawless Diamonds Worth It | `what-is-diamond-clarity` | **DEMOTE → MERGE LATER → REDIRECT LATER** | FL rarity, worth-it framing | Overlaps overpayment H2 | Medium | Deferred 60–90d GSC |

**No redirects implemented in Phase 3B.**

---

## 8. Visual recommendations

### Surviving articles — hero recommendations

| Slug | Hero needed? | Concept | Recommended filename | Suggested alt | Scale chart here? | FAQ later? | OG |
|------|:------------:|---------|---------------------|---------------|:-----------------:|:----------:|:--:|
| `what-is-diamond-clarity` | **Yes** | Loupe, tweezers, loose round diamond, grading report inclusion plot on warm jeweler desk | `what-is-diamond-clarity-hero.png` | Round diamond beside a grading report inclusion plot with loupe and tweezers on a warm jeweler workspace | **Yes** — in-article only (`what-is-diamond-clarity-scale-chart.png`) | **Yes** — eye-clean, SI1, VS, FL worth it | Default |
| `eye-clean-diamonds-explained` | **Yes** | Diamond held at arm’s length, soft indoor light, no loupe visible | `eye-clean-diamonds-explained-hero.png` | Diamond viewed at normal distance on the hand, illustrating eye-clean appearance without magnification | No | Optional | Default |
| `best-diamond-clarity-for-engagement-rings` | **Yes** | Engagement ring on hand or velvet tray; bright, clean face-up stone | `best-diamond-clarity-for-engagement-rings-hero.png` | Engagement ring with a bright eye-clean center diamond on a warm neutral surface | No | Optional | Default |
| `vs1-vs-vs2-diamond-clarity` | Optional (Phase 4C) | Side-by-side loose diamonds or split comparison under loupe | `vs1-vs-vs2-diamond-clarity-hero.png` | Two loose diamonds compared under jeweler lighting for VS clarity differences | No | No | Default |
| `diamond-color-vs-clarity` | Defer to color visual batch | Two diamonds or D–M strip vs clarity plot — tradeoff visual | `diamond-color-vs-clarity-hero.png` | Diamonds illustrating color and clarity tradeoffs on a jeweler consultation surface | No | Optional | Default |

### Merge/redirect candidates — no heroes

Do **not** create heroes for: `diamond-clarity-chart-explained`, `what-is-si1-clarity`, `can-you-see-diamond-inclusions`, `diamond-blemishes-vs-inclusions`, `are-flawless-diamonds-worth-it`.

### Live hero count impact (future)

| Sprint | Change |
|--------|--------|
| After Phase 4A (flagship + chart) | 23 → 24 |
| After Phase 4B (eye-clean + best-clarity heroes) | 24 → 26 |
| Optional VS1/VS2 hero | 26 → 27 |

Update `lib/seo/schema/validate-schema.test.ts` live slug set only when heroes wire.

---

## 9. Internal linking recommendations

### Incoming links **to** clarity flagship (future pass)

| Source area | Articles to update |
|-------------|-------------------|
| Certificate/report | `how-to-read-a-diamond-certificate`, `what-is-a-diamond-certificate`, lab cert satellites |
| Buying guides | `diamond-buying-tips-from-jewelers`, `natural-vs-lab-diamonds`, `diamond-price-vs-quality` |
| Cut / light | `what-is-diamond-cut`, `how-diamond-cut-affects-light-performance`, `is-diamond-cut-the-most-important-c` |
| Color | `what-is-diamond-color`, `diamond-color-vs-clarity`, `best-diamond-color-for-engagement-rings` |
| Shapes (clarity-sensitive) | Asscher, emerald, cushion guides — step-cut clarity warnings |
| Shape/size | `diamond-carat-vs-size` (larger stones show inclusions) |

### Outgoing links **from** clarity flagship (after major edit)

| Destination | Purpose |
|-------------|---------|
| `how-to-read-a-diamond-certificate` | Inclusion plot literacy |
| `/diamond-intelligence` | Report-specific clarity assessment |
| `/concierge` | Side-by-side viewing |
| `why-work-with-a-graduate-gemologist` | Professional eye-clean verification |
| `eye-clean-diamonds-explained` | Concept deep-dive |
| `best-diamond-clarity-for-engagement-rings` | Engagement-specific guidance |
| `vs1-vs-vs2-diamond-clarity` | VS comparison |
| `diamond-color-vs-clarity` | Budget tradeoff |
| `what-is-diamond-cut` / light performance hub | Cut masks inclusions |
| `natural-vs-lab-diamonds` | Inclusion patterns by origin (light mention) |

### Satellite cross-links

- **Eye-clean** → flagship (opening pointer), cert flagship, DI, Concierge
- **Best clarity for ER** → flagship, eye-clean, VS1/VS2, color tradeoff
- **VS1 vs VS2** → flagship, chart content (pre-redirect), SI context on flagship

### Hub page (`/diamond-guide/diamond-clarity`)

After consolidation, update hub groups to reflect 4-URL hierarchy; demote or remove merge-candidate links when redirects ship.

---

## 10. Suggested execution order

| Phase | Sprint | Scope |
|-------|--------|-------|
| **3B** | **This document** | Audit + visual plan only |
| **3C** | Clarity content consolidation | Major flagship upgrade; absorb scale + SI + visibility + blemish content; opening pointers on merge candidates; optional FAQ schema on flagship |
| **3D** | Clarity internal linking pass | `articles.ts` links only; reinforce cert flagship, DI, Concierge, GG |
| **3E** | Clarity redirect readiness / GSC plan | Decision table + observation windows (mirror `redirect-readiness-observation-plan.md`) |
| **4A** | Clarity flagship visuals | Rename scale asset; wire flagship hero + in-article chart; schema test 23 → 24 |
| **4B** | Clarity support visuals | Heroes for eye-clean + best-clarity-for-ER; schema test 24 → 26 |
| **4C** | Optional VS hero + redirect batch | After GSC observation; 301 merge candidates |

**Prerequisite before any image wiring:** Phase 3C must add the GIA scale section on the flagship (fluorescence blocked until content existed for chart placement).

---

## 11. Risks / items needing human approval

| Item | Risk | Approval needed |
|------|------|-----------------|
| Redirecting `diamond-clarity-chart-explained` | Loses exact-match “clarity chart” URL | Yes — GSC observation first |
| Merging `what-is-si1-clarity` | Loses “SI1” long-tail landing page | Yes — ensure flagship ranks for SI1 queries |
| Using `clarity-scale-hero.png` filename as-is | Mis-wiring as page hero | Rename before commit |
| Flagship major rewrite | Tone shift from encyclopedic satellites | GG review of inclusion/plot claims |
| Live hero count + JSON-LD `image` | Schema test maintenance | Standard sprint checklist |
| Hub page link changes | UX navigation during transition | Update when redirects ship |

---

## 12. Explicit guardrail confirmation

- **No visuals were wired** — `clarity-scale-hero.png` remains untracked and unreferenced
- **No redirects were implemented**
- **No production files modified** — `articles.ts`, `page.tsx`, schema, sitemap, middleware, and image assets untouched
- **Live hero count remains 23**

---

*Companion docs: [`authority-consolidation-report.md`](./authority-consolidation-report.md) · [`internal-linking-authority-pass.md`](./internal-linking-authority-pass.md) · [`phase-3a-fluorescence-visuals.md`](./phase-3a-fluorescence-visuals.md)*
