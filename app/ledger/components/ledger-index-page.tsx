import type { LedgerIndexDefinition } from "../ledger-data";
import {
  GPI_CALCULATION_ROWS,
  GPI_CALCULATION_TOTAL,
  GPI_METHODOLOGY_PRINCIPLES,
  GPI_RECALIBRATION_DATE,
} from "../global-pressure-index-data";
import "../global-pressure-index.css";
import LedgerIndexBreadcrumb from "./ledger-index-breadcrumb";
import { LEDGER_INDEX_PAGE_CLASS } from "./ledger-index-page-chrome";
import LedgerIndexMeter from "./ledger-index-meter";

const LABEL =
  "font-sans text-[10px] uppercase tracking-[0.16em] text-[#6f6a63]";

type LedgerIndexPageContentProps = {
  index: LedgerIndexDefinition;
};

function DefaultWatchingSection({ index }: { index: LedgerIndexDefinition }) {
  const blocks = index.editorialBlocks ?? [];
  if (blocks.length === 0) return null;

  return (
    <div className="mx-auto mt-14 max-w-[920px] md:mt-16">
      <p className={LABEL}>What we are watching</p>
      <ul className="mt-6 space-y-8">
        {blocks.map((block) => (
          <li
            key={block.title}
            className="border-b border-[#e4dbcf] pb-8 last:border-0 last:pb-0"
          >
            <h2 className="font-serif text-[1.12rem] font-normal tracking-[-0.02em] text-[#1f1d1a] md:text-[1.2rem]">
              {block.title}
            </h2>
            <p className="mt-3 max-w-[40rem] text-[0.95rem] leading-[1.85] text-[#5c554d]">
              {block.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GpiWatchingSection({ index }: { index: LedgerIndexDefinition }) {
  const blocks = index.editorialBlocks ?? [];
  if (blocks.length === 0) return null;

  return (
    <div className="gpi-watching">
      <h2 className="gpi-watching-title">
        {index.watchingSectionTitle ?? "What We're Watching"}
      </h2>
      <div className="gpi-watching-grid">
        {blocks.map((block) => (
          <article key={block.title} className="gpi-watching-card">
            <h3>{block.title}</h3>
            <p>{block.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function GpiMethodologySection() {
  return (
    <div className="gpi-methodology" id="gpi-methodology">
      <h2 className="gpi-methodology-title">Methodology</h2>
      <p className="gpi-methodology-lead">
        Scoring principles for the recalibrated series beginning{" "}
        {GPI_RECALIBRATION_DATE}. The public temperature is the weighted sum of
        the six category scores below, rounded to the nearest degree.
      </p>

      <div className="gpi-methodology-principles">
        {GPI_METHODOLOGY_PRINCIPLES.map((principle) => (
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
            {GPI_CALCULATION_ROWS.map((row) => (
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
              <td className="gpi-nowrap">{GPI_CALCULATION_TOTAL.contribution}</td>
              <td>{GPI_CALCULATION_TOTAL.reason}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="gpi-methodology-footnote">
        Historical readings published before {GPI_RECALIBRATION_DATE} remain
        visible as originally issued and are not rewritten under the
        recalibrated rules. See the methodology recalibration note on the
        current reading card.
      </p>
    </div>
  );
}

export function LedgerIndexPageContent({ index }: LedgerIndexPageContentProps) {
  const isGpi = index.id === "global-pressure";

  return (
    <section
      className={`ledger-index-page ${isGpi ? "ledger-gpi" : ""} ${LEDGER_INDEX_PAGE_CLASS}`}
    >
      <LedgerIndexBreadcrumb current={index.displayTitle} />

      <LedgerIndexMeter index={index} variant="full" />

      {isGpi ? (
        <>
          <GpiWatchingSection index={index} />
          <GpiMethodologySection />
        </>
      ) : (
        <DefaultWatchingSection index={index} />
      )}
    </section>
  );
}
