import type { LedgerIndexDefinition } from "../ledger-data";
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
    <div className="gpi-watching mx-auto max-w-[920px]">
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

export function LedgerIndexPageContent({ index }: LedgerIndexPageContentProps) {
  const isGpi = index.id === "global-pressure";

  return (
    <section
      className={`ledger-index-page ${isGpi ? "ledger-gpi" : ""} ${LEDGER_INDEX_PAGE_CLASS}`}
    >
      <LedgerIndexBreadcrumb current={index.displayTitle} />

      <LedgerIndexMeter index={index} variant="full" />

      {isGpi ? (
        <GpiWatchingSection index={index} />
      ) : (
        <DefaultWatchingSection index={index} />
      )}
    </section>
  );
}

