/**
 * ARCHIVED — Global Pressure Index numerical meter (disabled from public render).
 *
 * This preserves the prior degree-gauge, recent-reading cards, historical
 * benchmarks, and related numerical UI so the revised model can reuse it.
 * Do not import this component from public Ledger routes until the rebuilt
 * methodology is historically tested and documented.
 *
 * Public surface: `../global-pressure-monitor.tsx`
 */

import Link from "next/link";
import type { BenchmarkTier, LedgerIndexDefinition } from "../../ledger-data";
import "../../global-pressure-index.css";

const GPI_LABEL =
  "gpi-label ledger-index-label font-sans text-[11px] uppercase tracking-[0.13em]";
const SCALE_LABEL =
  "font-sans text-[10px] uppercase tracking-[0.08em] text-[#6f6a63]";
const INNER_PILL =
  "rounded-[14px] border border-black/[0.08] bg-[#f7f2e8] p-[13px]";
const GPI_INNER_CARD = "ledger-index-inner-card";
const CONTENT_WIDTH = "mx-auto w-full max-w-[920px]";
const GPI_CONTENT_WIDTH = "w-full";
const LABEL =
  "font-sans text-[10px] uppercase tracking-[0.16em] text-[#6f6a63]";

type ArchivedGlobalPressureNumericalMeterProps = {
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
  const clamped = Math.min(100, Math.max(0, index.reading));
  const markerLeft = `${clamped}%`;
  const wrapClass = compact ? "mb-4 mt-7 md:mb-5 md:mt-9" : "mb-0 mt-0";

  return (
    <div className={wrapClass}>
      <div className={compact ? "relative h-[14px] overflow-visible rounded-full" : "gpi-scale-track"}>
        <div
          className={
            compact
              ? "h-full w-full rounded-full shadow-[inset_0_1px_2px_rgba(255,255,255,0.55),inset_0_-1px_2px_rgba(0,0,0,0.12)]"
              : "gpi-scale-fill"
          }
          style={{ background: index.scaleGradient }}
          aria-hidden
        />
        <div
          className={
            compact
              ? "absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#2a2826] bg-[#faf8f5] shadow-[0_2px_8px_rgba(0,0,0,0.12)]"
              : "gpi-marker"
          }
          style={{ left: markerLeft }}
          aria-hidden
        />
      </div>
      <div
        className={`mt-3 flex justify-between gap-1 ${compact ? SCALE_LABEL : GPI_LABEL}`}
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
  const isFull = !compact;
  const labelCls = isFull ? GPI_LABEL : LABEL;
  const degreeClass = compact
    ? "font-serif text-[clamp(3.2rem,8vw,4.65rem)] font-bold leading-[0.88] tracking-[-0.07em] text-[#2a2826]"
    : "gpi-main-degree font-serif text-[clamp(4rem,10vw,6.2rem)] font-bold leading-[0.88] tracking-[-0.07em] text-[#2a2826]";

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
    <div className={`${rowClass} ${isFull ? "" : "pb-4 md:pb-5"}`}>
      <div className="min-w-0 pt-0.5">
        <p className={degreeClass}>
          <DegreeNumber value={index.reading} />
        </p>
        <p className={`mt-2 ${labelCls}`}>{index.readingLabel}</p>
      </div>
      <div className={deltaWrapClass}>
        <span className="ledger-index-delta gpi-delta-reset max-w-full whitespace-normal text-left leading-[1.45] tracking-[0.1em] sm:text-right">
          {deltaLabel}
        </span>
        <p className={`gpi-delta-note mt-[9px] ${labelCls}`}>{index.status}</p>
        {index.weeklyDeltaExplanation ? (
          <p
            className="gpi-delta-explanation mt-2.5 max-w-none text-left text-[0.8rem] leading-[1.55] normal-case tracking-normal text-[#6f6a63] sm:max-w-[18rem] sm:text-right"
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
  const isFull = variant === "full";
  const benchmarks = index.benchmarks ?? [];
  const labelCls = isFull ? GPI_LABEL : LABEL;
  const innerCls = isFull ? GPI_INNER_CARD : INNER_PILL;
  const cardClass = compact
    ? "rounded-[20px] border border-black/[0.08] bg-[#faf6ef] px-7 py-8 shadow-[0_16px_40px_rgba(28,22,16,0.055),0_2px_10px_rgba(28,22,16,0.03)] sm:px-8 sm:py-9"
    : "gpi-meter-card";

  const summaryBlock = (
    <>
      <p
        className={
          compact
            ? "mt-6 text-[0.98rem] leading-[1.78] text-[#3d3a36] md:mt-7 md:text-[1.02rem]"
            : "gpi-summary-lead mt-0 text-[1.02rem] leading-[1.72] text-[#272727]"
        }
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
        className={
          compact
            ? "mt-6 border-t border-black/[0.08] pt-5 text-[0.95rem] leading-[1.78] text-[#6f6a63] md:mt-7 md:pt-5 md:text-[1.02rem]"
            : "gpi-weekly-signal mt-[22px] border-t border-[rgba(32,28,24,0.08)] pt-[22px] text-[0.96rem] leading-[1.72] text-[#6f6a63]"
        }
      >
        <strong className="font-semibold text-[#4a4540]">
          This week&apos;s signal:
        </strong>{" "}
        {compact ? index.weeklyNoteCompact : index.weeklyNote}
      </p>
      {!compact && index.calibrationNote ? (
        <aside
          className="gpi-calibration-note"
          aria-label={index.calibrationNote.title}
        >
          <p className="gpi-calibration-title">{index.calibrationNote.title}</p>
          <p className="gpi-calibration-body">{index.calibrationNote.body}</p>
          {index.methodologyReference ? (
            <p className="gpi-calibration-ref">
              <a href="#gpi-methodology">{index.methodologyReference}</a>
            </p>
          ) : null}
        </aside>
      ) : null}
    </>
  );

  const methodPillCols =
    isFull && index.methodPills.length > 3
      ? "min-[801px]:grid-cols-2"
      : "min-[801px]:grid-cols-3";

  const methodPillsBlock = (
    <div
      className={`grid grid-cols-1 ${
        isFull ? "gpi-method-grid mt-[22px] gap-3" : "gap-3"
      } ${
        compact ? "mt-6 sm:grid-cols-3 md:mt-8" : ""
      } ${!compact ? methodPillCols : ""}`}
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
    <div className={isFull ? "gpi-recent-zone" : ""}>
      <div
        className={
          isFull
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
            <div
              key={item.week}
              className={`${innerCls}${item.annotation ? " gpi-reading-recalibrated" : ""}`}
            >
              <p className={`${labelCls} gpi-inner-label`}>{item.week}</p>
              <p className="gpi-inner-score font-serif font-bold leading-none tracking-[-0.04em] text-[#2a2826]">
                <DegreeNumber value={item.degrees} />
              </p>
              <p className={`${labelCls} gpi-inner-label`}>{item.state}</p>
              {item.annotation ? (
                <p className="gpi-reading-annotation">{item.annotation}</p>
              ) : null}
            </div>
          ))}
        </div>
        {isFull && index.seriesAnnotation ? (
          <p className="gpi-series-annotation" role="note">
            {index.seriesAnnotation}
          </p>
        ) : null}
      </div>
    </div>
  );

  const benchmarksBlock =
    variant === "full" && benchmarks.length > 0 ? (
      <div className="gpi-benchmark-zone">
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
        <div className="gpi-continuation">
          <p>
            The reading sits in a high-heat band with concentrated pressure —
            geopolitics and energy near extremes, while credit markets and
            economic expansion still offset full systemic transmission. It
            remains below collapse-era benchmarks such as 2008 and March 2020.
            Direction is high and unstable; the watchlist below tracks whether
            corridor and energy stress begin confirming into credit, supply
            chains, or electricity systems.
          </p>
        </div>
      </div>
    ) : null;

  if (isFull) {
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
      {summaryBlock}
      {methodPillsBlock}
      {recentBlock}
    </article>
  );
}

/**
 * Disabled numerical GPI meter. Intentionally not used by public pages.
 * Kept for methodology rebuild / historical comparison work.
 */
export default function ArchivedGlobalPressureNumericalMeter({
  index,
  variant = "full",
  className = "",
}: ArchivedGlobalPressureNumericalMeterProps) {
  const isFull = variant === "full";
  const headingId = "archived-gpi-numerical-title";
  const shellWidth = isFull ? GPI_CONTENT_WIDTH : CONTENT_WIDTH;

  return (
    <section
      className={`ledger-gpi ${shellWidth} text-[#171717] ${className}`}
      aria-labelledby={headingId}
      data-archived-numerical-gpi="true"
    >
      {isFull ? (
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

/** Weighted-score calculation table — archived with the numerical meter. */
export function ArchivedGpiMethodologySection({
  calculationRows,
  calculationTotal,
  methodologyPrinciples,
  recalibrationDate,
}: {
  calculationRows: readonly {
    category: string;
    weight: string;
    score: string;
    contribution: string;
    reason: string;
  }[];
  calculationTotal: { contribution: string; reason: string };
  methodologyPrinciples: readonly { title: string; body: string }[];
  recalibrationDate: string;
}) {
  return (
    <div className="gpi-methodology ledger-gpi" id="gpi-methodology">
      <h2 className="gpi-methodology-title">Methodology</h2>
      <p className="gpi-methodology-lead">
        Scoring principles for the recalibrated series beginning{" "}
        {recalibrationDate}. The public temperature is the weighted sum of the
        six category scores below, rounded to the nearest degree.
      </p>

      <div className="gpi-methodology-principles">
        {methodologyPrinciples.map((principle) => (
          <article key={principle.title} className="gpi-methodology-card">
            <h3>{principle.title}</h3>
            <p>{principle.body}</p>
          </article>
        ))}
      </div>

      <h3 className="gpi-calc-title">How the Index Is Calculated</h3>
      <div className="gpi-table-wrap">
        <table className="gpi-table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Weight</th>
              <th scope="col">Score</th>
              <th scope="col">Contribution</th>
              <th scope="col">Reason</th>
            </tr>
          </thead>
          <tbody>
            {calculationRows.map((row) => (
              <tr key={row.category}>
                <td>{row.category}</td>
                <td className="gpi-nowrap">{row.weight}</td>
                <td className="gpi-nowrap">{row.score}</td>
                <td className="gpi-nowrap">{row.contribution}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
            <tr className="gpi-table-total">
              <td>
                <strong>Total</strong>
              </td>
              <td className="gpi-nowrap">100%</td>
              <td className="gpi-nowrap">Weight</td>
              <td className="gpi-nowrap">{calculationTotal.contribution}</td>
              <td>{calculationTotal.reason}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="gpi-methodology-footnote">
        Historical readings published before {recalibrationDate} remain visible
        as originally issued and are not rewritten under the recalibrated rules.
        See the methodology recalibration note on the current reading card.
      </p>
    </div>
  );
}
