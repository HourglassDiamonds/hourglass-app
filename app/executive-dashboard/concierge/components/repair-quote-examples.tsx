import {
  ADDITIONAL_METAL_LABEL,
  FINAL_QUOTE_LABEL,
  LOADED_COST_LABEL,
  metalPricingLabel,
  RAW_QUOTE_LABEL,
  ROUNDED_QUOTE_LABEL,
  SOURCE_COST_LABEL,
  SOURCE_LABOR_LABEL,
  SOURCE_PARTS_LABEL,
} from "@/lib/continuum/repair-quoting/present";
import { founderQuoteExamples } from "@/lib/continuum/repair-quoting/examples";
import { formatUsdCents, formatUsdEighthCents } from "@/lib/continuum/repair-quoting/money";
import { EXTRAPOLATED_METAL_LABEL } from "@/lib/continuum/repair-quoting/gold-14k";

export function RepairQuotePolicyExamples() {
  const examples = founderQuoteExamples();
  return (
    <section className="mt-12 border-t border-white/10 pt-8">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        Founder V1 examples · internal only
      </p>
      <div className="mt-6 space-y-8">
        {examples.map((example) => (
          <article key={example.id}>
            <h2 className="font-serif text-[1.2rem] text-[#efe8de]">{example.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-[#c4b7aa]">{example.body}</p>
            {example.result.ok ? (
              <dl className="mt-4 space-y-2">
                <Row
                  label={SOURCE_LABOR_LABEL}
                  value={formatUsdEighthCents(
                    example.result.calculation.explanation.sourceLaborEighthCents,
                  )}
                />
                <Row
                  label={SOURCE_PARTS_LABEL}
                  value={formatUsdEighthCents(
                    example.result.calculation.explanation.sourcePartsEighthCents,
                  )}
                />
                {example.result.calculation.explanation.additionalMetalEighthCents > 0 ? (
                  <Row
                    label={ADDITIONAL_METAL_LABEL}
                    value={formatUsdEighthCents(
                      example.result.calculation.explanation.additionalMetalEighthCents,
                    )}
                  />
                ) : null}
                <Row
                  label={SOURCE_COST_LABEL}
                  value={`Labor ${formatUsdCents(example.result.calculation.sourceAmounts.costLaborCents)} · Parts ${formatUsdCents(example.result.calculation.sourceAmounts.costPartsCents)} · Other ${formatUsdCents(example.result.calculation.sourceAmounts.costOtherCents)}`}
                />
                <Row
                  label={LOADED_COST_LABEL}
                  value={formatUsdEighthCents(
                    example.result.calculation.fullyLoadedDirectCostEighthCents,
                  )}
                />
                <Row
                  label={RAW_QUOTE_LABEL}
                  value={formatUsdEighthCents(
                    example.result.calculation.rawComputedQuoteEighthCents,
                  )}
                />
                <Row
                  label={ROUNDED_QUOTE_LABEL}
                  value={formatUsdEighthCents(
                    example.result.calculation.roundedComputedQuoteEighthCents,
                  )}
                />
                <Row
                  label={FINAL_QUOTE_LABEL}
                  value={formatUsdEighthCents(
                    example.result.calculation.hourglassQuoteEighthCents,
                  )}
                />
                <Row
                  label="Metal pricing"
                  value={metalPricingLabel(example.result.calculation.metalPricing)}
                />
                {example.result.calculation.metalExtrapolation ? (
                  <Row
                    label={EXTRAPOLATED_METAL_LABEL}
                    value={example.result.calculation.metalExtrapolation.explanation}
                  />
                ) : null}
              </dl>
            ) : (
              <p className="mt-3 text-[15px] leading-relaxed text-[#d2b8a8]">
                Fail closed: {example.result.code}
              </p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-[#e7ddd2]">
        {value}
      </dd>
    </div>
  );
}
