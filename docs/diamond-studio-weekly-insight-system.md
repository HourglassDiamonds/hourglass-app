# Diamond Studio — Weekly Insight System

Internal planning document for turning Diamond Studio GA4 behavior into repeatable weekly business decisions.

---

## 1. Purpose

Diamond Studio analytics exist to convert anonymous visitor behavior into **actionable weekly insight** for Hourglass Diamonds—not to produce vanity metrics.

Each week, event data should inform:

- **Content** — what to publish, emphasize, or retire on site and social
- **Sourcing** — which shapes, sizes, and presence levels clients are exploring before they speak with us
- **SEO** — which topics and long-tail queries deserve new or updated pages
- **GMB posts** — local, trust-forward posts grounded in real interest signals
- **Consultation strategy** — how prospects arrive at the studio, what they adjust, and what precedes a concierge click

This system is **documentation and process only**. Implementation lives in GA4 configuration, Explore reports, and a consistent weekly review ritual—not in product UI.

---

## 2. GA4 Events Tracked

All events fire from `app/diamond-studio/page.tsx` via `app/diamond-studio/analytics.ts` (gtag).

| Event | When it fires |
|-------|----------------|
| `diamond_studio_view` | Once per Diamond Studio page load |
| `shape_selected` | User selects a different diamond shape |
| `carat_changed` | Carat slider/stepper commit (not every drag tick) |
| `finger_size_changed` | Finger size slider/stepper commit (not every drag tick) |
| `coverage_zone_changed` | Coverage zone changes after settings update (debounced) |
| `orientation_changed` | User switches stone orientation (N/S ↔ E/W) |
| `skin_tone_selected` | User changes skin tone (light / medium / dark) |
| `studio_session_engaged` | Once per session: 45s on page **or** 5 meaningful interactions |
| `consultation_cta_clicked` | User clicks any link to `/concierge` within Diamond Studio |

**Supporting event (studio context):**

| Event | When it fires |
|-------|----------------|
| `home_clicked` | User clicks HOME in the Diamond Studio top bar |

---

## 3. Custom Dimensions

Register these in GA4 as **event-scoped custom dimensions** mapped to the parameter names sent with Diamond Studio events.

| Dimension (GA4 display name) | Event parameter |
|------------------------------|-----------------|
| Shape | `shape` |
| Carat | `carat` |
| Finger Size | `fingerSize` |
| Coverage Percent | `coveragePercent` |
| Coverage Zone | `coverageZone` |
| Orientation | `orientation` |
| Skin Tone | `skinTone` |
| Device Type | `deviceType` |
| Engagement Trigger | `engagementTrigger` |
| Source | `source` |

**Notes:**

- `engagementTrigger` is populated on `studio_session_engaged` only (`time` or `interactions`).
- `source` is populated on `consultation_cta_clicked` only (e.g. `diamond_studio`).
- Coverage zones in product: understated, balanced, noticeable, statement, dramatic (see studio logic).

---

## 4. Weekly Questions To Answer

Use the past 7 days (or calendar week) of Diamond Studio data to answer:

1. **Which shapes received the most interaction?**  
   Rank `shape_selected` volume and unique users by `shape`.

2. **Which carat ranges are clustering?**  
   Distribution of `carat` on `carat_changed` and on high-intent events (`studio_session_engaged`, `consultation_cta_clicked`).

3. **Are users engaging more with understated, balanced, or statement coverage?**  
   Break down `coverage_zone_changed` and session-end states by `coverageZone`.

4. **Are mobile users behaving differently than desktop users?**  
   Compare `deviceType` across events, engagement rate, and consultation clicks.

5. **Are east/west orientations gaining interest?**  
   Share of `orientation_changed` (and final `orientation` on engaged sessions) for `ew` vs `ns`, especially on oval and elongated shapes.

6. **Which interactions appear before consultation clicks?**  
   Sequence or same-session patterns: shape → carat → finger → zone → orientation → `consultation_cta_clicked`.

7. **Which Diamond Guide articles should be updated based on behavior?**  
   Map top shapes, carat bands, and coverage zones to existing guide slugs; flag gaps.

8. **What content should we create this week?**  
   One primary theme (educational, inspirational, or commercial) derived from the strongest signal—not generic jewelry filler.

---

## 5. Weekly Output Format

Copy this template each week. Keep answers concise; link to GA4 Explore exports or screenshots in your internal notes.

```markdown
# Diamond Studio Weekly Insight
**Week of:** YYYY-MM-DD to YYYY-MM-DD  
**Prepared by:**  
**Data source:** GA4 (property: Hourglass Diamonds)

---

## Executive Summary
(3–5 sentences: what mattered most, one commercial takeaway, one recommended action.)

---

## Notable Behavior
- Top shapes by interaction:
- Carat clusters:
- Coverage zone mix:
- Mobile vs desktop:
- Orientation (N/S vs E/W):
- Engagement (`studio_session_engaged` rate, trigger split time vs interactions):
- Consultation CTA clicks:

---

## Commercial Interpretation
(What this suggests about how people are shopping for rings—confidence, size appetite, taste, readiness to talk.)

---

## Recommended Content
- Site / blog:
- Email or nurture (if applicable):

---

## Recommended GMB Post
(One post idea: angle, hook, CTA—aligned to this week’s behavior signal.)

---

## Recommended Diamond Guide Updates
- Article:
- Change:
- Why (tie to event data):

---

## Recommended Social / Reel Ideas
1.
2.
3.

---

## Watch Items For Next Week
- Metric or behavior to monitor:
- Hypothesis to validate:
- GA4 setup or report gap to fix:
```

---

## 6. Rules

- **This file is documentation only.** Do not treat edits here as a request to change site UI, routes, analytics code, or styling.
- Event names and parameters must stay aligned with `app/diamond-studio/analytics.ts` when code changes; update this doc in the same PR if instrumentation changes.
- Weekly insights are for **internal strategy**; do not publish raw GA4 screenshots or PII in public channels.
- Prefer **one clear recommendation per section** over long lists—quality of interpretation beats volume of bullets.

---

*Last aligned with Diamond Studio analytics: shape, carat, finger, coverage, orientation, skin tone, session engagement, consultation CTA.*
