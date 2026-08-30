/**
 * Read-only reconstruction proposal. Candidate-only. canonical: false.
 * Does not write Persons, specs, or lifecycle. No mutation control.
 */
import {
  reconstructionProposalView,
  type ProjectReconstructionProposal,
} from "@/lib/continuum/gmail/reconstruction-proposal";
import { ClientMemorySection } from "./client-memory-section";

function FactList({
  rows,
}: {
  rows: readonly { label: string; value: string; note?: string }[];
}) {
  return (
    <dl className="space-y-4">
      {rows.map((row) => (
        <div key={`${row.label}:${row.value}`}>
          <dt className="text-[11px] uppercase tracking-[0.16em] text-[#8d8073]">
            {row.label}
          </dt>
          <dd className="mt-1 text-[15px] text-[#efe8de]">{row.value}</dd>
          {row.note ? (
            <p className="mt-1 text-[13px] leading-relaxed text-[#c4b7aa]">
              {row.note}
            </p>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export function AchedekalReconstructionProposal({
  proposal,
}: {
  proposal: ProjectReconstructionProposal;
}) {
  const view = reconstructionProposalView(proposal);

  return (
    <ClientMemorySection title="Reconstruction proposal">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">
        {view.supportedHeading}
      </p>
      <div className="mt-4">
        <FactList rows={view.supportedFacts} />
      </div>

      {view.componentDimensions.length > 0 ? (
        <div className="mt-8">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">
            CAD component dimensions
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-[#8d8073]">
            Station / component measurements from the CAD artifact — not
            gemstone dimensions.
          </p>
          <div className="mt-4">
            <FactList rows={view.componentDimensions} />
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">
          {view.unresolvedHeading}
        </p>
        <ul className="mt-4 space-y-2 text-[15px] leading-relaxed text-[#c4b7aa]">
          {view.unresolvedFacts.map((row) => (
            <li key={row.label}>{row.label}</li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">
          {view.storedHeading}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-[#8d8073]">
          {view.storedBanner}
        </p>
        <div className="mt-4">
          <FactList rows={view.conflictingStoredData} />
        </div>
      </div>

      <p className="mt-8 text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        {view.noChangesCopy}
      </p>
    </ClientMemorySection>
  );
}
