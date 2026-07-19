# Hourglass Diamonds — Cohesion & Polish Audit

**Date:** July 18, 2026
**Type:** Audit only — no code was modified.
**Goal:** Identify the final 5–10% of inconsistency preventing the site from feeling completely resolved. Preserve the brand direction (quiet luxury, cinematic dark + warm ivory, restrained, Apple/Cartier/Aston Martin influence). No redesign, no copy rewrites, no new conversion tactics.

---

## Executive summary

The site is structurally coherent: nearly every marketing page shares the `max-w-[1200px] px-6 md:px-10` shell, the shared `Header`/`Footer`, the same parchment palette family, and a recognizable editorial voice. The Diamond Studio suite already shares a real shell (`DiamondStudioSuiteShell` + suite nav). What prevents the "one team, one sitting" feeling is drift at the token and primitive level:

1. **The design tokens exist but are not used.** `globals.css` defines a full `--hg-*` brand system; only ~7 files reference it. Marketing surfaces carry **~1,509 hard-coded hex utilities across 185 unique hex values**, including three near-identical inks (`#1f1d1a` ×141, `#1d1b18` ×108, `#1c1b1a` ×34) and three charcoal CTA fills. Every other visual inconsistency in this report traces back to this.
2. **There are no shared primitives.** No Button component, `SectionHeading` has zero imports, 14+ eyebrow variants, 12+ CTA pill variants, per-page heading stacks. Similar components have visibly drifted apart.
3. **Accessibility has four true WCAG failures** worth treating as critical: pointer-only Size Studio sliders, a ~1.5:1 focus ring, nested `<main>` landmarks with the Header inside `<main>`, and no skip link. Everything else is polish.
4. **The studio suite is one product with three names per tool.** Nav says "See It On a Finger" while SEO/FAQ say "Diamond Size Studio"; chrome says "Analyze Sparkle" while results and errors say "Diamond Intelligence."
5. **Motion has one good system and three dialects.** The 820ms luxury-reveal + `cubic-bezier(0.28, 0.11, 0.22, 1)` easing is well established, but page-entry coverage is uneven, Whispered Praise runs its own 1.8–2.1s system without reduced-motion support, and DI result states swap abruptly.
6. **Journeys mostly resolve to Concierge**, with three real gaps: Shape Studio has no Concierge exit at all, Engagement Rings never links to Our Approach, and two guide category hubs are soft dead ends.
7. **Repo hygiene:** ~30 confirmed-dead components (mostly pre-V3 Diamond Intelligence UI), a 6.4 GB untracked `marketing-sprint/` directory, ~20 empty screenshot-review directories, and stale local branches.

---

## How to read this report

Each Critical/High finding carries: **(1)** file/component, **(2)** issue, **(3)** why it matters, **(4)** user-facing impact, **(5)** recommended change, **(6)** risk, **(7)** scope, **(8)** global vs local, **(9)** dependencies/regression risks. Medium/Low findings are compressed but keep the same information. Domain deep-dives (Studio, mobile, accessibility, motion, journeys) follow the master list.

---

# Master findings

## Critical

### C1. Brand tokens defined but unused; 185-hex color drift

1. **Where:** `app/globals.css` (lines 3–24) defines `--hg-*`; `app/layout.tsx:72` hard-codes `bg-[#f7f3ee] text-[#1f1d1a]`; ~1,509 `bg-[#…]`/`text-[#…]`/`border-[#…]` utilities across `app/`.
2. **Issue:** Tokens are referenced by only ~7 files (studio shells, `di-v3-styles.ts`). Ink appears as `#1f1d1a` (141×), `#1d1b18` (108×), `#1c1b1a` (34×), `#1e1a16` (32×). Muted body text spans `#6f675f` (88×), `#6a635c` (30×), `#615a53`, `#5f5851`… while the actual token `--hg-muted: #756b61` is used **2×**. Eyebrows: `#8a8177` (70×), `#9a9084` (69×), `#948a80` (52×), `#8a8176` (18×). Charcoal CTA fill: `#2b2723` vs `#2b2621` vs `#2f2b27`. Lines: `#e4dbcf` (157×) plus 6 near-duplicates. `--hg-body`, `--hg-surface-soft`, `--hg-charcoal` are defined and never consumed. `globals.css` also still carries Create-Next-App defaults (`--background:#ffffff`, `--foreground:#171717`, `body { font-family: Arial… }`, and a `prefers-color-scheme: dark` block) that fight the parchment brand.
3. **Why it matters:** Every future edit picks a hex by eye; drift compounds. This is the single root cause behind most findings in this report.
4. **User-facing impact:** Subtle temperature shifts between pages (guide ink vs marketing ink, footer lines vs header lines) that read as "almost, not quite" — precisely the unresolved feeling the brand wants to eliminate.
5. **Recommended change:** Expose `--hg-*` through Tailwind v4 `@theme` (e.g. `text-hg-ink`, `border-hg-line`, `bg-hg-ivory`), decide the canonical value for each cluster (ink, muted, eyebrow, charcoal, line), and migrate by frequency — `#e4dbcf`, the ink cluster, and `#8a8177`/`#9a9084` first. Fix `layout.tsx` and the `globals.css` defaults to use tokens. Do not chase all 185 hexes; collapse the ~10 high-frequency families and leave intentional one-offs.
6. **Risk:** Low–medium. Force-unifying near-matches shifts colors by 1–3% luminance; needs visual spot-checks per page.
7. **Scope:** Large but mechanical; can be split by color family.
8. **Global or local:** Global (this *is* the design system).
9. **Dependencies/regression:** None functional. Screenshot-diff key pages per family migration. Downstream findings (H1, M1, M2) depend on this landing first.

### C2. Diamond Size Studio sliders are pointer-only (WCAG 2.1.1 A)

1. **Where:** `app/diamond-studio/page.tsx` ~1961–1969 (mousedown/touchstart handlers), ~2422–2437 (band width), ~2476–2491 (carat).
2. **Issue:** Tracks are plain `<div className="dts-track">` — no `role="slider"`, no `tabIndex`, no `aria-value*`, no key handling. Shape Studio's equivalent (`app/diamond-shape-studio/components/calibration-controls.tsx:159–184`) implements the full keyboard slider pattern, so the suite is internally inconsistent too.
3. **Why it matters:** Keyboard and switch users cannot operate the core controls of the flagship tool. It is also a WCAG Level A failure (2.1.1, 4.1.2).
4. **User-facing impact:** Keyboard users hit a wall; screen-reader users hear nothing meaningful for the primary interaction.
5. **Recommended change:** Mirror the Shape Studio pattern: `role="slider"`, `aria-valuemin/max/now/text`, Arrow/Home/End keys, with the existing steppers kept as secondary affordances. Presentation-only; no sizing math changes.
6. **Risk:** Low. Additive event handlers.
7. **Scope:** Small (one file, two controls).
8. **Global or local:** Local, but should reuse the Shape Studio approach for consistency.
9. **Dependencies/regression:** Must not alter drag behavior or size calculations; verify with the existing `verify:diamond-studio` script.

### C3. Focus indicator fails contrast wherever custom rings replace the outline

1. **Where:** `--hg-focus-ring: #cbbda9` (`app/globals.css:20`); used after `focus-visible:outline-none` in `Header.tsx` (90, 108, 153), `concierge-page-client.tsx` (136–138, 404–411, 754), and ~16 other call sites.
2. **Issue:** `#cbbda9` on `#efe8de` ≈ **1.52:1** (and `/70`–`/80` tints are worse). WCAG 1.4.11 requires ≥3:1 for the focus indicator.
3. **Why it matters:** These are exactly the places that did the right thing (custom focus styling) — but the ring is nearly invisible.
4. **User-facing impact:** Keyboard users lose track of where they are on the highest-traffic chrome (header nav, concierge form, CTAs).
5. **Recommended change:** Darken the token (e.g. `--hg-gold-deep: #987648` or ink `#2b2723`) at full opacity, keep the 2px + offset treatment, and stop using opacity tints as the only indicator. One token change fixes most call sites at once.
6. **Risk:** Low. Pure visual.
7. **Scope:** Tiny (one token + removing `/70`-style tints).
8. **Global or local:** Global token fix.
9. **Dependencies/regression:** None. Also feeds H3 (shared focus utility).

### C4. Landmark structure: Header rendered inside `<main>`, nested `<main>` on pages, no skip link

1. **Where:** `app/layout.tsx:76–78` wraps *all* page content (including each page's `<Header/>`) in `<main>`; second `<main>` elements in `home-page-client.tsx:394`, `concierge/page.tsx:27`, `custom-design/page.tsx:27`, `engagement-rings/page.tsx:26`, `privacy/page.tsx:5`, `terms/page.tsx:5`. No skip-to-content link exists.
2. **Issue:** Multiple `<main>` landmarks; banner/nav nested inside main; no bypass mechanism (WCAG 2.4.1 A, 1.3.1 A).
3. **Why it matters:** Landmark navigation is a primary screen-reader strategy; the current tree makes "jump to main content" meaningless.
4. **User-facing impact:** Screen-reader and keyboard users must wade through chrome on every page.
5. **Recommended change:** Restructure `layout.tsx`: skip link → header slot → `<main id="main-content">{children}</main>` → `<Footer/>`. Remove nested `<main>` from pages (plain `div`/fragment). Since Header is currently mounted per-page (see M3), this pairs naturally with moving Header into the layout.
6. **Risk:** Low–medium — touching the root layout affects everything; behavior is unchanged but verify sticky-header stacking and studio shell measurement (`DiamondStudioBrandChrome` measures header height).
7. **Scope:** Small edit, wide blast radius; do it as its own reviewable pass.
8. **Global or local:** Global.
9. **Dependencies/regression:** Studio `--dts-header-h` measurement; `currentPage` prop wiring (see M3).

### C5. Studio suite tool naming drift

1. **Where:** `app/diamond-studio/diamond-studio-suite-nav-config.ts:15–34` (nav: "See It On a Finger", "See It On Your Hand", "Analyze Sparkle") vs `app/diamond-studio/layout.tsx:21` + `lib/seo/schema/constants.ts:27` ("Diamond Size Studio") vs `app/diamond-intelligence/layout.tsx:17`, `DiV3Hero.tsx:29`, `DiV3UnableToVerify.tsx:45` ("Diamond Intelligence") vs `hand-photo-panel.tsx:59` ("Scaled Preview"). Editorial cross-links use "Diamond Intelligence" where chrome says "Analyze Sparkle" (`DiamondStudioEditorial.tsx:98–100`).
2. **Issue:** A user sees one name in the nav, another in the browser tab and FAQ, and a third in result/error headers — mid-flow.
3. **Why it matters:** Naming is the cheapest, most visible signal of whether three tools were designed together.
4. **User-facing impact:** "Is Diamond Intelligence a different product than Analyze Sparkle?" confusion, especially in error states where the product name suddenly changes.
5. **Recommended change:** Publish a one-page name map and apply it to customer-facing surfaces only: umbrella "Diamond Studio"; tools "See It On a Finger" / "See It On Your Hand" / "Analyze Sparkle"; "Diamond Intelligence" retained only as a quiet product line where already deliberate (landing sub-brand). SEO titles may keep descriptive subtitles ("diamond size on your finger") without renaming pages or URLs.
6. **Risk:** Low for chrome/copy; **medium for metadata** — do not change URLs; be deliberate about `<title>`/schema edits since SEO structure is preserved-scope.
7. **Scope:** Small–medium, string-level.
8. **Global or local:** Global decision, local edits.
9. **Dependencies/regression:** SEO metadata review before touching titles/schema; internal code identifiers can keep old names (no refactor needed).

---

## High impact

### H1. No shared Button/CTA primitive; 12+ hand-rolled pill variants

1. **Where:** No `Button` component exists. Variants include `home-page-client.tsx:355` (dark pill, 11px/0.28em), `engagement-rings-hero-actions.tsx:33` (dark pill, text-sm/0.08em + shadow), `diamond-guide-page-client.tsx:345` (`#2b2621`, 0.32em), `our-approach-page-client.tsx:31` (ivory outline), `whispered-praise/page.tsx:553` (softer pill, 10.5px/0.3em), `ledger/page.tsx:62` (squared, `#2f2b27`), `the-house-page-client.tsx:263` (non-rounded block CTA), plus ghost→fill and underline-link variants.
2. **Issue:** Same-purpose buttons differ in fill color, type size, tracking, padding, hover (opacity vs lift vs bg-swap), and focus (ring vs none).
3. **Why it matters:** Buttons are the most-repeated element on the site; their drift is the most legible "different teams" tell.
4. **User-facing impact:** CTAs feel slightly different on every page; hover/focus feedback is unpredictable.
5. **Recommended change:** One `Button` (or shared class recipe) with `primary` (charcoal pill), `secondary` (ivory outline), `ghost`, and `text` variants — unified padding, tracking, focus ring, and a single 300ms hover recipe. Compose with `ConsultationCtaLink` so tracking and styling stay coupled. Ledger's squared button may remain a documented editorial exception.
6. **Risk:** Low–medium; visual diffs on every page.
7. **Scope:** Medium — one new primitive, ~30 call-site migrations.
8. **Global or local:** Global.
9. **Dependencies/regression:** Depends on C1 tokens; must preserve `trackConsultationCtaClicked` locations exactly (analytics is preserve-scope).

### H2. Eyebrow/heading primitives: `SectionHeading` dead, 14+ eyebrow variants, hero scale drift

1. **Where:** `app/shared-components/SectionHeading.tsx` — **zero imports**. Eyebrow variants across `home-page-client.tsx:81/167/421`, `concierge-intro.tsx:68`, `diamond-guide-page-client.tsx:155`, `Footer.tsx:12/36`, `whispered-praise/page.tsx:214/355/456`, etc. (sizes 9–11px, tracking 0.26–0.36em, seven grays + gold). H1 scale: Home `2.25rem→3.15rem` vs Engagement/Custom/Concierge `2rem→2.45rem` vs Our Approach `1.65rem` vs The House `1.6rem`; weight flips between `font-light`/`font-normal`, serif appears only on Whispered Praise/Ledger; tracking swings from `+0.015em` to `-0.048em`.
2. **Issue:** Every page hand-rolls its own heading stack; the shared component encoding the intended pattern is abandoned.
3. **Why it matters:** Typography rhythm is the backbone of editorial cohesion. House/Approach — the brand-trust pages — currently read *smaller* and quieter than utility pages.
4. **User-facing impact:** Pages feel like siblings from different years; mobile hero sizes visibly jump between adjacent pages.
5. **Recommended change:** Define one `Eyebrow` (`text-[10px] or [11px] uppercase tracking-[0.34em] text-hg-eyebrow` — pick one) and one heading scale (marketing hero band ~2–2.25rem base; a documented quieter band for Ledger/legal). Rebuild or replace `SectionHeading` and adopt it progressively; delete it if not adopted.
6. **Risk:** Low.
7. **Scope:** Medium (many call sites, trivial each).
8. **Global or local:** Global.
9. **Dependencies/regression:** Eyebrow color choice must also satisfy contrast (A2 below) — resolve together.

### H3. Focus styles missing or inconsistent across marketing chrome

1. **Where:** Present and good: Header, Concierge, Conversations. Missing: home CTAs (`home-page-client.tsx:353–355, 441–443`), all Footer links (`Footer.tsx:17–78`), Our Approach CTAs (`our-approach-page-client.tsx:31/68/76`), guide hub CTAs (`diamond-guide-page-client.tsx:337–345`), `DiAccordion.tsx:21–26`, `ApproachQuestion.tsx` summary, The House video controls (`the-house-page-client.tsx:202–216`).
2. **Issue:** Roughly half of interactive elements rely on UA defaults, half on a custom (currently failing, see C3) ring.
3. **Why it matters:** WCAG 2.4.7; also a visible polish inconsistency for keyboard users.
4. **User-facing impact:** Focus visibly "changes personality" between sections of the same page.
5. **Recommended change:** One shared focus-visible utility (post-C3 token) applied to all links, buttons, and summaries — cheapest via the Button/Eyebrow primitives plus a small utility class for bare links.
6. **Risk:** Low.
7. **Scope:** Medium, mechanical.
8. **Global or local:** Global.
9. **Dependencies/regression:** C3 first.

### H4. Tap targets below standard on shared chrome

1. **Where:** Footer nav links `text-[12px]`, no min-height (`Footer.tsx:16–28`); footer module links `text-[11px]` (`:43–62`); desktop header links from `md` are text-only 12–13px with no padding (`Header.tsx:105–112`); disclosure +/- icons 30–34px (`ApproachQuestion.tsx:26–37`, `DiV3Chapter.tsx:79–81`, `ShapeComparisonEditorial.tsx:61–67`); ledger subnav `text-[10px]` no padding (`ledger-subnav.tsx:18–36`); The House video controls `px-4 py-2 text-[10px]`.
2. **Issue:** Interactive elements below the 44px comfortable target (24px AA floor is mostly met; 44px best practice is not).
3. **Why it matters:** Mobile users interact with the footer and disclosures constantly; small targets are felt as "cheap" even when technically passable.
4. **User-facing impact:** Missed taps on phones, particularly footer nav and accordion toggles.
5. **Recommended change:** `min-h-11` + padding on footer/nav links; keep full-row `<summary>` as the hit area and enlarge the icon's invisible padding; pad ledger subnav chips.
6. **Risk:** Low; minor layout reflow in footer.
7. **Scope:** Small.
8. **Global or local:** Global (Footer/Header) + three local disclosure components.
9. **Dependencies/regression:** None.

### H5. Header mobile menu is not a proper disclosure/dialog

1. **Where:** `app/shared-components/Header.tsx:61–71` (Escape only), `:125–165` (`role="menu"`/`menuitem` on a plain dropdown).
2. **Issue:** No focus management, no outside-click dismiss, no scroll lock; `role="menu"` claims a keyboard pattern (arrow keys) that isn't implemented.
3. **Why it matters:** This is the primary mobile navigation for the whole site; ARIA misuse is worse than no ARIA.
4. **User-facing impact:** Keyboard/SR users can tab "behind" the open menu; menu semantics announce behavior that doesn't exist.
5. **Recommended change:** Drop `role="menu"`/`menuitem` (keep `aria-expanded` + `aria-controls` disclosure pattern), add outside-click close and focus return; optional scroll lock. Do not redesign the visual.
6. **Risk:** Low.
7. **Scope:** Small (one component).
8. **Global or local:** Global.
9. **Dependencies/regression:** None.

### H6. Homepage designs gallery: 6-column grid from `md` cramps tablets

1. **Where:** `app/home-page-client.tsx:208–209` — mobile horizontal snap carousel → `md:grid md:grid-cols-6` at 768px.
2. **Issue:** At 768–1023px, six columns yield ~100px cards; meta rows rely on `min-h-[4.35rem]` and crush.
3. **Why it matters:** Homepage is the first impression; tablet is the classic "stretched mobile or compressed desktop" failure the audit targets.
4. **User-facing impact:** iPad users see a cramped, un-luxurious grid on the flagship page.
5. **Recommended change:** Stage it — keep the carousel through `md` or use `md:grid-cols-3 lg:grid-cols-6`.
6. **Risk:** Low.
7. **Scope:** Tiny.
8. **Global or local:** Local.
9. **Dependencies/regression:** None.

### H7. Journey gap: Shape Studio has no Concierge path

1. **Where:** Zero `/concierge` links anywhere under `app/diamond-shape-studio/**`; exits are suite nav and global chrome only.
2. **Issue:** The longest, most personal flow on the site (photograph your own hand, calibrate, preview) ends with no human next step — while Size Studio and Analyze Sparkle both offer one.
3. **Why it matters:** A user who just previewed a diamond on their hand is the single warmest visitor on the site.
4. **User-facing impact:** Soft dead end at peak engagement.
5. **Recommended change:** One quiet post-calibration link — "Begin the Conversation" → `/concierge` — placed where Size Studio's editorial equivalent sits. Not a sticky bar, not a button cluster. Zero changes to upload/session logic.
6. **Risk:** Low.
7. **Scope:** Tiny.
8. **Global or local:** Local.
9. **Dependencies/regression:** Add a `trackConsultationCtaClicked` location for parity with existing CTAs.

### H8. Journey gaps in the guide/marketing graph

1. **Where:** (a) No `/our-approach` link anywhere under `app/engagement-rings/` — the specified Home → ER → Our Approach journey breaks at step 2. (b) `diamond-guide/light-performance/page.tsx:164–169` links to `/our-approach` but never to `/diamond-intelligence`, the tool built for exactly this topic (sibling hubs do link their tools). (c) `diamond-guide/certification/page.tsx` ends at article groups (~line 255) with no closing CTA, unlike every sibling category hub. (d) No link to `/diamond-shape-studio` exists anywhere under `diamond-guide/`.
2. **Issue:** The education → tool → conversation ladder has missing rungs in exactly the places it was designed to work.
3. **Why it matters:** These are one-link fixes with real journey value — the opposite of adding CTAs.
4. **User-facing impact:** SEO-landing visitors on certification/light-performance hubs stall; ER visitors never encounter the trust-building Approach page in flow.
5. **Recommended change:** (a) one editorial text link in ER's authority section → `/our-approach`; (b) mirror sibling hubs with one intro link → `/diamond-intelligence`; (c) reuse the existing closing-CTA block sibling hubs use; (d) one Shape Studio link from the shapes hub or a hand-relevant article.
6. **Risk:** Low.
7. **Scope:** Tiny per item.
8. **Global or local:** Local ×4.
9. **Dependencies/regression:** None. Content hierarchy unchanged; these are documented usability gaps.

### H9. CTA labels drift for the same destination

1. **Where:** Site standard is **"Begin the Conversation"** (home, ER, custom design, our approach, guides, whispered praise, episodes, concierge submit). Outliers: The House "Start a Private Consultation" (`the-house-page-client.tsx:317`); DI's "Have Justin Review This Diamond" vs lowercase "Have Justin review this diamond" (`DiamondHeroNarrative.tsx:59` — a dead component, but the casing split also exists in live DI CTAs) and "Learn more about this diamond"; ~10 inline phrasings in `lib`-side guide copy (`articles.ts`): "Speak with Concierge", "begin a private conversation", "submit your project through Concierge"…
2. **Issue:** Same destination, many promises. `ConsultationCtaLink` standardizes destination + analytics but not label.
3. **Why it matters:** One consistent verbal signature is a quiet-luxury hallmark; the current dominant pattern is already right and just needs protecting.
4. **User-facing impact:** Slight mental re-parse at each CTA; The House feels like a different brand voice at its most important moment.
5. **Recommended change:** Align The House to "Begin the Conversation" (or document it as the sole intentional exception). Keep DI's contextual "Have Justin Review This Diamond" in result states only, with unified casing. Converge guide inline anchors toward 2 approved phrasings over time — an editorial pass, not a rewrite.
6. **Risk:** Low. (Guide copy edits touch `articles.ts` — keep the pass surgical to respect the no-broad-rewrites rule.)
7. **Scope:** Small.
8. **Global or local:** Global convention, local edits.
9. **Dependencies/regression:** Preserve analytics `location` strings.

### H10. Page-entry motion dialect is inconsistent; Whispered Praise runs an ungated parallel system

1. **Where:** RevealOnScroll used on `/`, `/the-house`, `/our-approach`, guide hubs, episodes — but **not** `/engagement-rings`, `/custom-design`, `/concierge`. Facet rail allowlist (`public-motion-routes.ts`) includes `/engagement-rings` but omits `/our-approach`, `/conversations`, `/whispered-praise`. `whispered-praise/page.tsx:383–446` defines its own `whispered-enter` keyframes (1.8s/2.1s, `ease-out`, no blur) with **no `prefers-reduced-motion` guard**.
2. **Issue:** Peer pages get different first impressions; one page uses a different (longer, ungated) motion system entirely.
3. **Why it matters:** Motion is the "same team" signature; the reduced-motion gap is also an accessibility issue.
4. **User-facing impact:** ER/Custom Design feel static next to Home/guides; Whispered Praise forces a 2-second entrance on users who asked for reduced motion.
5. **Recommended change:** Pick one dialect: either add restrained RevealOnScroll to ER/Custom Design/Concierge mid-page sections, or thin reveals from guides — then align the rail allowlist to the same list (document the decision in `public-motion-routes.ts`). Convert Whispered Praise to `luxury-reveal` (or at minimum add the reduced-motion guard and cap at 820ms).
6. **Risk:** Low.
7. **Scope:** Small–medium.
8. **Global or local:** Global policy, local edits.
9. **Dependencies/regression:** None functional.

### H11. Dead pre-V3 Diamond Intelligence UI layer (~30 components) risks a design-system fork

1. **Where:** 27 never-imported modules in `app/diamond-intelligence/components/` (`DiamondIntelligenceHero`, `OpticalHeroStage`, `AtAGlancePerformanceSection`, `PerformanceReadSidebar`, `ReportDossier`, `DiTechnicalAccordions`…), plus transitively dead `DiAccordion.tsx`, `DiEditorialImage.tsx`; `LightPerformanceStudioNav.tsx` (self-labeled "Legacy"); deprecated `RoundCadScintillation.tsx` + `round-cad-*.ts` in diamond-studio; dead dark-theme CSS in `diamond-studio/page.tsx:424–445`; dormant compare-mode residue in `shape-studio-view.tsx:99–102`. Note: `DashboardCard.tsx` is partially live (`dashValue` still imported by `DiV3ResultSections.tsx`).
2. **Issue:** A parallel, older design language sits alongside the live V3 surface, indistinguishable to future editors.
3. **Why it matters:** The most likely way cohesion regresses is someone "fixing" or reviving a dead component.
4. **User-facing impact:** None today; high risk of future inconsistency and wasted effort.
5. **Recommended change:** Delete the confirmed-dead set in one reviewable PR (keep `dashValue` by extracting it). Audit-verified list is in the consolidation section below.
6. **Risk:** Medium — confirm no dynamic imports; run the DI test suites (`test:diamond-intelligence`) after removal.
7. **Scope:** Medium (file deletions only).
8. **Global or local:** Local to studio/DI directories.
9. **Dependencies/regression:** Tests must pass; no live import may break. This is cleanup — schedule as the final pass.

### H12. DI upload/validation errors lack live regions and invalid wiring

1. **Where:** `ReportUploadDock.tsx:231–252` (error text without `role="alert"`/`aria-live`); `GuidedReportCompletion.tsx:223–227` (field errors not linked via `aria-describedby`/`aria-invalid`).
2. **Issue:** State changes the user must know about are silent to assistive tech (WCAG 4.1.3 AA, 3.3.1 A). The Concierge form already does this correctly — the pattern exists in-house.
3. **Why it matters:** Upload failure is the single most frustrating moment in the DI flow.
4. **User-facing impact:** SR users don't learn the upload failed or which field is wrong.
5. **Recommended change:** Copy the Concierge form's wiring (status region, `aria-invalid` + `aria-describedby`). No upload logic changes.
6. **Risk:** Low.
7. **Scope:** Small.
8. **Global or local:** Local.
9. **Dependencies/regression:** None; purely additive attributes.

---

## Medium impact

Format: **Where → Issue → Recommendation** (risk/scope noted inline; all are low-risk unless flagged).

- **M1. Container drift.** `Footer.tsx:7` uses `max-w-[1180px] px-6 md:px-8` vs pages' `1200px / md:px-10`; `Header.tsx:75` uses `px-0` (padding delegated to context); guide `/all` indexes use `max-w-[1100px]`; guide hub nests `max-w-[1380px]` inside `1200px` (`diamond-guide-page-client.tsx:149/174`); legacy `LightPerformanceStudioNav` at `1560px` (dead). → One `Container` recipe (`max-w-[1200px] px-6 md:px-10`); align Footer/Header. Global, small.
- **M2. Dark-surface and line-color drift.** Primary CTA fill is `#2b2723` vs `#2b2621` (guides, 25×) vs `#2f2b27` (ledger); footer lines `#e8e2d9`/`#ebe5dc` vs site `#e4dbcf`. → Resolve inside C1's token migration. Global.
- **M3. Header mounted per-page; `currentPage` missing on several routes.** No active-nav state on `/our-approach`, `/whispered-praise`, `/conversations`, `/ledger`, `/privacy`, `/terms` (e.g. `our-approach-page-client.tsx:95`, `ledger-shell.tsx:21`). → Mount Header in `layout.tsx` (pairs with C4) and derive active state from `usePathname()`, deleting the prop. Global, medium blast radius (test studio shell header measurement).
- **M4. Studio ↔ homepage ordering and cross-link naming.** `home-studio-portal.tsx:46–61` orders tools Finger → Sparkle → Hand; suite nav orders Finger → Hand → Sparkle. Editorial cross-links use "Diamond Intelligence" where chrome says "Analyze Sparkle". → Align order + labels (part of C5's name map). Local, tiny.
- **M5. Size Studio bypasses the shared tool header.** Finger hand-rolls `h1.dts-page-title` (`page.tsx:1162–1166, 2576`) while Hand and Sparkle use `DiamondStudioToolHeader`. → Route Finger through the shared component. Local, small (verify `--dts-header-h` measurement).
- **M6. Disclosure model split.** Native `<details>` (`DiV3Chapter`, `ApproachQuestion`, `ShapeComparisonEditorial` — a deliberate clone of DiV3Chapter, see comment at `ShapeComparisonEditorial.tsx:23–25`) vs button accordion (`DiAccordion` — dead) vs instant-toggle panels; hover timings 200 vs 300ms; open/close is unanimated everywhere. → Standardize on the `<details>` pattern, extract one `StudioDisclosure`, single hover timing. Optional: subtle open transition. Global-ish, medium.
- **M7. Motion duration/easing drift + ambient competition.** Same interaction types span `duration-200/300/500/700`, `ease`/`ease-out`/luxury bezier; homepage stacks three ambient systems (facet rail + CTA glimmer + portal sparkles); conversations cards use e-comm-ish `duration-700` + scale; guide pages wrap 4–5 sections in blur reveals; two guide hubs import CTAGlimmer without using it. → Adopt the minimal token set (300ms UI / 820ms reveal / luxury bezier), cap one ambient effect per viewport, remove dead imports. Global, small–medium.
- **M8. Reduced-motion gaps beyond H10.** DI `AnalysisProgressNarrative` opacity-cycles every 4s ungated (also has a 400ms JS vs 500ms CSS mismatch); home portal sparkles leave static artifacts under reduced motion (`home-studio-portal.tsx:292–301`); `useReducedMotion` initializes `false` (flash risk); ledger PMI bars (0.9s, different bezier) ungated; The House autoplay video ignores reduced motion. → Gate each; snap text swaps under reduce. Local ×5, small.
- **M9. DI result-state transitions are abrupt.** `LightPerformanceDashboard.tsx:547–598` hard-mounts PROCESSING/SUCCESS/ERROR with no shared enter/exit. → One functional ~300ms opacity fade around the result region. Local, small. (No logic changes.)
- **M10. Mobile vertical rhythm outliers.** Whispered Praise hero `pb-28 pt-24` + sections `pb-28`; The House hero `pb-[104px] pt-[72px]`; Our Approach `py-[80px]`; vs dominant `py-[96px] md:py-[110px]` desktop rhythm with tighter mobile. Cramped spots: ER authority `gap-1.5`; DI trust band `text-[9px]` with tight gaps (`DiLandingMarketing.tsx:34–38`). → Cap mobile section padding (~py-16/20), loosen the two cramped grids, raise 9px microcopy to ≥10–11px. Local ×6, small.
- **M11. Studio padding/width micro-drift.** DI surfaces use `px-5` base vs suite `px-6` (`di-v3-styles.ts:6`); home studio portal CTA *shrinks* at `md` (`home-studio-portal.tsx:451`); capture page uses its own oklch parchment instead of `--hg-*` (`capture-page-styles.tsx:6–12`). → Align to `px-6`; keep mobile CTA padding through `md`; bind capture colors to tokens. Local ×3, tiny.
- **M12. ARIA gaps on studio controls (beyond C2).** Size Studio shape strip: `role="tablist"` with children missing `role="tab"`/`aria-selected` (`page.tsx:2629–2649` — Shape Studio does it correctly); orientation toggles missing `aria-pressed` (`:2513–2526`); "i" info buttons expose content only via `title` and do nothing on activate (`:2331–2335, 2445–2451, 2532–2538`); skin-tone radiogroup lacks arrow keys (`:2385–2406`). → Complete each pattern or downgrade the role. Local, small.
- **M13. Heading order and video policy.** Guide index skips h1→h3 (`diamond-guide-page-client.tsx:159–211`); The House hero video autoplays muted with no captions/transcript policy and unlabeled `<video>` (`the-house-page-client.tsx:186–216`); episode captions depend on data (`HourglassVideoPlayer.tsx:282–291`) — verify every published episode ships tracks. → h2 for category cards; declare the hero video decorative (label it) or provide transcript; caption QA. Local, small.
- **M14. Repo hygiene.** Untracked but not ignored: `marketing-sprint/` (**~6.4 GB**), `tmp/` (~169 MB), ~20 empty `*-review`/`*-verify` dirs, `.worktrees/`; tracked junk: `gcal-pdf-text.txt`, root `eng.traineddata` (runtime uses `lib/calibration-library/tessdata/eng.traineddata.gz`); Create-Next-App leftovers `public/file.svg`, `globe.svg`, `next.svg`, `window.svg`; stale local branches (`backup-before-video-cleanup`, `backup/*`, `feature/diamond-studio-v2-diamonds-only`, …) and one prunable worktree. → Gitignore + purge; untrack junk; delete orphan SVGs; prune branches after confirming backups. **Risk: destructive if `marketing-sprint` isn't backed up elsewhere — confirm first.** Repo-level, small effort.
- **M15. Conversations hub and premature studio CTA.** Hub ends at the episode list with no next step (footer only); Size Studio shows a Concierge CTA in the first mobile viewport before the user has touched the tool (`diamond-studio/page.tsx:2584–2595`). → Optional quiet closing line on the hub; demote the studio stage CTA to the editorial chapter where desktop already has it. Local ×2, tiny.

---

## Low impact

- **L1. Radius/shadow scale.** Radii span `rounded-sm/14/18/20/22/24/28/30/32px`; shadows are bespoke per component. → Document a 3-step radius scale (e.g. 18/22/28) + one soft shadow; migrate opportunistically. Global convention, no sweep needed.
- **L2. File-naming conventions.** `ledger/components` all kebab-case; studio dirs mix Pascal + kebab; root `components/diamond-guide/GuideCategoryIcons.tsx` is the only file outside `app/` conventions. → Adopt "PascalCase components, kebab modules"; move GuideCategoryIcons under `app/`. Rename-only churn.
- **L3. `@vercel/blob` has zero imports.** Candidate removal after confirming no planned use (shape-studio session uploads?). Low–medium risk if planned.
- **L4. `RevealOnScroll` `delay` prop is never used.** Wire a deliberate stagger on 1–2 hero sections or delete the prop.
- **L5. `DiamondCadScintillation` re-implements reduced-motion detection** (`useSyncExternalStore` variant) instead of the shared hook. → Point at `useReducedMotion`.
- **L6. Whispered Praise tiles:** `tabIndex={0}` on non-interactive articles + `sr-only` duplicate of visible quotes (`whispered-praise/page.tsx:278–325`). → Remove both.
- **L7. Gold as small text** (`text-[#ad9164]`, e.g. `episode-page-client.tsx:159`) fails contrast; prefer ink + gold rule/underline for the accent.
- **L8. "Coming soon" markers** use `aria-disabled` on non-focusable div/span (`home-studio-portal.tsx:160`, `DiamondStudioSuiteNav.tsx:58–65`). → Plain visible text; don't imply interactivity.
- **L9. Concierge form polish:** Name/Email lack a visible "(required)" (Phone has one). → Add for symmetry.
- **L10. Footer `<nav>` lacks an `aria-label`** while Header's has "Primary". → Add `aria-label="Footer"`.
- **L11. Duplicate JsonLd wrapper:** `EngagementRingsJsonLd.tsx` re-implements `MarketingPageJsonLd`. → Use the shared one.
- **L12. `TextureOverlay.tsx`** — zero imports. Delete with H11's pass.
- **L13. `globals.css` comment drift:** `--hg-studio-header-h` claims to be "set by DiamondStudioBrandChrome" but that component sets `--dts-*` vars. → Fix the comment (or the var) so the contract is honest.

---

## No action recommended

Reviewed and deliberately left alone:

- **`overflow-x: clip` on html/body** (`globals.css:40–45`). It can mask overflow bugs, but removing it without a device QA pass risks visible regressions. Revisit only alongside a dedicated overflow QA session.
- **Engagement Rings (4-step) vs Custom Design (6-step) process sections.** Overlapping framing but intentional product variants, not accidental duplication.
- **No sticky mobile CTA bar.** On-brand restraint; the fix for long flows is the Shape Studio exit link (H7), not persistent chrome.
- **Capture page (`/diamond-shape-studio/capture/[sessionId]`) excluding suite nav and footer.** Correct for a camera-focused phone flow. Only its color tokens need aligning (M11).
- **DI's contextual result CTAs ("Have Justin Review This Diamond").** Right instinct post-report; just unify casing and keep the wording out of marketing chrome (H9).
- **Ledger's squared dark button and serif voice.** A defensible editorial sub-brand — document it as an intentional exception rather than flattening it.
- **Studio tool mobile hit areas and Shape Studio's slider/keyboard implementation.** Already mature; use them as the reference implementations.
- **Concierge form accessibility baseline.** Labels, `aria-invalid`, status live region, focus-on-success are all correct — this is the in-house pattern to copy (H12).
- **Conversations player autoplay.** Activates only after user gesture; compliant.
- **Alt-text patterns.** Decorative `alt=""` usage is broadly correct; only spot-check content photos that convey unique information.

---

# Domain deep-dives

## Diamond Studio ecosystem

The suite's bones are right: all three tools share `DiamondStudioSuiteShell` (site Header + suite nav + ivory surface + `DiamondStudioBrandChrome` measurement), and Finger/Hand feel like twin instruments (`dts-*` / `dss-*` are deliberate mirrors). The gaps:

1. **Naming** (C5, M4) — the single highest-impact fix for "designed together."
2. **Tool header parity** (M5) — Finger is the odd one out.
3. **Analyze Sparkle is a different visual species**: `rounded-[28px]` gold-bordered dossier cards, underline text-CTAs (`DI_V3_TEXT_CTA`), hero-scale error articles branded "Diamond Intelligence" — vs the instrument-panel language of Finger/Hand with quiet inline alerts. Recommendation: keep the "document tool" identity but align the intro block, eyebrow token, error-state hierarchy (eyebrow → title → body in the same scale family), and one shared recovery label ("Start over" / "Try another report").
4. **Onboarding structure differs per tool**: Finger drops you into the instrument; Hand has an entry card with kicker/steps/privacy; Sparkle has trust chips + educational accordions. A shared minimal "tool intro block" (title + one subhead + optional trust chips) would unify without flattening.
5. **State/recovery inventory**: Hand has the richest recovery vocabulary (Start over / Retake / Cancel phone capture / session-expiry copy); Sparkle recovers only via re-upload with no labeled restart; Finger is stateless. Align labels and placement.
6. **Dead layer** (H11): the pre-V3 DI component pile, legacy nav, dead dark theme, dormant compare mode — remove so the live system is the only system.
7. **Preserved:** all calculations, calibration behavior, upload/session logic, QR handoff flow, and grading logic. Nothing above touches them.

## Mobile & tablet

- Per-page shell is consistent (`px-6 md:px-10`, `max-w-[1200px]`); outliers are Footer (`1180/px-8`), guide `/all` (`1100`), DI (`px-5`).
- **Tablet is the weak breakpoint**: home gallery jumps to 6 columns at `md` (H6); Conversations featured and DI two-column layouts skip `md` entirely (single column until `lg` — acceptable but worth a pass); `2xl:` is used nowhere (wide desktop just gets margin, which is fine given capped prose measures).
- Tap targets: shared chrome is the problem area (H4); the studio tools are the best-in-repo examples (44–48px sliders, 48px subnav hits, safe-area padding).
- Vertical rhythm outliers and cramped grids: M10.
- Header at `md` (768–900px) risks crowding: 6 nowrap links + logo in a nowrap flex row — consider keeping the hamburger until `lg` (fold into H5's pass).
- Hero type at mobile spans 1.6rem → 2.25rem across sibling pages (H2).

## Accessibility

True WCAG failures, in priority order: C2 (keyboard sliders — also Shape Studio's calibration handles and overlay placement are pointer-only: `calibration-markers.tsx:265–285`, `overlay-stage.tsx:1040–1087`; keyboard nudges recommended), C3 (focus ring contrast), C4 (landmarks + skip link), A-contrast on text (eyebrows `#8a8177` ≈ 3.2–3.5:1, `#9a9084` ≈ 2.6–2.8:1, gold ≈ 2.3–2.7:1 at 10–11px sizes — fails 1.4.3; resolve jointly with H2's eyebrow token), H5 (menu ARIA), H12 (live regions), M12 (studio ARIA), M13 (heading order, captions).

Subjective/preference items kept separate: disabled-state opacity styling (native `disabled` is used — fine), sr-only duplication (L6), `aria-disabled` on coming-soon chips (L8), footer nav label (L10).

Strengths to preserve as reference implementations: Concierge form wiring, Shape Studio carat slider, Header Escape handling + 44px menu button, motion primitives' reduced-motion behavior.

## Motion

- **Canonical system:** `luxury-reveal` (820ms, `cubic-bezier(0.28,0.11,0.22,1)`, translateY+blur), CTAGlimmer (1.35s sweep, 20–30s cadence), FacetScintillationRail (route-gated) — all reduced-motion aware.
- **Parallel dialects:** Whispered Praise 1.8–2.1s enter (ungated, H10); Diamond Studio `--dt-*` tokens (260/300/340ms — good) with outliers (600ms skin swap, 160ms Shape Studio chips); ledger bars (0.9s, different bezier); DI progress cycling (M8).
- **Proposed token set** (already dominant in code): `--motion-duration-ui: 300ms`, `--motion-duration-enter: 820ms`, `--motion-ease: cubic-bezier(0.28, 0.11, 0.22, 1)`; glimmer 1.35s as the only ambient. Deprecate free mixing of `duration-200/500/700` and `ease/ease-out` for brand UI; reserve translate/scale hovers for media cards only.
- **Restraint flags:** homepage stacks three ambient systems in one viewport (M7); blur reveals on 4–5 sections per guide page dilute the effect; studio chip `scale(1.01)` is imperceptible noise.
- **Missing functional motion** (recommend adding, nothing else): a single fade around DI result-state swaps (M9), and optionally a subtle disclosure open transition (M6).

## User journeys

- **Journey 1 (Home → ER → Approach → Concierge):** breaks at ER (H8a); otherwise sound.
- **Journey 2 (Home → Studio → Concierge):** works for Finger and Sparkle; Shape Studio is the dead end (H7). Homepage tool order mismatch (M4).
- **Journey 3 (Guide → tool → Concierge):** article chrome (related links + "Begin the Conversation" footer) is consistent and good. Hub-level tool handoffs are uneven: size/shapes/certification hubs link their tools; light-performance doesn't (H8b); certification hub lacks the closing CTA (H8c); Shape Studio is invisible from the guide entirely (H8d). The `studio-callout` article block exists but is used once — a ready-made, on-brand mechanism to reuse.
- **Journey 4 (Custom Design):** complete; no changes.
- **Journey 5 (trust landings):** The House label outlier (H9); Conversations hub soft dead end (M15); Whispered Praise resolves well.
- **Navigation coverage:** `/our-approach` is footer-only (not in header nav — acceptable, but explains why journey 1 needs the ER link); `/diamond-intelligence` and `/diamond-shape-studio` are reachable only via the portal/suite nav (by design — the suite is one nav item); `/conversations` appears in neither header nor footer (worth a deliberate decision); `/calibration-library` is internal and correctly absent from the sitemap.

---

# Shared design-system opportunities

In dependency order:

1. **Color tokens via Tailwind `@theme`** — ink, charcoal, muted, eyebrow, line, line-strong, ivory, body, gold, gold-deep, focus-ring (darkened). Kills the 185-hex drift at the source.
2. **`Container`** — `mx-auto max-w-[1200px] px-6 md:px-10`; adopted by Header, Footer, and all page shells.
3. **`Eyebrow`** — one size/tracking/color, contrast-compliant.
4. **`SectionHeading` (rebuilt)** — eyebrow + title + description with the agreed scale; actually adopted this time, or deleted.
5. **`Button`** — primary/secondary/ghost/text variants; composes `ConsultationCtaLink`; carries the shared focus ring and the 300ms hover recipe.
6. **Focus-visible utility** — one ring token, applied everywhere interactive.
7. **`Card`/`Surface` recipe** — radius scale (18/22/28), `--hg-line` border, one soft shadow.
8. **Motion tokens** — 300ms UI / 820ms enter / luxury bezier; documented rail-route policy.
9. **`StudioDisclosure`** — one `<details>`-based disclosure shared by DI chapters, Shape Studio editorial, and Our Approach FAQs, with ≥44px toggle affordances.
10. **`MarketingClosingCta`** — the ER/Custom-Design closing block generalized (eyebrow + heading + one Button).
11. **Studio tool intro block** — `DiamondStudioToolHeader` adopted by all three tools + optional trust-chip row.
12. **`FormField` recipe** — the Concierge input/label/error classes as the canonical form pattern for any future form.

---

# Items that must not change (scope guard)

- Page URLs, SEO structure (route-level), analytics events and `trackConsultationCtaClicked` location strings, conversion tracking.
- Diamond Studio calculations, calibration logic, upload/session logic, grading logic, business rules — every recommendation above is presentation-layer only.
- Core brand language and copy voice (only CTA-label alignment and surgical inline-anchor convergence are proposed).
- Production dependencies (only `@vercel/blob` is flagged, and only as a *verify-then-decide* item).
- Content hierarchy — no reordering proposed; the only content-adjacent items are documented usability gaps (H8).
- The items in "No action recommended."

---

# Recommended implementation sequence

Seven small, independently reviewable and reversible passes. Each ends with a visual spot-check of affected pages; no pass mixes concerns.

**Pass 1 — Shared design-system corrections** *(foundation; largest visual diff, zero behavior change)*
1a. Tokens: `@theme` colors, fix `layout.tsx` + `globals.css` defaults, darken focus ring (C1, C3).
1b. Migrate high-frequency hex families (line → ink → eyebrow → charcoal → muted), one family per commit.
1c. Primitives: Container, Eyebrow, rebuilt SectionHeading, Button (+ ConsultationCtaLink composition), focus utility (H1, H2, H3).
1d. Align Footer/Header container + dark CTA fills (M1, M2).

**Pass 2 — Mobile & tablet polish**
Home gallery grid staging (H6); tap targets on Footer/nav/disclosures/ledger subnav (H4); hero type-scale alignment (H2 residual); vertical-rhythm outliers + cramped grids + 9px microcopy (M10); studio padding micro-drift + portal CTA sizing (M11); header `md` crowding decision (with H5).

**Pass 3 — Diamond Studio UX cohesion**
Name map applied to chrome/editorial (C5, M4 — metadata edits reviewed separately against SEO scope); Finger adopts `DiamondStudioToolHeader` (M5); shared disclosure + recovery-label alignment (M6 studio parts); DI intro/error hierarchy alignment; capture-page token binding (M11); Shape Studio Concierge exit (H7 — journey fix, but ships naturally here).

**Pass 4 — Accessibility corrections**
Landmarks + skip link + Header-in-layout + pathname-based active nav (C4, M3); Size Studio slider keyboard support + Shape Studio calibration nudges (C2); menu disclosure semantics (H5); DI live regions (H12); studio ARIA completions (M12); eyebrow/gold contrast (with Pass 1 tokens); heading order + video captions policy (M13).

**Pass 5 — Restrained motion**
Motion tokens + duration/easing convergence (M7); page-entry dialect decision + rail allowlist documentation (H10); Whispered Praise reduced-motion + system alignment (H10); remaining reduced-motion gaps (M8); DI result-state fade (M9); dead CTAGlimmer imports, `delay` prop decision, scintillation hook swap (L4, L5).

**Pass 6 — User-journey refinement**
ER → Our Approach link; light-performance hub → DI; certification hub closing CTA; shapes → Shape Studio link (H8); The House CTA label + DI casing (H9); studio stage CTA demotion + Conversations hub closing line (M15); surgical guide inline-anchor convergence (H9, capped at a small approved-phrase list).

**Pass 7 — Cleanup & consolidation**
Delete dead DI V2 pile + legacy nav + deprecated CAD shims + dead theme/CSS (H11, L12) with DI test suites green; gitignore/purge hygiene items + untrack junk + prune branches (M14, confirm `marketing-sprint` backup first); orphan SVGs; JsonLd dedupe (L11); naming/file-location tidy (L2); `@vercel/blob` verdict (L3).

---

*Compiled from seven parallel code-level audits (design consistency, studio ecosystem, responsive, accessibility, motion, journeys, consolidation) with file:line evidence throughout. No files were modified during the audit.*
