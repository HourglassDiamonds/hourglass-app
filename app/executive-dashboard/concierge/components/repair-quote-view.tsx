import Link from "next/link";
import { formatUsdCents, formatUsdEighthCents } from "@/lib/continuum/repair-quoting/money";
import {
  hourglassMarkupLabel,
  laborBurdenLabel,
  REPAIR_QUOTE_ADD_LABEL,
  REPAIR_QUOTE_SECTION_TITLE,
  REPAIR_QUOTE_STATE_LABELS,
  REPAIR_QUOTES_NONE_LABEL,
  REPAIR_QUOTES_NOT_CONNECTED_LABEL,
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
  const calc = quote.calculation;
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

      <dl className="mt-8 space-y-4">
        <Row label="Repair type" value={repairQuoteTypeLabel(quote.repairType)} />
        <Row label="Metal" value={repairMetalLabel(quote.metalFamily)} />
        <Row label="Source edition" value={quote.sourceEditionLabel} />
        <Row label="Source SKU" value={quote.sourceSku} />
        <Row label="Source task" value={calc.sourceTaskDescription} />
        <Row label="Price Labor" value={formatUsdCents(calc.sourceAmounts.priceLaborCents)} />
        <Row label="Price Parts" value={formatUsdCents(calc.sourceAmounts.pricePartsCents)} />
        <Row label="Price Other" value={formatUsdCents(calc.sourceAmounts.priceOtherCents)} />
        <Row label="Cost Labor" value={formatUsdCents(calc.sourceAmounts.costLaborCents)} />
        <Row label="Cost Parts" value={formatUsdCents(calc.sourceAmounts.costPartsCents)} />
        <Row label="Cost Other" value={formatUsdCents(calc.sourceAmounts.costOtherCents)} />
        <Row
          label="Loaded labor"
          value={formatUsdEighthCents(calc.loadedLaborEighthCents)}
        />
        <Row label="Labor burden" value={laborBurdenLabel()} />
        <Row label="Hourglass markup" value={hourglassMarkupLabel()} />
        {calc.metalBand ? <Row label="Metal / gold band" value={calc.metalBand.label} /> : null}
        <Row
          label="Raw computed quote"
          value={formatUsdEighthCents(calc.rawComputedQuoteEighthCents)}
        />
        {quote.override ? (
          <>
            <Row
              label="Founder override"
              value={formatUsdCents(quote.override.amountCents)}
            />
            <Row
              label="Override reason"
              value={`${quote.override.reason} · ${quote.override.overriddenBy}`}
            />
          </>
        ) : null}
        <Row label="Hourglass quote" value={repairQuoteAmountLabel(quote)} />
        {quote.issuedAt ? <Row label="Issued" value={quote.issuedAt} /> : null}
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
