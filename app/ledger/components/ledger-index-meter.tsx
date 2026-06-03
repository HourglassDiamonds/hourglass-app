import Link from "next/link";
import type { BenchmarkTier, LedgerIndexDefinition } from "../ledger-data";

const LABEL = "font-sans text-[10px] uppercase tracking-[0.16em] text-[#6f6a63]";
const GPI_LABEL =
  "gpi-label ledger-index-label font-sans text-[11px] uppercase tracking-[0.13em]";
const SCALE_LABEL =
  "font-sans text-[10px] uppercase tracking-[0.08em] text-[#6f6a63]";

const METER_CARD =
  "rounded-[20px] border border-black/[0.08] bg-[#faf6ef] shadow-[0_16px_40px_rgba(28,22,16,0.055),0_2px_10px_rgba(28,22,16,0.03)]";

const METER_CARD_FULL = `${METER_CARD} p-7 md:p-9`;
const METER_CARD_COMPACT = `${METER_CARD} px-7 py-8 sm:px-8 sm:py-9`;

const INNER_PILL =
  "rounded-[14px] border border-black/[0.08] bg-[#f7f2e8] p-[13px]";

const GPI_INNER_CARD = "ledger-index-inner-card";

const CONTENT_WIDTH = "mx-auto w-full max-w-[920px]";
const GPI_CONTENT_WIDTH = "w-full";

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

function benchTierClass(tier?: BenchmarkTier): string {
  if (!tier) return "";
  return `gpi-bench-${tier}`;
}

function IndexScaleBar({
  index,
  compact,
}: {
  index: LedgerIndexDefinition;
  compact?: boolean;
}) {
  const isGpi = index.id === "global-pressure";
  const clamped = Math.min(100, Math.max(0, index.reading));
  const markerLeft = `${clamped}%`;
  const wrapClass = compact
    ? "mb-4 mt-7 md:mb-5 md:mt-9"
    : isGpi
      ? "mb-0 mt-0"
      : "mb-4 mt-8 md:mb-5 md:mt-10";

  return (
    <div className={wrapClass}>
      <div
        className={
          isGpi
            ? "gpi-scale-track"
            : "relative h-[14px] overflow-visible rounded-full"
        }
      >
        <div
          className={
            isGpi
              ? "gpi-scale-fill"
              : "h-full w-full rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.55),inset_0_-1px_2px_rgba(0,0,0,0.12)]"
          }
          style={{ background: index.scaleGradient }}
          aria-hidden
        />
        <div
          className={
            isGpi
              ? "gpi-marker"
              : "absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#2a2826] bg-[#faf8f5] shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
          }
          style={{ left: markerLeft }}
          aria-hidden
        />
      </div>
      <div
        className={`mt-3 flex justify-between gap-1 ${isGpi ? GPI_LABEL : SCALE_LABEL}`}
      >
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
        {index.displayTitle} at {clamped} degrees.
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
  const isGpi = index.id === "global-pressure" && !compact;
  const labelCls = isGpi ? GPI_LABEL : LABEL;
  const degreeClass = compact
    ? "font-serif text-[clamp(3.2rem,8vw,4.65rem)] font-bold leading-[0.88] tracking-[-0.07em] text-[#2a2826]"
    : isGpi
      ? "gpi-main-degree font-serif text-[clamp(4rem,10vw,6.2rem)] font-bold leading-[0.88] tracking-[-0.07em] text-[#2a2826]"
      : "font-serif text-[clamp(3.6rem,8.5vw,5.35rem)] font-bold leading-[0.9] tracking-[-0.06em] text-[#2a2826]";

  const rowClass = compact
    ? "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6"
    : "flex flex-col gap-3.5 max-[800px]:block min-[801px]:flex-row min-[801px]:items-end min-[801px]:justify-between min-[801px]:gap-5";

  const deltaWrapClass = compact
    ? "shrink-0 max-sm:mt-1 sm:pb-2.5 sm:text-right"
    : "max-[800px]:mt-3.5 min-[801px]:shrink-0 min-[801px]:pb-2.5 min-[801px]:text-right";

  return (
    <div className={`${rowClass} ${isGpi ? "" : "pb-4 md:pb-5"}`}>
      <div className="min-w-0 pt-0.5">
        <p className={degreeClass}>
          <DegreeNumber value={index.reading} />
        </p>
        <p className={`mt-2 ${labelCls}`}>{index.readingLabel}</p>
      </div>
      <div className={deltaWrapClass}>
        <span
          className={
            isGpi
              ? "ledger-index-delta"
              : "inline-flex items-center whitespace-nowrap rounded-full border border-[rgba(140,75,63,0.22)] bg-[rgba(140,75,63,0.055)] px-[10px] py-2 font-sans text-[10px] uppercase tracking-[0.13em] text-[#6f4038]"
          }
        >
          ↑ +{index.weeklyDelta} Weekly Read
        </span>
        <p className={`gpi-delta-note mt-[9px] ${labelCls}`}>{index.status}</p>
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
  const isGpi = index.id === "global-pressure" && variant === "full";
  const benchmarks = index.benchmarks ?? [];
  const labelCls = isGpi ? GPI_LABEL : LABEL;
  const innerCls = isGpi ? GPI_INNER_CARD : INNER_PILL;
  const cardClass = compact
    ? METER_CARD_COMPACT
    : isGpi
      ? "gpi-meter-card"
      : METER_CARD_FULL;

  const summaryBlock = (
    <>
      <p
        className={`${
          compact
            ? "mt-6 text-[0.98rem] leading-[1.78] text-[#3d3a36] md:mt-7 md:text-[1.02rem]"
            : isGpi
              ? "gpi-summary-lead mt-0 text-[1.02rem] leading-[1.72] text-[#272727]"
              : "mt-7 text-[1.05rem] leading-[1.78] text-[#3d3a36] md:mt-8"
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
        className={`${
          compact
            ? "mt-6 border-t border-black/[0.08] pt-5 text-[0.95rem] leading-[1.78] text-[#6f6a63] md:mt-7 md:pt-5 md:text-[1.02rem]"
            : isGpi
              ? "gpi-weekly-signal mt-[22px] border-t border-[rgba(32,28,24,0.08)] pt-[22px] text-[0.96rem] leading-[1.72] text-[#6f6a63]"
              : "mt-7 border-t border-black/[0.08] pt-5 text-[1.05rem] leading-[1.78] text-[#6f6a63] md:mt-8 md:pt-6"
        }`}
      >
        <strong className="font-semibold text-[#4a4540]">
          This week&apos;s signal:
        </strong>{" "}
        {compact ? index.weeklyNoteCompact : index.weeklyNote}
      </p>
    </>
  );

  const methodPillsBlock = (
    <div
      className={`grid grid-cols-1 ${
        isGpi ? "gpi-method-grid mt-[22px] gap-3" : "gap-3"
      } ${
        compact ? "mt-6 sm:grid-cols-3 md:mt-8" : isGpi ? "" : "mt-6 md:mt-8"
      } ${!compact && !isGpi ? "min-[801px]:grid-cols-3" : !compact ? "min-[801px]:grid-cols-3" : ""}`}
    >
      {index.methodPills.map((pill) => (
        <div key={pill.label} className={innerCls}>
          <span className={labelCls}>{pill.label}</span>
          <p className="mt-[5px] text-[0.92rem] leading-[1.5] text-[#292724]">
            {pill.value}
          </p>
        </div>
      ))}
    </div>
  );

  const recentBlock = (
    <div className={isGpi ? "gpi-recent-zone" : ""}>
      <div
        className={
          isGpi
            ? "pt-0"
            : `border-t border-black/[0.08] pt-6 md:pt-7 ${
                compact ? "mt-7 md:mt-8" : "mt-8 md:mt-9"
              }`
        }
      >
        <h3 className={labelCls}>Recent Weekly Readings</h3>
        <div
          className={`mt-4 grid gap-3 ${
            compact
              ? "grid-cols-2 sm:grid-cols-4"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          }`}
        >
          {index.recentReadings.map((item) => (
            <div key={item.week} className={innerCls}>
              <p className={`${labelCls} gpi-inner-label`}>{item.week}</p>
              <p className="gpi-inner-score font-serif font-bold leading-none tracking-[-0.04em] text-[#2a2826]">
                <DegreeNumber value={item.degrees} />
              </p>
              <p className={`${labelCls} gpi-inner-label`}>{item.state}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const benchmarksBlock =
    variant === "full" && benchmarks.length > 0 ? (
      <div className={isGpi ? "gpi-benchmark-zone" : "mt-9 md:mt-11"}>
        <span className={`block ${labelCls}`}>Historical Benchmark Readings</span>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {benchmarks.map((bench) => (
            <div
              key={bench.name}
              className={`${innerCls} ${benchTierClass(bench.tier)}`}
            >
              <p className="gpi-benchmark-name font-serif font-bold leading-[1.28] text-[#171717]">
                {bench.name}
              </p>
              <p className="gpi-inner-score font-serif font-bold leading-none tracking-[-0.04em] text-[#2a2826]">
                <DegreeNumber value={bench.score} />
              </p>
              <p className={`${labelCls} gpi-inner-label`}>{bench.note}</p>
            </div>
          ))}
        </div>
        {isGpi ? (
          <div className="gpi-continuation">
            <p>
              The reading sits in a persistent elevated pressure band —
              structurally high but below disorder-level benchmarks. Market
              resilience continues, but growing physical constraints in power,
              transmission, cooling, and deployment capacity increasingly define
              how quickly expansion proceeds. The watchlist below tracks where
              coordination strain may broaden next.
            </p>
          </div>
        ) : null}
      </div>
    ) : null;

  if (isGpi) {
    return (
      <article className={cardClass}>
        <div className="gpi-score-zone">
          <MainReadingRow index={index} compact={compact} />
        </div>
        <div className="gpi-scale-zone">
          <IndexScaleBar index={index} compact={compact} />
        </div>
        <div className="gpi-summary-zone">{summaryBlock}</div>
        {methodPillsBlock}
        {recentBlock}
        {benchmarksBlock}
      </article>
    );
  }

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
        className={`border-t border-black/[0.08] leading-[1.78] text-[#6f6a63] ${
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
          <div key={pill.label} className={innerCls}>
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
            <div key={item.week} className={innerCls}>
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
              <div key={bench.name} className={innerCls}>
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

export default function LedgerIndexMeter({
  index,
  variant = "full",
  className = "",
}: LedgerIndexMeterProps) {
  const isFull = variant === "full";
  const isGpi = index.id === "global-pressure";
  const headingId = `ledger-index-${index.id}-title`;
  const kickerClass = isGpi ? GPI_LABEL : LABEL;

  const shellWidth = isGpi && isFull ? GPI_CONTENT_WIDTH : CONTENT_WIDTH;

  return (
    <section
      className={`${shellWidth} text-[#171717] ${className}`}
      aria-labelledby={headingId}
    >
      {isFull ? (
        isGpi ? (
          <>
            <span className="ledger-index-kicker">{index.kicker}</span>
            <h1 id={headingId} className="ledger-index-title">
              {index.displayTitle}
            </h1>
            <p className="ledger-index-intro">{index.intro}</p>
            <p className="ledger-index-updated">
              <em>{index.updatedLabel}</em>
            </p>
            <div className="gpi-meter-hero-wrap">
              <MeterCard index={index} variant="full" />
            </div>
          </>
        ) : (
          <>
            <span className={kickerClass}>{index.kicker}</span>
            <h1
              id={headingId}
              className="mt-2 font-serif text-[clamp(2.6rem,5vw,4.4rem)] font-normal leading-[1.02] tracking-[-0.045em]"
            >
              {index.displayTitle}
            </h1>
            <p className="mt-6 max-w-[680px] font-serif text-[1.05rem] leading-[1.78] text-[#2c2a27]">
              {index.intro}
            </p>
            <p className="mt-4 text-[0.95rem] italic text-[#6f6a63]">
              {index.updatedLabel}
            </p>
            <div className="mt-10 md:mt-14">
              <MeterCard index={index} variant="full" />
            </div>
          </>
        )
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
          <p className="mt-5 text-[0.95rem] italic text-[#6f6a63]">
            {index.updatedLabel}
          </p>
        </>
      )}
    </section>
  );
}



