import Link from "next/link";
import { formatUsdCents } from "@/lib/continuum/repair-quoting/money";
import {
  REPAIR_QUOTE_ADD_LABEL,
  REPAIR_QUOTE_SECTION_TITLE,
  REPAIR_QUOTE_STATE_LABELS,
  REPAIR_QUOTES_NONE_LABEL,
  REPAIR_QUOTES_NOT_CONNECTED_LABEL,
  SOURCE_SEMANTICS_LABELS,
  STALE_GOLD_WARNING,
  goldWeightLabel,
  markupMultipleLabel,
  repairMetalLabel,
  repairQuoteAmountLabel,
  repairQuoteDisplayTitle,
  repairQuoteTypeLabel,
} from "@/lib/continuum/repair-quoting/present";
import type { RepairQuote } from "@/lib/continuum/repair-quoting/types";
import {
  conciergeNewRepairQuotePath,
  conciergeRepairQuotePath,
  conciergeRepairQuotesPath,
} from "@/lib/continuum/client-memory/read/presentation";
import { formatDateOnlyShort } from "@/lib/continuum/date-only";

export function RepairQuotesSection({
  projectId,
  quotes,
  connected,
}: {
  projectId: string;
  quotes: RepairQuote[];
  connected: boolean;
}) {
  return (
    <section className="mt-10">
      <p className="text-[11px] uppercase tracking-[0.28em] text-[#ad9164]">
        {REPAIR_QUOTE_SECTION_TITLE}
      </p>
      {!connected ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">
          {REPAIR_QUOTES_NOT_CONNECTED_LABEL}
        </p>
      ) : quotes.length === 0 ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">
          {REPAIR_QUOTES_NONE_LABEL}
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {quotes.map((quote) => (
            <li key={quote.quoteId}>
              <Link
                href={conciergeRepairQuotePath(projectId, quote.quoteId)}
                className="block min-h-11 outline-none"
              >
                <p className="font-serif text-[1.15rem] text-[#efe8de]">
                  {repairQuoteDisplayTitle(quote)}
                </p>
                <p className="mt-1 text-[13px] text-[#c4b7aa]">
                  {REPAIR_QUOTE_STATE_LABELS[quote.state]} · {repairQuoteAmountLabel(quote)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {connected ? (
        <Link
          href={conciergeNewRepairQuotePath(projectId)}
          className="mt-4 inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          {REPAIR_QUOTE_ADD_LABEL}
        </Link>
      ) : null}
    </section>
  );
}

export function RepairQuoteDetail({
  quote,
  projectTitle,
  personName,
}: {
  quote: RepairQuote;
  projectTitle: string;
  personName: string | null;
}) {
  const stale = quote.calculation.warnings.includes("stale-gold");
  return (
    <article>
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">
        {REPAIR_QUOTE_STATE_LABELS[quote.state]}
      </p>
      <h1 className="mt-3 font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
        {repairQuoteDisplayTitle(quote)}
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[#c4b7aa]">{projectTitle}</p>
      {personName ? (
        <p className="mt-1 text-[15px] leading-relaxed text-[#c4b7aa]">{personName}</p>
      ) : null}

      {stale ? (
        <p role="status" className="mt-6 text-[14px] leading-relaxed text-[#d2b8a8]">
          {STALE_GOLD_WARNING}
        </p>
      ) : null}

      <dl className="mt-8 space-y-4">
        <Row label="Repair type" value={repairQuoteTypeLabel(quote.repairType)} />
        <Row label="Metal" value={repairMetalLabel(quote.metalFamily)} />
        <Row label="Source edition" value={quote.sourceEditionLabel} />
        <Row
          label="Book number means"
          value={SOURCE_SEMANTICS_LABELS[quote.sourcePriceSemantics]}
        />
        {quote.lines.map((line) => (
          <div key={line.sourceLineRef}>
            <Row label="Source line" value={`${line.sourceLineRef} · ${line.sourceLineLabel}`} />
            <Row label="Source amount" value={formatUsdCents(line.sourceAmountCents)} />
            <Row
              label="Metal delta"
              value={formatUsdCents(line.metalDeltaCents)}
            />
            <Row
              label="Adjusted source"
              value={formatUsdCents(line.adjustedSourceCents)}
            />
          </div>
        ))}
        <Row
          label="Gold"
          value={`${formatUsdCents(quote.goldUsdCentsPerTroyOz)} / oz · ${formatDateOnlyShort(quote.goldAsOfDate)} · founder manual`}
        />
        {quote.goldBaselineUsdCentsPerTroyOz != null ? (
          <Row
            label="Book gold baseline"
            value={`${formatUsdCents(quote.goldBaselineUsdCentsPerTroyOz)} / oz`}
          />
        ) : null}
        {goldWeightLabel(quote) ? (
          <Row label="Gold weight" value={goldWeightLabel(quote) ?? ""} />
        ) : null}
        <Row
          label="Markup"
          value={
            quote.sourcePriceSemantics === "suggested_retail"
              ? "None — source is suggested retail"
              : markupMultipleLabel(quote.markupRatioPermyriad)
          }
        />
        <Row
          label="Computed Hourglass quote"
          value={formatUsdCents(quote.calculation.computedHourglassQuoteCents)}
        />
        {quote.override ? (
          <>
            <Row
              label="Manual override"
              value={formatUsdCents(quote.override.amountCents)}
            />
            <Row
              label="Override reason"
              value={`${quote.override.reason} · ${quote.override.overriddenBy}`}
            />
          </>
        ) : null}
        <Row label="Hourglass quote" value={repairQuoteAmountLabel(quote)} />
      </dl>
      <p className="mt-8">
        <Link
          href={conciergeRepairQuotesPath(quote.projectId)}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
        >
          All repair quotes
        </Link>
      </p>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.18em] text-[#8d8073]">{label}</dt>
      <dd className="mt-1 break-words text-[15px] leading-relaxed text-[#e7ddd2]">{value}</dd>
    </div>
  );
}
