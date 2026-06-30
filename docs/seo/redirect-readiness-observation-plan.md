# Diamond Guide — Redirect Readiness & GSC Observation Plan

**Phase:** 2.5 — Planning only (documentation sprint)  
**Plan date:** June 30, 2026  
**Status:** No redirects implemented. No production code modified.  
**Prior Phase 2 commits on `main`:**

| Phase | Commit | Flagship / outcome |
|-------|--------|-------------------|
| 2.1 Certificate | `a29948b` | `how-to-read-a-diamond-certificate` |
| 2.2 Lab / natural | `528796c` | `natural-vs-lab-diamonds` |
| 2.3 Fluorescence | `71dd4c4` | `what-is-diamond-fluorescence` (+ buying + origin satellites) |
| 2.4 Internal linking | `cd0e04f` | 100 reviewed, 28 edited, 18 related arrays updated |

**Existing site redirects (awareness only):** `next.config.ts` contains one Diamond Guide–adjacent rule: `/diamond-tech-suite` → `/diamond-studio` (301). No Diamond Guide article redirects exist today.

---

## 1. Executive summary

Phase 2 consolidated three topical clusters in **content** without removing URLs. Ten fluorescence articles still compete on overlapping intent. Six certificate/lab URLs are documented as future merge targets. Internal linking (Phase 2.4) strengthened flagship authority, but **301 redirects remain premature** until Google Search Console (GSC) shows the flagships absorbing impressions and clicks for satellite queries.

This plan inventories **14 Phase 2 redirect candidates** (6 certificate/lab + 1 lab-buying + 7 fluorescence), classifies readiness, defines GSC observation criteria, and sets timing windows. A future **Phase 2.6 Redirect Sprint** should implement 301s in batches after observation—not before.

**Default posture:** Watch first. Redirect only when (a) content is absorbed on the target, (b) internal links point to the target, (c) GSC shows the flagship ranking for the source’s primary queries or the source has negligible traffic with no distinct intent.

---

## 2. Completed consolidation context

### What shipped (no URL removals)

| Cluster | Live flagships / satellites | FAQ schema | Live hero on flagship |
|---------|----------------------------|------------|------------------------|
| Certificate | `how-to-read-a-diamond-certificate` + 10 support articles | Certificate flagship only | Yes |
| Lab / natural | `natural-vs-lab-diamonds` + 3 support articles | Lab/natural flagship only | Yes |
| Fluorescence | 3-URL end state designed; **10 URLs still live** | Fluorescence flagship only | Yes (flagship + scale chart editorial) |

### What Phase 2.4 added

- Certificate, lab/natural, and fluorescence flagships reinforced from buying, color, clarity, cut, and Charlotte articles.
- Satellites retain bodies; merge candidates have **opening pointers** to flagships (fluorescence) or flagship-first related arrays (cert/lab).
- **No** `next.config.ts` changes, **no** sitemap edits, **no** article deletions.

### Intended end states (from cleanup notes)

| Cluster | Target URL count | Keep as support (no redirect) |
|---------|------------------|-------------------------------|
| Certificate | 1 flagship + lab appendices + trust primer | `are-all-diamond-certificates-the-same`, `why-diamond-certification-matters`, `igi-diamond-certification-explained`, `gcal-8x-diamond-certification-explained` (defer IGI/GCAL redirects) |
| Lab / natural | 1 flagship + cert bridge + fluorescence bridge | `do-lab-grown-diamonds-have-certificates`, `fluorescence-in-natural-vs-lab-diamonds` (defer) |
| Fluorescence | 3 URLs | `when-fluorescence-improves-a-diamond`, `fluorescence-in-natural-vs-lab-diamonds` |

---

## 3. Redirect candidate inventory

**Total Phase 2 redirect candidates: 14**

| # | Cluster | Source slug | Recommended target |
|---|---------|-------------|------------------|
| 1 | Certificate | `what-is-a-diamond-certificate` | `how-to-read-a-diamond-certificate` |
| 2 | Certificate | `what-is-a-diamond-report-number` | `how-to-read-a-diamond-certificate` |
| 3 | Certificate | `gia-diamond-certification-explained` | `how-to-read-a-diamond-certificate` |
| 4 | Certificate | `ags-diamond-certification-explained` | `are-all-diamond-certificates-the-same` |
| 5 | Certificate | `hrd-diamond-certification-explained` | `are-all-diamond-certificates-the-same` |
| 6 | Certificate / lab | `do-lab-grown-diamonds-have-certificates` | `natural-vs-lab-diamonds` *or* `how-to-read-a-diamond-certificate` (query-dependent) |
| 7 | Lab / natural | `are-lab-diamonds-a-good-choice` | `natural-vs-lab-diamonds` |
| 8 | Fluorescence | `is-diamond-fluorescence-good-or-bad` | `what-is-diamond-fluorescence` |
| 9 | Fluorescence | `should-you-avoid-diamond-fluorescence` | `what-is-diamond-fluorescence` |
| 10 | Fluorescence | `does-fluorescence-affect-diamond-value` | `what-is-diamond-fluorescence` |
| 11 | Fluorescence | `can-you-see-diamond-fluorescence` | `what-is-diamond-fluorescence` |
| 12 | Fluorescence | `strong-blue-fluorescence-diamond` | `what-is-diamond-fluorescence` |
| 13 | Fluorescence | `diamond-fluorescence-chart-explained` | `what-is-diamond-fluorescence` |
| 14 | Fluorescence | `when-fluorescence-is-bad` | `when-fluorescence-improves-a-diamond` |

### Support pages — keep (not redirect candidates in Phase 2)

| Slug | Role | Rationale to keep |
|------|------|-------------------|
| `how-to-read-a-diamond-certificate` | Certificate flagship | Primary authority URL |
| `are-all-diamond-certificates-the-same` | Certificate second-tier flagship | Distinct lab-comparison intent |
| `why-diamond-certification-matters` | Trust primer | Different funnel stage (why vs how) |
| `igi-diamond-certification-explained` | Lab appendix | Common on lab-grown inventory; defer until GSC proves flagship IGI section sufficient |
| `gcal-8x-diamond-certification-explained` | Performance lab appendix | Distinct GCAL 8X / performance intent |
| `natural-vs-lab-diamonds` | Lab flagship | Primary origin authority |
| `what-is-diamond-fluorescence` | Fluorescence flagship | Primary definitional authority |
| `when-fluorescence-improves-a-diamond` | Fluorescence buying satellite | Helps vs hurts; absorbs negative case |
| `fluorescence-in-natural-vs-lab-diamonds` | Origin bridge | Cross-cluster; distinct from definitional flagship |

### Future phases (out of scope for 2.5)

[`authority-consolidation-report.md`](./authority-consolidation-report.md) documents **~28 additional redirects** across cut, size, color, and Charlotte clusters (e.g. `how-big-is-a-1-carat-diamond` → `diamond-size-chart`). Those require separate content merges and are **not** part of this Phase 2 redirect batch.

---

## 4. Cluster-by-cluster recommendations

### A. Certificate / report cluster

**Flagship:** `/diamond-guide/how-to-read-a-diamond-certificate`  
**Second-tier:** `are-all-diamond-certificates-the-same`

| Priority | Action |
|----------|--------|
| Now | Observe GSC for flagship vs glossary (`what-is-a-diamond-certificate`) and GIA appendix |
| 30–60 days | Re-evaluate thin glossary + report-number redirects if flagship gains impressions for “what is a diamond certificate” / “report number” |
| 60+ days | Consider AGS/HRD → `are-all-diamond-certificates-the-same` after lab-comparison flagship stabilizes |
| Defer | GIA redirect while live hero + 14 inbound links remain valuable; consider **canonical** or retain as appendix |
| Defer | IGI / GCAL until flagship lab sections prove sufficient in GSC |

**Risk note:** Redirecting `gia-diamond-certification-explained` removes a URL with **live hero imagery** and strong lab-branded queries. Prefer observation over early redirect.

### B. Lab vs natural cluster

**Flagship:** `/diamond-guide/natural-vs-lab-diamonds`

| Priority | Action |
|----------|--------|
| Now | Observe whether flagship ranks for “are lab diamonds a good choice” |
| 60–90 days | Merge `are-lab-diamonds-a-good-choice` if flagship absorbs clicks; preserve “who is happiest / who may not” H2s on flagship first |
| Indefinite | Keep `do-lab-grown-diamonds-have-certificates` — dual membership in cert + lab clusters; redirect destination depends on dominant query (origin vs paperwork) |
| Indefinite | Keep `fluorescence-in-natural-vs-lab-diamonds` — origin × fluorescence bridge |

### C. Fluorescence cluster

**Flagship:** `/diamond-guide/what-is-diamond-fluorescence`  
**Buying satellite:** `/diamond-guide/when-fluorescence-improves-a-diamond`  
**Origin bridge:** `/diamond-guide/fluorescence-in-natural-vs-lab-diamonds`

| Priority | Action |
|----------|--------|
| Now–90 days | **Observation window** (8–12 weeks from `71dd4c4` + internal linking `cd0e04f`) |
| Batch 1 (earliest) | Thinnest satellites with opening pointers: `can-you-see-diamond-fluorescence`, `should-you-avoid-diamond-fluorescence` |
| Batch 2 | Definitional duplicates: `is-diamond-fluorescence-good-or-bad`, `diamond-fluorescence-chart-explained`, `does-fluorescence-affect-diamond-value`, `strong-blue-fluorescence-diamond` |
| Batch 3 | `when-fluorescence-is-bad` → buying satellite (confirm buying satellite ranks for negative intent first) |
| Before any 301 | Update remaining inbound `related` links and inline refs on fluorescence merge candidates |

---

## 5. Per-candidate classification

Inbound counts = references in `articles.ts` (body + related), including self-references.

### Certificate / lab candidates

| Source slug | Title | Target | Content absorbed? | Inbound links | Live hero | FAQ | Readiness | Risk | Reason |
|-------------|-------|--------|-------------------|---------------|-----------|-----|-----------|------|--------|
| `what-is-a-diamond-certificate` | What Is a Diamond Certificate | `how-to-read-a-diamond-certificate` | Mostly — intro duplicated; cert vs appraisal may need H2 on flagship | ~7 | No | No | Watch first | Medium | Glossary URL; flagship links back to it; monitor “what is a diamond certificate” queries |
| `what-is-a-diamond-report-number` | What Is a Diamond Report Number | `how-to-read-a-diamond-certificate` | Partial — laser inscription / verify steps | ~2 | No | No | Ready soon* | Low | Thin, low inbound; report-number is one flagship section |
| `gia-diamond-certification-explained` | GIA Diamond Certification Explained | `how-to-read-a-diamond-certificate` | Partial — GIA section on flagship; appendix still adds lab-branded depth | ~14 | **Yes** | No | Watch first | **High** | Live hero; strong GIA-branded intent; high inbound |
| `ags-diamond-certification-explained` | AGS Diamond Certification Explained | `are-all-diamond-certificates-the-same` | Partial — AGS history on appendix | ~7 | No | No | Watch first | Medium | Secondary lab; niche but historical queries |
| `hrd-diamond-certification-explained` | HRD Diamond Certification Explained | `are-all-diamond-certificates-the-same` | Partial — European trade context | ~7 | No | No | Watch first | Medium | Same as AGS |
| `do-lab-grown-diamonds-have-certificates` | Do Lab Grown Diamonds Have Certificates | `natural-vs-lab-diamonds` (origin) or `how-to-read-a-diamond-certificate` (paperwork) | Partial — GIA June 2024 note; dual links | ~3 | No | No | Do not redirect yet | Medium | Dual-cluster support page; split intent |
| `are-lab-diamonds-a-good-choice` | Are Lab Diamonds a Good Choice | `natural-vs-lab-diamonds` | Partial — satisfaction framing on flagship; unique H2s remain | ~7 | No | No | Watch first | Medium | Exact-match URL for commercial query; flagship points here |

\*Ready soon = eligible for first redirect batch **only if** GSC shows ≤5 clicks/28d and no distinct query ownership.

### Fluorescence candidates

| Source slug | Title | Target | Content absorbed? | Inbound links | Live hero | FAQ | Readiness | Risk | Reason |
|-------------|-------|--------|-------------------|---------------|-----------|-----|-----------|------|--------|
| `is-diamond-fluorescence-good-or-bad` | Is Diamond Fluorescence Good or Bad | `what-is-diamond-fluorescence` | Yes — FAQ + good/bad H2s on flagship | ~6 | No | No | Watch first | Medium | High-intent query; flagship FAQ targets it |
| `should-you-avoid-diamond-fluorescence` | Should You Avoid Diamond Fluorescence | `what-is-diamond-fluorescence` | Yes — avoidance + opportunity on flagship | ~1 | No | No | Ready soon* | Low | Thin; minimal inbound; opening pointer live |
| `does-fluorescence-affect-diamond-value` | Does Fluorescence Affect Diamond Value | `what-is-diamond-fluorescence` | Yes — value section on flagship | ~6 | No | No | Watch first | Medium | Commercial pricing intent |
| `can-you-see-diamond-fluorescence` | Can You See Diamond Fluorescence | `what-is-diamond-fluorescence` | Yes — visibility on flagship | ~1 | No | No | Ready soon* | Low | Thinnest satellite; opening pointer live |
| `strong-blue-fluorescence-diamond` | Strong Blue Fluorescence Diamond | `what-is-diamond-fluorescence` | Yes — Strong/Very Strong on flagship + buying notes | ~6 | No | No | Watch first | Medium | Edge-case queries may prefer dedicated URL |
| `diamond-fluorescence-chart-explained` | Diamond Fluorescence Chart Explained | `what-is-diamond-fluorescence` | Yes — scale chart editorial on flagship | ~6 | No | No | Watch first | Medium | Chart now lives on flagship; chart URL may still rank |
| `when-fluorescence-is-bad` | When Fluorescence Is Bad | `when-fluorescence-improves-a-diamond` | Yes — negative case on buying satellite | ~5 | No | No | Watch first | Medium | Target is satellite, not flagship; confirm satellite ranks first |

---

## 6. GSC observation framework

Use **Google Search Console → Performance → Pages** and **Search results** filtered by page URL. Baseline pull date: **first week after `cd0e04f` deploy** (internal linking live), then compare at 28 / 60 / 90 days.

### Metrics to pull per candidate (last 28 days)

| Metric | Decision use |
|--------|----------------|
| Clicks | Redirect only if low **or** clicks migrating to target |
| Impressions | High impressions + low clicks = snippet/title opportunity before redirect |
| Average position | Source ranking top 10 for queries target should own → delay redirect |
| Top queries (page filter) | Distinct intent test (see below) |
| CTR | Sudden CTR drop after internal linking may signal cannibalization resolving |

### Per-candidate qualitative checks

| Signal | Redirect-friendly | Keep URL / delay redirect |
|--------|-------------------|---------------------------|
| Source clicks | 0–5 / 28d | >10 / 28d with stable trend |
| Source vs target queries | Overlap ≥70% on top 5 queries | Source owns unique query (e.g. “GIA certification explained”) |
| Target flagship impressions | Rising for source’s head terms | Flat while source still grows |
| Internal links | Phase 2.4 links live; crawl shows target as primary | Many external/backlink refs to source (if known) |
| AI / snippet behavior | Featured snippets favor flagship | Source still wins PAA / AI overview for cluster |
| Cannibalization | Source + target both rank positions 4–15 for same query | Source ranks top 3 alone |
| Index status | Indexed, thin, duplicate | Indexed with unique SERP feature (hero image, brand query) |

### Cluster-specific GSC questions

**Certificate**

- Is `how-to-read-a-diamond-certificate` gaining impressions for “how to read a diamond certificate”, “diamond certificate”, “GIA report”?
- Does `what-is-a-diamond-certificate` still outrank the flagship for definitional queries?
- Does `gia-diamond-certification-explained` own “GIA diamond certification” separately from the reader guide?

**Lab / natural**

- Does `natural-vs-lab-diamonds` absorb “lab vs natural”, “lab grown vs natural”?
- Does `are-lab-diamonds-a-good-choice` still win “are lab diamonds good” alone?

**Fluorescence**

- Does `what-is-diamond-fluorescence` rank for “is fluorescence bad”, “diamond fluorescence chart”, “strong blue fluorescence”?
- Does `when-fluorescence-improves-a-diamond` rank for “when is fluorescence bad”?
- After internal linking, are color articles passing equity to the flagship (referring page report in GSC)?

### Practical decision rule (not perfection)

**Redirect when all are true:**

1. Target page contains the absorbed content (H2/FAQ/visual).  
2. Internal links to target are in place (Phase 2.4 done for cross-cluster; update intra-cluster before 301).  
3. Source has **no unique top-3 query** OR source clicks ≤5/28d for 2 consecutive periods.  
4. Target shows **impression growth** on source’s primary query (or source impressions declining).  
5. Human review approves for high-risk rows (GIA appendix, `are-lab-diamonds-a-good-choice`).

---

## 7. Redirect timing guidance

| Window | When to use | Phase 2 examples |
|--------|-------------|------------------|
| **Immediate** (only after GSC pull) | Thin, no distinct intent, no meaningful traffic, content fully absorbed, low inbound | Possibly `can-you-see-diamond-fluorescence`, `should-you-avoid-diamond-fluorescence`, `what-is-a-diamond-report-number` — **only if** GSC confirms ≤5 clicks/28d |
| **30-day observation** | Medium-thin pages; glossary overlap; post–internal-linking crawl | `what-is-a-diamond-certificate`; first fluorescence batch review |
| **60-day observation** | Commercial exact-match URLs; dual-intent pages | `are-lab-diamonds-a-good-choice`, `does-fluorescence-affect-diamond-value`, `is-diamond-fluorescence-good-or-bad` |
| **60–90 day observation** | Live hero, high inbound, or lab-branded URLs | `gia-diamond-certification-explained`, `diamond-fluorescence-chart-explained`, `strong-blue-fluorescence-diamond` |
| **Keep indefinitely** | Unique intent or cross-cluster bridge | `are-all-diamond-certificates-the-same`, `why-diamond-certification-matters`, `do-lab-grown-diamonds-have-certificates`, `fluorescence-in-natural-vs-lab-diamonds`, `igi-*`, `gcal-*` (until GSC proves otherwise) |

**Suggested calendar (from June 30, 2026):**

| Milestone | Date | Activity |
|-----------|------|----------|
| Baseline GSC export | July 7, 2026 | Pull all 14 candidates + 3 flagships |
| 28-day review | July 28, 2026 | Fluorescence batch 1 eligibility |
| 60-day review | Aug 29, 2026 | Certificate glossary + lab satisfaction satellite |
| 90-day review | Sep 28, 2026 | Full Phase 2 redirect batch decision |
| Earliest implementation | Oct 2026 | Phase 2.6 Redirect Sprint (if criteria met) |

---

## 8. Redirect implementation rules (future sprint — do not implement yet)

1. **Use 301** permanent redirects in `next.config.ts` `redirects()` array (match existing `/diamond-tech-suite` pattern).  
2. **Redirect to the most relevant target**, not always the cluster flagship:
   - Negative fluorescence case → `when-fluorescence-improves-a-diamond`
   - Lab paperwork with origin intent → `natural-vs-lab-diamonds`
   - Lab paperwork with field-reading intent → `how-to-read-a-diamond-certificate`
   - Secondary labs → `are-all-diamond-certificates-the-same`
3. **No redirect chains** — source → final target only; never source → intermediate → target.  
4. **Update internal links first** — replace body + `related` refs to source URLs before deploying 301s.  
5. **Preserve content on target** before redirect — no 301 until target H2/FAQ/visual covers absorbed material.  
6. **Sitemap** — remove redirected slugs from sitemap generation after deploy (future sprint only).  
7. **GSC monitoring** — watch Coverage / Page indexing for “Page with redirect” and soft 404s for 7 / 14 / 28 days.  
8. **Do not redirect** pages with meaningful unique intent unless intentionally consolidated and GSC supports the merge.  
9. **Batch deploy** — certificate batch separate from fluorescence batch to isolate impact.  
10. **Smoke test** every source URL returns 301 to correct destination with no loop.

---

## 9. Decision table

| Cluster | Source slug | Source title | Recommended target | Proposed action | Readiness | Observation window | Risk | Notes |
|---------|-------------|--------------|-------------------|-----------------|-------------|-------------------|------|-------|
| Certificate | `what-is-a-diamond-certificate` | What Is a Diamond Certificate | `how-to-read-a-diamond-certificate` | 301 after observation | Watch first | 30–60 days | Medium | Flagship still links here; cert vs appraisal H2 |
| Certificate | `what-is-a-diamond-report-number` | What Is a Diamond Report Number | `how-to-read-a-diamond-certificate` | 301 after observation | Ready soon* | 30 days | Low | Thin; ~2 inbound |
| Certificate | `gia-diamond-certification-explained` | GIA Diamond Certification Explained | `how-to-read-a-diamond-certificate` | Defer; consider canonical | Watch first | 60–90 days | High | Live hero; ~14 inbound |
| Certificate | `ags-diamond-certification-explained` | AGS Diamond Certification Explained | `are-all-diamond-certificates-the-same` | 301 after observation | Watch first | 60 days | Medium | Historical AGS queries |
| Certificate | `hrd-diamond-certification-explained` | HRD Diamond Certification Explained | `are-all-diamond-certificates-the-same` | 301 after observation | Watch first | 60 days | Medium | European trade context |
| Cert / lab | `do-lab-grown-diamonds-have-certificates` | Do Lab Grown Diamonds Have Certificates | Split by query | Keep as support | Do not redirect yet | 90+ days | Medium | Dual cluster |
| Lab / natural | `are-lab-diamonds-a-good-choice` | Are Lab Diamonds a Good Choice | `natural-vs-lab-diamonds` | 301 after observation | Watch first | 60–90 days | Medium | Exact-match commercial URL |
| Fluorescence | `is-diamond-fluorescence-good-or-bad` | Is Diamond Fluorescence Good or Bad | `what-is-diamond-fluorescence` | 301 after observation | Watch first | 60 days | Medium | Flagship FAQ targets query |
| Fluorescence | `should-you-avoid-diamond-fluorescence` | Should You Avoid Diamond Fluorescence | `what-is-diamond-fluorescence` | 301 after observation | Ready soon* | 30 days | Low | ~1 inbound; thin |
| Fluorescence | `does-fluorescence-affect-diamond-value` | Does Fluorescence Affect Diamond Value | `what-is-diamond-fluorescence` | 301 after observation | Watch first | 60 days | Medium | Value intent |
| Fluorescence | `can-you-see-diamond-fluorescence` | Can You See Diamond Fluorescence | `what-is-diamond-fluorescence` | 301 after observation | Ready soon* | 30 days | Low | Opening pointer; thinnest |
| Fluorescence | `strong-blue-fluorescence-diamond` | Strong Blue Fluorescence Diamond | `what-is-diamond-fluorescence` | 301 after observation | Watch first | 60–90 days | Medium | Strong blue edge queries |
| Fluorescence | `diamond-fluorescence-chart-explained` | Diamond Fluorescence Chart Explained | `what-is-diamond-fluorescence` | 301 after observation | Watch first | 60 days | Medium | Chart on flagship |
| Fluorescence | `when-fluorescence-is-bad` | When Fluorescence Is Bad | `when-fluorescence-improves-a-diamond` | 301 after observation | Watch first | 60 days | Medium | Satellite target, not flagship |

---

## 10. Future Phase 2.6 — Redirect sprint checklist

### Pre-implementation

- [ ] Export GSC Performance for all 14 source URLs + 4 targets (28d, 60d, 90d comparisons)
- [ ] Compare top 10 queries per source vs recommended target
- [ ] Confirm content absorption on target (manual read + cleanup notes)
- [ ] Audit inbound internal links; update any remaining refs to source URLs
- [ ] Check Ahrefs / GSC Links (if available) for external backlinks to source URLs
- [ ] Human approval on **High** risk rows (minimum: `gia-diamond-certification-explained`)
- [ ] Choose redirect batch order (fluorescence first recommended — highest cannibalization)

### Implementation

- [ ] Add 301 entries to `next.config.ts` `redirects()` only (no chains)
- [ ] Update sitemap source if redirected slugs are enumerated explicitly
- [ ] Do **not** remove article objects from `articles.ts` until redirect verified (optional later cleanup)
- [ ] `npm run build`
- [ ] Smoke test: each source URL → 301 → correct target (desktop + mobile)
- [ ] Verify target pages return 200

### Post-deploy monitoring

| Day | Action |
|-----|--------|
| 0 | Deploy; submit sitemap in GSC if changed |
| 7 | GSC Coverage — redirect validation; crawl errors |
| 14 | Performance — clicks/impressions on source vs target |
| 28 | Full cluster review; note query migration |
| 60 | Decide second batch or rollback if target lost visibility |

### Rollback criteria

- Target flagship loses >25% impressions for core cluster query vs pre-redirect baseline  
- Soft 404 or redirect errors in GSC  
- Material drop in cluster total clicks (source + target) vs baseline  

---

## 11. Risks / human approval needed

| Risk | Mitigation |
|------|------------|
| Premature fluorescence redirects before flagship ranks | Enforce 60–90 day window; batch thinnest URLs first |
| GIA URL redirect loses image-rich SERP asset | Defer `gia-diamond-certification-explained`; consider keeping as appendix with canonical to flagship |
| `are-lab-diamonds-a-good-choice` exact-match loss | Wait for flagship to rank; merge content H2s before 301 |
| Dual-cluster `do-lab-grown-diamonds-have-certificates` | Do not redirect until query analysis picks primary target |
| Redirect without updating internal links | Phase 2.6 must grep `articles.ts` for each source slug before deploy |
| Authority report’s 28 other merges | Out of scope; do not combine with Phase 2 batch without separate plan |
| AI search / PAA shifts | Re-check snippet winners at 60 days; not a blocker alone |

**Human approval required before Phase 2.6:**

- Any redirect of a URL with **live hero** (`gia-diamond-certification-explained`)
- Any redirect with **>10 clicks / 28d** in GSC
- Any redirect where source top query does not appear on target’s query set

---

## 12. Explicit status

**No redirects have been implemented.**  
**No production code, articles, schema, sitemap, middleware, or `next.config.ts` changes were made in Phase 2.5.**  
This document is planning only. Redirect execution belongs to a future **Phase 2.6 Redirect Sprint** after GSC observation.

---

*Companions: [`certificate-cluster-cleanup-notes.md`](./certificate-cluster-cleanup-notes.md), [`lab-natural-cluster-cleanup-notes.md`](./lab-natural-cluster-cleanup-notes.md), [`fluorescence-cluster-cleanup-notes.md`](./fluorescence-cluster-cleanup-notes.md), [`internal-linking-authority-pass.md`](./internal-linking-authority-pass.md), [`authority-consolidation-report.md`](./authority-consolidation-report.md)*
