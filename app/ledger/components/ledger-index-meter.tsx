import Link from "next/link";
import type { LedgerIndexDefinition } from "../ledger-data";

const LABEL = "font-sans text-[10px] uppercase tracking-[0.16em] text-[#6d655e]";
const SCALE_LABEL =
  "font-sans text-[10px] uppercase tracking-[0.08em] text-[#6d655e]";

const METER_CARD =
  "rounded-[20px] border border-black/[0.08] bg-[#faf6ef] shadow-[0_16px_40px_rgba(28,22,16,0.055),0_2px_10px_rgba(28,22,16,0.03)]";

const METER_CARD_FULL = `${METER_CARD} p-7 md:p-9`;
const METER_CARD_COMPACT = `${METER_CARD} px-7 py-8 sm:px-8 sm:py-9`;

const INNER_PILL =
  "rounded-[14px] border border-black/[0.08] bg-[#f7f2e8] p-[13px]";

const CONTENT_WIDTH = "mx-auto w-full max-w-[920px]";

type LedgerIndexMeterProps = {
  index: LedgerIndexDefinition;
  variant?: "compact" | "full";
  className?: string;
};

function DegreeNumber({ value }: { value: number }) {
  return (
    <>
      {value}
      <span className="text-[0.42em] font-bold">°</span>
    </>
  );
}

function formatWeeklyDelta(change: number, override?: string): string {
  if (override) return override;
  if (change > 0) return `↑ +${change} Weekly Read`;
  if (change < 0) return `↓ ${change} Weekly Read`;
  return "Unchanged Weekly Read";
}

function IndexScaleBar({
  index,
  compact,
}: {
  index: LedgerIndexDefinition;
  compact?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, index.reading));
  const markerLeft = `${clamped}%`;
  const wrapClass = compact
    ? "mb-4 mt-7 md:mb-5 md:mt-9"
    : "mb-4 mt-8 md:mb-5 md:mt-10";

  return (
    <div className={wrapClass}>
      <div className="relative h-[14px] overflow-visible rounded-full">
        <div
          className="h-full w-full rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.55),inset_0_-1px_2px_rgba(0,0,0,0.12)]"
          style={{ background: index.scaleGradient }}
          aria-hidden
        />
        <div
          className="absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#2a2826] bg-[#faf8f5] shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
          style={{ left: markerLeft }}
          aria-hidden
        />
      </div>
      <div className={`mt-3 flex justify-between gap-1 ${SCALE_LABEL}`}>
        {index.scaleLabels.map((label) => (
          <span
            key={label}
            className="min-w-0 flex-1 truncate text-center first:text-left last:text-right"
          >
            {label}
          </span>
        ))}
      </div>
      <p className="sr-only">
        {index.displayTitle} at {clamped} degrees
        {index.weeklyDeltaLabel
          ? `. ${index.weeklyDeltaLabel}. ${index.weeklyDeltaExplanation ?? ""}`
          : "."}
      </p>
    </div>
  );
}

function MainReadingRow({
  index,
  compact,
}: {
  index: LedgerIndexDefinition;
  compact?: boolean;
}) {
  const degreeClass = compact
    ? "font-serif text-[clamp(3.2rem,8vw,4.65rem)] font-bold leading-[0.88] tracking-[-0.07em] text-[#2a2826]"
    : "font-serif text-[clamp(3.6rem,8.5vw,5.35rem)] font-bold leading-[0.9] tracking-[-0.06em] text-[#2a2826]";

  const rowClass = compact
    ? "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6"
    : "flex flex-col gap-3.5 max-[800px]:block min-[801px]:flex-row min-[801px]:items-end min-[801px]:justify-between min-[801px]:gap-5";

  const deltaWrapClass = compact
    ? "shrink-0 max-sm:mt-1 sm:pb-2.5 sm:max-w-[16rem] sm:text-right"
    : "max-[800px]:mt-3.5 min-[801px]:shrink-0 min-[801px]:pb-2.5 min-[801px]:max-w-[18rem] min-[801px]:text-right";

  const deltaLabel = formatWeeklyDelta(
    index.weeklyDelta,
    index.weeklyDeltaLabel,
  );

  return (
    <div className={`${rowClass} pb-4 md:pb-5`}>
      <div className="min-w-0 pt-0.5">
        <p className={degreeClass}>
          <DegreeNumber value={index.reading} />
        </p>
        <p className={`mt-2 ${LABEL}`}>{index.readingLabel}</p>
      </div>
      <div className={deltaWrapClass}>
        <span className="inline-flex items-center whitespace-nowrap rounded-full border border-[rgba(140,75,63,0.22)] bg-[rgba(140,75,63,0.055)] px-[10px] py-2 font-sans text-[10px] uppercase tracking-[0.13em] text-[#6f4038]">
          {deltaLabel}
        </span>
        <p className={`mt-[9px] ${LABEL}`}>{index.status}</p>
        {index.weeklyDeltaExplanation ? (
          <p
            className="mt-2.5 max-w-none text-left text-[0.8rem] leading-[1.55] normal-case tracking-normal text-[#6d655e] sm:max-w-[18rem] sm:text-right"
            role="note"
          >
            {index.weeklyDeltaExplanation}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MeterCard({
  index,
  variant,
}: {
  index: LedgerIndexDefinition;
  variant: "compact" | "full";
}) {
  const compact = variant === "compact";
  const benchmarks = index.benchmarks ?? [];
  const cardClass = compact ? METER_CARD_COMPACT : METER_CARD_FULL;

  return (
    <article className={cardClass}>
      <MainReadingRow index={index} compact={compact} />
      <IndexScaleBar index={index} compact={compact} />
      <p
        className={`leading-[1.78] text-[#3d3a36] ${
          compact
            ? "mt-6 text-[0.98rem] md:mt-7 md:text-[1.02rem]"
            : "mt-7 text-[1.05rem] md:mt-8"
        }`}
      >
        {compact ? (
          index.summaryCompact
        ) : index.summaryEmphasis ? (
          <>
            {index.summaryLead ?? "The market remains in a"}{" "}
            <strong className="font-semibold text-[#1f1d1a]">
              {index.summaryEmphasis}
            </strong>
            . {index.summary}
          </>
        ) : (
          index.summary
        )}
      </p>
      <p
        className={`border-t border-black/[0.08] leading-[1.78] text-[#6d655e] ${
          compact
            ? "mt-6 pt-5 text-[0.95rem] md:mt-7 md:pt-5 md:text-[1.02rem]"
            : "mt-7 pt-5 text-[1.05rem] md:mt-8 md:pt-6"
        }`}
      >
        <strong className="font-semibold text-[#4a4540]">
          This week&apos;s signal:
        </strong>{" "}
        {compact ? index.weeklyNoteCompact : index.weeklyNote}
      </p>
      <div
        className={`mt-6 grid grid-cols-1 gap-3 md:mt-8 ${
          compact ? "sm:grid-cols-3" : "min-[801px]:grid-cols-3"
        }`}
      >
        {index.methodPills.map((pill) => (
          <div key={pill.label} className={INNER_PILL}>
            <span className={LABEL}>{pill.label}</span>
            <p className="mt-[5px] text-[0.92rem] leading-[1.5] text-[#292724]">
              {pill.value}
            </p>
          </div>
        ))}
      </div>
      <div
        className={`border-t border-black/[0.08] pt-6 md:pt-7 ${
          compact ? "mt-7 md:mt-8" : "mt-8 md:mt-9"
        }`}
      >
        <h3 className={LABEL}>Recent Weekly Readings</h3>
        <div
          className={`mt-4 grid gap-3 ${
            compact
              ? "grid-cols-2 sm:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          }`}
        >
          {index.recentReadings.map((item) => (
            <div key={item.week} className={INNER_PILL}>
              <p className={`${LABEL} !text-[10px]`}>{item.week}</p>
              <p className="my-1.5 font-serif text-[1.4rem] font-bold leading-none tracking-[-0.04em] text-[#2a2826]">
                <DegreeNumber value={item.degrees} />
              </p>
              <p className={`${LABEL} !text-[10px]`}>{item.state}</p>
            </div>
          ))}
        </div>
      </div>
      {variant === "full" && benchmarks.length > 0 ? (
        <div className="mt-9 md:mt-11">
          <span className={`block ${LABEL}`}>Historical Benchmark Readings</span>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {benchmarks.map((bench) => (
              <div key={bench.name} className={INNER_PILL}>
                <p className="font-serif text-[0.95rem] font-bold leading-[1.25] text-[#171717]">
                  {bench.name}
                </p>
                <p className="my-2 font-serif text-[1.4rem] font-bold leading-none tracking-[-0.04em] text-[#2a2826]">
                  <DegreeNumber value={bench.score} />
                </p>
                <p className={`${LABEL} !text-[10px]`}>{bench.note}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}

/**
 * Shared meter for non-GPI Ledger indexes.
 * Global Pressure uses GlobalPressureMonitor; numerical GPI UI is archived.
 */
export default function LedgerIndexMeter({
  index,
  variant = "full",
  className = "",
}: LedgerIndexMeterProps) {
  const isFull = variant === "full";
  const headingId = `ledger-index-${index.id}-title`;

  return (
    <section
      className={`${CONTENT_WIDTH} text-[#171717] ${className}`}
      aria-labelledby={headingId}
    >
      {isFull ? (
        <>
          <span className={LABEL}>{index.kicker}</span>
          <h1
            id={headingId}
            className="mt-2 font-serif text-[clamp(2.6rem,5vw,4.4rem)] font-normal leading-[1.02] tracking-[-0.045em]"
          >
            {index.displayTitle}
          </h1>
          <p className="mt-6 max-w-[680px] font-serif text-[1.05rem] leading-[1.78] text-[#2c2a27]">
            {index.intro}
          </p>
          <p className="mt-4 text-[0.95rem] italic text-[#6d655e]">
            {index.updatedLabel}
          </p>
          <div className="mt-10 md:mt-14">
            <MeterCard index={index} variant="full" />
          </div>
        </>
      ) : (
        <>
          <p className={LABEL}>Current reading</p>
          <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2
              id={headingId}
              className="font-serif text-[1.25rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.35rem]"
            >
              {index.displayTitle}
            </h2>
            <Link
              href={`/ledger/${index.slug}`}
              className={`${LABEL} hover:text-[#4a4540]`}
            >
              View full index →
            </Link>
          </div>
          <div className="mt-8 md:mt-10">
            <MeterCard index={index} variant="compact" />
          </div>
          <p className="mt-5 text-[0.95rem] italic text-[#6d655e]">
            {index.updatedLabel}
          </p>
        </>
      )}
    </section>
  );
}
