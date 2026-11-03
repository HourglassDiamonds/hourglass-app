export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline:
    "Pressure persists while adaptation keeps the system functioning.",
  blocks: [
    {
      title: "What changed",
      body: "Evidence reviewed through November 3, 2026. September oil flows recovered: the IEA measured Hormuz flows at 10.9 million barrels a day and bypass exports at 5.6 million, while EIA confirmed the East-West Pipeline restart. That cooling is incomplete: refined-product supply and inventories remain strained, Brent was still about $103 on November 3, and renewed U.S. strikes left the diplomatic path unresolved. The Fed held at 3.75–4.00%; the November 2 Treasury curve put the 10-year at 4.91%, while high-yield spreads remained contained at 3.44% on October 30. System Temperature remains 74°, High, Systems Functioning, Confidence Moderate — unchanged from October 29.",
    },
    {
      title: "Why temperature held",
      body: "The governed weighted result remains 73.7°, rounded to 74°. Oil, product scarcity, long yields, inflation, Colorado River protection operations, and AI security constraints prevent cooling. Recovered Gulf flows, the Fed hold, a sub-5% 10-year, contained credit spreads, functioning labor and funding, active grid adaptation, and explicit AI controls prevent escalation. Information Signal affects confidence only and adds no heat.",
    },
    {
      title: "What to watch next",
      body: "Whether mediation produces durable Gulf transit normalization; whether crude recovery rebuilds diesel and refined-product inventories; whether long yields and inflation broaden into credit stress; whether PJM emergency tools remain bounded; whether Powell's protection range can hold without deeper upstream transfer; and whether frontier-model containment keeps pace with wider agentic deployment.",
    },
  ],
} as const;

type WeeklySynopsisProps = {
  className?: string;
};

export default function WeeklySynopsis({ className = "" }: WeeklySynopsisProps) {
  const { eyebrow, headline, blocks } = WEEKLY_SYNOPSIS;

  return (
    <section
      className={`border-t border-[#e4dbcf] pt-14 md:pt-16 ${className}`}
      aria-labelledby="weekly-synopsis-heading"
    >
      <div className="mx-auto max-w-[880px]">
        <p className="text-center font-sans text-[10px] uppercase tracking-[0.32em] text-[#6d655e] md:text-left">
          {eyebrow}
        </p>
        <h2
          id="weekly-synopsis-heading"
          className="mx-auto mt-4 max-w-[28ch] text-center font-serif text-[1.45rem] font-normal leading-[1.18] tracking-[-0.02em] text-[#1f1d1a] md:mx-0 md:max-w-[24ch] md:text-left md:text-[1.65rem]"
          style={{ textWrap: "balance" }}
        >
          {headline}
        </h2>
      </div>

      <div className="mt-10 grid gap-0 md:mt-12 md:grid-cols-3 md:gap-0">
        {blocks.map((block, index) => (
          <article
            key={block.title}
            className={`border-[#e4dbcf] px-0 py-8 first:pt-0 md:px-8 md:py-0 ${
              index === 0 ? "md:pl-0" : "border-t md:border-t-0 md:border-l"
            } ${index === blocks.length - 1 ? "md:pr-0" : ""}`}
          >
            <h3 className="font-sans text-[10px] uppercase tracking-[0.22em] text-[#6d655e]">
              {block.title}
            </h3>
            <p className="mt-4 max-w-[22rem] text-[0.95rem] leading-[1.85] text-[#5c554d] md:max-w-none">
              {block.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
