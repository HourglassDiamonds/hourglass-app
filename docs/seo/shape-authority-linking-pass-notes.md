# Phase 5D — Shape Authority / Internal-Linking Pass

**Date:** July 10, 2026  
**Scope:** Light authority and internal-linking edits for Diamond Guide shape articles  
**Source of truth:** `app/diamond-guide/articles.ts`  
**Guardrail:** No rewrites, heroes, images, FAQ/schema, OG, redirects, sitemap, routes, or tool implementation changes.

---

## 1. Confirmed shape-related inventory

### Diamond Shapes category (11)

| Slug | Role | Live hero |
|------|------|-----------|
| `round-diamond-guide` | Primary shape guide | Yes |
| `oval-diamond-guide` | Primary shape guide | Yes |
| `emerald-diamond-guide` | Primary shape guide | Yes |
| `cushion-diamond-guide` | Primary shape guide | Yes |
| `pear-diamond-guide` | Primary shape guide | Yes |
| `marquise-diamond-guide` | Primary shape guide | Yes |
| `princess-diamond-guide` | Primary shape guide | Yes |
| `radiant-diamond-guide` | Primary shape guide | Yes |
| `asscher-diamond-guide` | Primary shape guide | Yes |
| `oval-vs-round-diamond` | Comparison | Yes |
| `what-diamond-shape-looks-the-largest` | Size/shape bridge | No |

### Shape-adjacent bridges (other categories)

| Slug | Category | Role |
|------|----------|------|
| `diamond-cut-vs-diamond-shape` | Diamond Cut | Cut vs outline disambiguation |
| `do-fancy-shape-diamonds-have-cut-grades` | Diamond Cut | Fancy-shape grading gap |
| `do-elongated-diamonds-look-bigger` | Diamond Size | Elongated spread |
| `diamond-size-on-hand` | Diamond Size | Finger coverage |
| `best-diamond-shapes-charlotte` | Charlotte Guides | Local shape preference |

### Not present in repo (requested but absent)

- `cushion-vs-radiant-cut-diamonds`
- `emerald-vs-radiant-cut-diamonds`
- `best-diamond-shape-for-finger`
- Slug variants such as `oval-vs-round-diamonds` (actual slug: `oval-vs-round-diamond`)
- Slug variants such as `what-diamond-shape-looks-biggest` (actual: `what-diamond-shape-looks-the-largest`)

### Intentionally left unchanged

| Slug | Reason |
|------|--------|
| `how-to-make-a-diamond-look-bigger` | Buying/size satellite; already Studio-linked; not a shape authority page |
| `does-diamond-cut-affect-size` | Cut cluster bridge; already links cut flagship + Studio |

---

## 2. `/diamond-shape-studio` route verification

**Verified public status: unfinished / not for editorial linking.**

Evidence:

- Route exists at `app/diamond-shape-studio/page.tsx`
- Layout sets `robots: { index: false, follow: false }` with comment: “Unfinished tool — reachable locally; excluded from search until launch.”
- Suite nav marks Shape Comparison as `comingSoon: true`
- Prior PR notes describe a `noindex` guard and exclusion from sitemap

**Decision:** Do **not** add `/diamond-shape-studio` links in this pass. Continue using `/diamond-studio` for on-hand shape/size visualization.

---

## 3. Primary shape guides edited

All nine primary guides received light authority edits (not rewrites):

1. `round-diamond-guide`
2. `oval-diamond-guide`
3. `emerald-diamond-guide`
4. `cushion-diamond-guide`
5. `pear-diamond-guide`
6. `marquise-diamond-guide`
7. `princess-diamond-guide`
8. `radiant-diamond-guide`
9. `asscher-diamond-guide`

Typical additions (varied by article; not forced everywhere):

- Cut flagship (`/diamond-guide/what-is-diamond-cut`) near choosing / cut / bow-tie guidance
- Certificate flagship where proportions/measurements are discussed
- Diamond Intelligence where report + light-performance evaluation fits
- Concierge on closing decision support
- Existing Diamond Studio links preserved

Clarity flagship linked only where open-facet shapes make eye cleanliness especially relevant (`emerald`, `asscher`).

---

## 4. Comparison / bridge articles edited

| Slug | Edit focus |
|------|------------|
| `oval-vs-round-diamond` | Cut flagship in sparkle section; Concierge close; related cleanup |
| `diamond-cut-vs-diamond-shape` | Studio + certificate + Concierge; related toward shape guides |
| `what-diamond-shape-looks-the-largest` | Cut flagship + Concierge in close; related tweak |
| `do-elongated-diamonds-look-bigger` | Cut flagship; link to largest-shape article; Concierge |
| `do-fancy-shape-diamonds-have-cut-grades` | Certificate + DI + Concierge; related toward shape guides |
| `best-diamond-shapes-charlotte` | Cut flagship; Concierge; removed existing em dash in closing sentence |
| `diamond-size-on-hand` | Link to largest-shape article; Concierge; related toward shape/size authority |

---

## 5. Internal authority links added (summary)

| Destination | Where added |
|-------------|-------------|
| `/diamond-guide/what-is-diamond-cut` | All 9 primary guides + most bridges |
| `/diamond-guide/how-to-read-a-diamond-certificate` | Round, oval, emerald, pear, marquise, princess, radiant, asscher; cut-vs-shape; fancy cut grades |
| `/diamond-intelligence` | Round, oval, cushion, marquise, radiant; fancy cut grades |
| `/diamond-studio` | Already present on shape guides; added on cut-vs-shape |
| `/concierge` | All 9 primary guides + edited bridges |
| `/diamond-guide/what-is-diamond-clarity` | Emerald, Asscher only |
| `/diamond-shape-studio` | **Not linked** (unfinished / noindex) |

---

## 6. Related-array changes

Related arrays were lightly refreshed for relevance. Pattern (varied, not identical):

- Prefer cut flagship / cut-vs-shape / fancy cut grades over generic buying tips
- Keep peer shape guides where comparison is natural
- Add size/finger bridges (`what-diamond-shape-looks-the-largest`, `do-elongated-diamonds-look-bigger`, `diamond-size-on-hand`) where spread matters
- Certificate flagship on step-cut and proportion-heavy pages

No identical related set was applied across all shape articles.

---

## 7. Risks and guardrails

- Edits are linking/authority only; article length and structure largely unchanged
- Live hero count remains **25**; no `heroImage` / `visualStatus` changes
- No editorial images, FAQ, schema, OG, redirects, or sitemap changes
- Shape Studio intentionally avoided until public launch
- Unrelated dirty/untracked repo files were not touched

---

## 8. Future shape-cluster recommendations

1. When `/diamond-shape-studio` launches publicly (indexable + nav), add selective links from primary shape guides and size/shape bridges.
2. Consider 1–2 restrained comparison articles if demand appears (e.g. emerald vs radiant, cushion vs radiant); do not invent them for SEO alone.
3. Optional later: short definitional openings on primary shape guides if GSC shows weak snippet quality (not required for this linking pass).
4. Keep `do-fancy-shape-diamonds-have-cut-grades` as the grading-gap spoke; do not merge into shape guides.
