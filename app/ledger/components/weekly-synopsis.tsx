export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline:
    "October evidence confirms 74° as counterbuffers hold.",
  blocks: [
    {
      title: "What changed",
      body: "Evidence reviewed through October 1, 2026. East-West Pipeline operations and Yanbu loadings resumed, cooling the outage-specific risk, while inventory depletion, limited effective spare production, weak refined-product inventories, and constrained routing keep energy buffers Low. The Fed hike was realized and the 10-year remained elevated. Observed credit spreads stayed contained, lagged financial stress stayed below normal, funding remained orderly, and provisional labor evidence remained functional. System Temperature is 74°, High, Systems Functioning, Confidence Moderate — 0° from the September 16 reading of 74°.",
    },
    {
      title: "Why temperature held",
      body: "All five assignments hold: Geopolitics / energy / supply Severe / Broad; Financial & economic transmission Very-high / Partial; Physical infrastructure High / Partial; Commodities / materials Elevated / Contained; Technology / AI High / Partial. Low energy slack and elevated yields prevent cooling. Restored Yanbu flows, contained spreads and stress, functional labor, expired Carolinas grid interventions, mixed food buffers, and no new AI transmission prevent escalation.",
    },
    {
      title: "What to watch next",
      body: "Whether observed East-West Pipeline / Yanbu restoration persists and inventories rebuild; whether contained credit spreads and below-normal stress survive elevated yields; whether Carolinas-style grid interventions recur outside exceptional weather; whether fertilizer or corridor pressure becomes verified food shortage; and whether AI containment or deployment produces a new external-transmission step.",
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
