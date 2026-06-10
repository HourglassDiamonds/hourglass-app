"use client";

import { CONSUMER_COPY } from "./consumer-display-labels";
import EvidenceColumn from "./EvidenceColumn";
import { DI_EYEBROW_STUDIO } from "./di-studio-styles";

export default function AdvisoryHighlightsSection({
  strengths,
  worthKnowing,
  limitations,
}: {
  strengths: string[];
  worthKnowing: string[];
  limitations: string[];
}) {
  const hasContent =
    strengths.length > 0 || worthKnowing.length > 0 || limitations.length > 0;
  if (!hasContent) return null;

  return (
    <section className="border-t border-[#e6dacb]/70 py-12 md:py-14">
      <p className={DI_EYEBROW_STUDIO}>{CONSUMER_COPY.supportingEvidenceLabel}</p>

      <div className="mt-10 max-w-3xl space-y-12 md:space-y-14">
        <EvidenceColumn title="What Supports the Read" items={strengths} />
        <EvidenceColumn
          title="What Deserves a Closer Look"
          items={worthKnowing}
        />
        <EvidenceColumn
          title="What the Report Cannot Confirm"
          items={limitations}
        />
      </div>
    </section>
  );
}
