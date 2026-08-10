import Image from "next/image";
import type { ArticleBlock } from "./articles";
import { renderInlineContent } from "./inline-content";

const MM_CHART_MAX = 11;
const CIRCLE_MAX_PX = { base: 46, md: 62 } as const;

/** Vertical rhythm for visual inserts within article prose */
const FIGURE_SPACE = "my-11 md:my-[3.25rem]";

const FIGURE_HEADER =
  "mb-6 border-b border-[#e4dbcf]/35 pb-[1.125rem] md:mb-7 md:pb-5";

const SHELL_RADIUS = "rounded-[24px]";

const eyebrowClass =
  "text-[9px] font-normal uppercase tracking-[0.38em] text-[#6d655e]";

const noteClass =
  "mt-5 max-w-[38rem] text-[0.86rem] leading-[1.74] text-[#8f867c]";

const bodyCopyClass = "text-[0.94rem] leading-[1.72] text-[#635d56]";

const plateClass = `overflow-hidden ${SHELL_RADIUS} border border-[#e0d8cc]/85 bg-gradient-to-b from-[#faf6f0] to-[#f3ede5] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]`;

const tableShellClass = `overflow-hidden ${SHELL_RADIUS} border border-[#e0d8cc]/75 bg-[#fcfaf6]/90`;

const tableInset = "px-6 md:px-8";

const thClass = `${tableInset} py-5 text-left text-[9px] font-normal uppercase tracking-[0.36em] text-[#a39a8e]`;

const rowDivider = "border-b border-[#ebe4da]/35 last:border-b-0";

const serifLabelClass =
  "font-serif text-[1.13rem] font-normal leading-snug tracking-[-0.025em] text-[#1c1b1a] md:text-[1.17rem]";

function parseMm(mmLabel: string): number {
  const n = parseFloat(mmLabel.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Gentle easing so diameter progression reads smoothly, not mechanically linear */
function circleDiameterPx(mm: number, variant: "base" | "md"): number {
  const max = variant === "md" ? CIRCLE_MAX_PX.md : CIRCLE_MAX_PX.base;
  const t = mm / MM_CHART_MAX;
  const eased = Math.pow(t, 0.93);
  return Math.max(11, eased * max);
}

function FigureEyebrow({ children }: { children: string }) {
  return <p className={eyebrowClass}>{children}</p>;
}

function ReferenceNote({ children }: { children: string }) {
  return <p className={noteClass}>{children}</p>;
}

const circleSurfaceClass =
  "rounded-full border border-[#d5cdc2]/70 bg-[radial-gradient(circle_at_34%_30%,#fbf8f4_0%,#ebe3d8_52%,#ddd4c8_100%)] shadow-[inset_0_1px_1px_rgba(255,255,255,0.5)]";

function CaratScalePlate({ rows }: { rows: { carat: string; mm: string }[] }) {
  const labelBlockHeight = 36;

  return (
    <div
      className={`${plateClass} px-5 py-8 sm:px-7 sm:py-9 md:px-10 md:py-10`}
    >
      {/* Desktop: single row with shared baseline */}
      <div className="hidden md:block">
        <div className="relative mx-auto max-w-[700px] px-2">
          <div
            className="grid items-end gap-3 lg:gap-4"
            style={{
              gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))`,
            }}
          >
            {rows.map((row) => {
              const mm = parseMm(row.mm);
              const d = circleDiameterPx(mm, "md");
              return (
                <div
                  key={row.carat}
                  className="flex min-w-0 flex-col items-center px-0.5"
                >
                  <div
                    className="flex w-full items-end justify-center"
                    style={{ height: CIRCLE_MAX_PX.md + 6 }}
                  >
                    <div
                      className={circleSurfaceClass}
                      style={{ width: d, height: d }}
                    />
                  </div>
                  <p className="mt-4 w-full truncate text-center text-[0.7rem] font-medium tracking-[0.03em] text-[#625c55] tabular-nums">
                    {row.carat.replace(" ct", "")}
                  </p>
                  <p className="mt-1 text-center text-[0.64rem] tracking-[0.05em] text-[#6d655e] tabular-nums">
                    {row.mm}
                  </p>
                </div>
              );
            })}
          </div>
          <div
            className="pointer-events-none absolute inset-x-5 border-t border-[#d8cfc3]/38"
            style={{ bottom: labelBlockHeight }}
            aria-hidden
          />
        </div>
      </div>

      {/* Mobile & tablet: 4×2 grid */}
      <div className="grid grid-cols-4 gap-x-3 gap-y-8 px-0.5 md:hidden">
        {rows.map((row) => {
          const mm = parseMm(row.mm);
          const d = circleDiameterPx(mm, "base");
          return (
            <div key={row.carat} className="flex min-w-0 flex-col items-center">
              <div
                className="flex w-full items-end justify-center"
                style={{ height: CIRCLE_MAX_PX.base + 4 }}
              >
                <div
                  className={circleSurfaceClass}
                  style={{ width: d, height: d }}
                />
              </div>
              <p className="mt-3.5 w-full text-center text-[0.63rem] font-medium leading-tight tracking-[0.02em] text-[#625c55] tabular-nums">
                {row.carat.replace(" ct", "")}
              </p>
              <p className="mt-1 text-center text-[0.59rem] leading-tight tracking-[0.04em] text-[#6d655e] tabular-nums">
                {row.mm}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReferenceTable({
  columns,
  rows,
  labelKey,
  valueKey,
  serifLabels = false,
}: {
  columns: [string, string];
  rows: Record<string, string>[];
  labelKey: string;
  valueKey: string;
  serifLabels?: boolean;
}) {
  const labelCell = serifLabels
    ? serifLabelClass
    : "font-light tabular-nums tracking-[0.01em] text-[#1f1d1a]";

  return (
    <>
      <dl
        className={`${tableShellClass} divide-y divide-[#ebe4da]/35 md:hidden`}
      >
        {rows.map((row) => (
          <div key={row[labelKey]} className={`${tableInset} py-[1.35rem]`}>
            <dt className={labelCell}>{row[labelKey]}</dt>
            <dd className={`mt-3.5 ${bodyCopyClass}`}>{row[valueKey]}</dd>
          </div>
        ))}
      </dl>

      <div className={`${tableShellClass} hidden md:block`}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-[#ebe4da]/40">
              <th scope="col" className={thClass}>
                {columns[0]}
              </th>
              <th scope="col" className={thClass}>
                {columns[1]}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[labelKey]} className={rowDivider}>
                <td className={`${tableInset} py-5 ${labelCell}`}>
                  {row[labelKey]}
                </td>
                <td className={`${tableInset} py-5 ${bodyCopyClass}`}>
                  {row[valueKey]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function CaratMmReference({
  rows,
  note,
}: Extract<ArticleBlock, { type: "carat-mm-reference" }>) {
  return (
    <figure className={FIGURE_SPACE}>
      <header className={FIGURE_HEADER}>
        <FigureEyebrow>Round Brilliant · Face-Up Diameter</FigureEyebrow>
      </header>

      <CaratScalePlate rows={rows} />

      <div className="mt-6 md:mt-7">
        <ReferenceTable
          columns={["Carat", "Approx. diameter"]}
          rows={rows}
          labelKey="carat"
          valueKey="mm"
        />
      </div>

      {note ? <ReferenceNote>{note}</ReferenceNote> : null}
    </figure>
  );
}

export function PerceivedSizeRanking({
  tiers,
  note,
}: Extract<ArticleBlock, { type: "perceived-size-ranking" }>) {
  return (
    <figure className={FIGURE_SPACE}>
      <header className={FIGURE_HEADER}>
        <FigureEyebrow>Perceived Size · General Tendencies</FigureEyebrow>
      </header>

      <ol
        className={`${tableShellClass} divide-y divide-[#ebe4da]/35 bg-gradient-to-b from-[#fcfaf6] to-[#f7f3ec]`}
      >
        {tiers.map((tier) => (
          <li
            key={tier.tier}
            className={`grid gap-3 ${tableInset} py-[1.35rem] md:grid-cols-[minmax(12rem,14rem)_1fr] md:gap-11 md:py-6`}
          >
            <p className={serifLabelClass}>{tier.tier}</p>
            <p className={`${bodyCopyClass} md:pt-0.5`}>{tier.shapes}</p>
          </li>
        ))}
      </ol>

      {note ? <ReferenceNote>{note}</ReferenceNote> : null}
    </figure>
  );
}

export function ReferenceFactorList({
  factors,
  note,
}: Extract<ArticleBlock, { type: "reference-factor-list" }>) {
  return (
    <figure className="my-8 md:my-9">
      <ul
        className={`${tableShellClass} divide-y divide-[#ebe4da]/35`}
      >
        {factors.map((factor) => (
          <li
            key={factor}
            className={`flex gap-4 ${tableInset} py-[1.2rem] md:py-5`}
          >
            <span
              className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-[#c4bab0]"
              aria-hidden
            />
            <p className={`${bodyCopyClass} min-w-0 flex-1`}>{factor}</p>
          </li>
        ))}
      </ul>
      {note ? <ReferenceNote>{note}</ReferenceNote> : null}
    </figure>
  );
}

export function ShapeSpreadTable({
  eyebrow,
  rows,
  note,
}: Extract<ArticleBlock, { type: "shape-spread-table" }>) {
  return (
    <figure className={FIGURE_SPACE}>
      <header className={FIGURE_HEADER}>
        <FigureEyebrow>
          {eyebrow ?? "Same Carat · Different Face-Up Character"}
        </FigureEyebrow>
      </header>

      <ReferenceTable
        columns={["Shape", "Typical spread"]}
        rows={rows}
        labelKey="shape"
        valueKey="spread"
        serifLabels
      />

      {note ? <ReferenceNote>{note}</ReferenceNote> : null}
    </figure>
  );
}

export function FingerCoverageScale({
  zones,
  note,
}: Extract<ArticleBlock, { type: "finger-coverage-scale" }>) {
  return (
    <figure className={FIGURE_SPACE}>
      <header className={FIGURE_HEADER}>
        <FigureEyebrow>Presence on the Hand</FigureEyebrow>
      </header>

      <ol
        className={`${tableShellClass} divide-y divide-[#ebe4da]/35 bg-gradient-to-b from-[#fcfaf6] to-[#f7f3ec]`}
      >
        {zones.map((zone) => (
          <li
            key={zone.label}
            className={`grid gap-3 ${tableInset} py-[1.35rem] md:grid-cols-[minmax(12.5rem,14.75rem)_1fr] md:gap-11 md:py-6`}
          >
            <p className={serifLabelClass}>{zone.label}</p>
            <p className={`${bodyCopyClass} md:pt-0.5`}>{zone.description}</p>
          </li>
        ))}
      </ol>

      {note ? <ReferenceNote>{note}</ReferenceNote> : null}
    </figure>
  );
}

export function ArticleEditorialImage({
  src,
  alt,
}: Extract<ArticleBlock, { type: "editorial-image" }>) {
  return (
    <figure className={FIGURE_SPACE}>
      <div
        className={`overflow-hidden ${SHELL_RADIUS} border border-[#e0d8cc]/85 bg-[#faf6f0] shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]`}
      >
        <Image
          src={src}
          alt={alt}
          width={1024}
          height={1535}
          sizes="(max-width: 768px) 100vw, 672px"
          className="h-auto w-full"
        />
      </div>
    </figure>
  );
}

export function StudioCallout({
  heading,
  text,
  articleSlug,
}: Extract<ArticleBlock, { type: "studio-callout" }> & {
  articleSlug?: string;
}) {
  return (
    <aside
      className={`${FIGURE_SPACE} ${SHELL_RADIUS} border border-[#ddd5c8]/90 bg-[#faf7f3] px-6 py-7 shadow-[0_12px_44px_-30px_rgba(31,29,26,0.14),inset_0_1px_0_rgba(255,255,255,0.82)] sm:px-8 sm:py-8 md:px-9 md:py-9`}
    >
      <div className="mx-auto max-w-[34rem] border-l border-[#d4cbc0]/70 pl-5 sm:pl-6">
        <p className={eyebrowClass}>On the hand</p>
        <h3 className="mt-2.5 font-serif text-[1.22rem] font-normal leading-[1.28] tracking-[-0.02em] text-[#1f1d1a] md:text-[1.32rem]">
          {heading}
        </h3>
        <p className={`mt-4 ${bodyCopyClass}`}>
          {renderInlineContent(text, { articleSlug })}
        </p>
      </div>
    </aside>
  );
}
