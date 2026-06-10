# Diamond Intelligence V3 — Component Mapping

Design-only migration. Data sources unchanged; presentation branches on `reportFormat` (display passthrough from server `parserType`).

| Current component | V3 surface | Data / notes |
|---|---|---|
| `LightPerformanceDashboard.tsx` | Orchestrator — hero + accordion stack | Same hooks; branches Standard vs GCAL 8X vs partial grades |
| `DiamondIntelligenceHero.tsx` | `DiV3Hero.tsx` | `verdictLabel`, percentile from `interpretationContext`, traits from `clientScore` |
| `VisualPersonalitySection.tsx` | Accordion **02** body | `visualPersonality`; GCAL 8X uses static copy |
| `AdvisoryHighlightsSection.tsx` + `EvidenceColumn.tsx` | Accordion **03** body | `advisoryHighlights.strengths` / `worthKnowing` |
| `OpticalProfileSection.tsx` | *(removed from main flow)* | Radar not in V3 spec; spectrum in accordion **04** |
| `AdvisoryHighlightsSection` limitations | Accordion **05** body | `CONSUMER_COPY.reportCannotConfirmItems`; 8X title variant |
| `JustinsPerspectiveSection.tsx` | Accordion **06** body | Concierge CTA preserved; 8X static copy |
| `DiamondTechnicalProfileSection.tsx` | Accordion **07** body | `decisionProfile` + `interpretationContext` |
| `ReportMeasurementsSection.tsx` | Accordion **08** body | `fields`, `faceUpCopy`, `diameter` |
| `ReportDossier.tsx` | *(removed from layout)* | Provenance demoted; measurements in ch. 08 |
| `GuidedReportCompletion.tsx` | Restyled inline / below partial hero | Proportion fields only — behavior unchanged |
| `DiAccordion.tsx` | `DiV3Chapter.tsx` | Native `<details>`, closed by default, chapter styling |
| `di-studio-styles.ts` | `di-v3-styles.ts` | V3 tokens (paper, gold, chapter, hero) |
| *(new)* `DiV3PartialGradeReview.tsx` | Partial hero when color/clarity missing | Local `gradeHints` update — no API change |
| *(new)* `DiV3SpectrumSection.tsx` | Accordion **04** | Standard 6-tier ladder or GCAL 8X elite 2-tier |
| *(new)* `v3-presentation.ts` | Presentation helpers | Percentile, tier map, 8X tier remap, trait line |

## Framework branching

- **Standard**: GIA, IGI, GCAL Sarine, report-only — percentile, better-than, full ladder.
- **GCAL 8X**: `isGcal8xReport(metadata)` — verified badge, Rare/Exceptional only, no percentile.
- **Partial grades**: `needsPartialGradeReview({ gradeHints, canShowScore })` — only when 4Cs are truly missing/unusable and score is not yet eligible.
