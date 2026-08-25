import {
  formatNoteDate,
  RELATIONSHIP_CONTEXT_LAYER_LABELS,
} from "@/lib/continuum/client-memory/read/presentation";
import type { HumanSourceDetailView as HumanSourceDetailModel } from "@/lib/continuum/client-memory/human-intake";
import {
  humanCommunicationLabel,
  humanReviewStatusLabel,
  humanSourceTypeLabel,
  reportedTextProvenanceLabel,
} from "@/lib/continuum/client-memory/human-intake/labels";

export function HumanSourceDetail({
  detail,
}: {
  detail: HumanSourceDetailModel;
}) {
  const { source } = detail;
  const context =
    source.contextLayerConfirmed ?? source.contextLayerProposed;
  const provenance = reportedTextProvenanceLabel(
    source.reportedCommunicationType,
  );

  return (
    <article>
      <p className="text-[11px] uppercase tracking-[0.22em] text-[#8d8073]">
        {humanSourceTypeLabel(source.sourceType)}
      </p>
      <h1 className="mt-4 font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
        {humanCommunicationLabel(source.reportedCommunicationType)}
      </h1>
      {provenance ? (
        <p className="mt-4 text-[15px] leading-relaxed text-[#d8cfc4]">
          {provenance}. Continuum did not read the original text conversation.
        </p>
      ) : null}

      <dl className="mt-8 space-y-4">
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Review
          </dt>
          <dd className="mt-1 text-[15px] text-[#d8cfc4]">
            {humanReviewStatusLabel(source.reviewStatus)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Ingested
          </dt>
          <dd className="mt-1 text-[15px] text-[#d8cfc4]">
            {formatNoteDate(source.ingestedAt)}
          </dd>
        </div>
        {source.capturedAt ? (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Captured
            </dt>
            <dd className="mt-1 text-[15px] text-[#d8cfc4]">
              {formatNoteDate(source.capturedAt)}
            </dd>
          </div>
        ) : null}
        {context ? (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Context
            </dt>
            <dd className="mt-1 text-[15px] text-[#d8cfc4]">
              {RELATIONSHIP_CONTEXT_LAYER_LABELS[context]}
            </dd>
          </div>
        ) : null}
        {detail.personNames.length > 0 ? (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              People
            </dt>
            <dd className="mt-1 text-[15px] text-[#d8cfc4]">
              {detail.personNames.join(", ")}
            </dd>
          </div>
        ) : null}
        {detail.projectTitles.length > 0 ? (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              Projects
            </dt>
            <dd className="mt-1 text-[15px] text-[#d8cfc4]">
              {detail.projectTitles.join(", ")}
            </dd>
          </div>
        ) : null}
        {source.rawMimeType || source.rawByteSize != null ? (
          <div>
            <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
              File
            </dt>
            <dd className="mt-1 text-[15px] text-[#d8cfc4]">
              {[source.rawMimeType, source.rawByteSize != null ? `${source.rawByteSize} bytes` : null]
                .filter(Boolean)
                .join(" · ")}
            </dd>
          </div>
        ) : null}
      </dl>

      {source.rawText ? (
        <section className="mt-10">
          <h2 className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
            Transcript
          </h2>
          <pre className="mt-4 whitespace-pre-wrap font-sans text-[16px] leading-relaxed text-[#efe8de]">
            {source.rawText}
          </pre>
        </section>
      ) : null}

      <p className="mt-10 text-[15px] leading-relaxed text-[#9a8e82]">
        Memory extraction is not enabled yet.
      </p>
    </article>
  );
}
