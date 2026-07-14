export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline: "Corridor relief retraced; oil risk premium returns.",
  blocks: [
    {
      title: "What changed",
      body: "Hormuz transit relapsed after vessel attacks and the fraying of the June ceasefire framework, reversing the fragile recovery narrative. Oil's risk premium returned toward the mid-to-high $80s on Brent. The U.S. announced plans for a proposed 20% fee on Hormuz cargo and scheduled the reimposition of a naval blockade against Iranian shipping — measures described as announced, proposed, or scheduled for enforcement, not as settled corridor control. Official June CPI printed temporary energy-led disinflation (headline −0.4% m/m, 3.5% y/y; core 0.0% m/m, 2.6% y/y) that predates this week's oil move. PJM issued a Hot Weather Alert for July 14–17 after managing a record early-July peak. Precious materials and AI capability readings held.",
    },
    {
      title: "What's driving pressure",
      body: "Corridor confidence, not a single day's open or closed claim, is the binding geopolitical-energy channel. Oil's rebound reintroduces forward inflation and rate risk even though June CPI showed temporary relief. Financial conditions stay rate-sensitive. Summer grid tightness remains elevated but secondary to the corridor reverse this week.",
    },
    {
      title: "What to watch next",
      body: "Whether Hormuz traceable traffic stabilizes above recent lows or stays depressed. Whether Brent holds a renewed premium or fades. Whether announced blockade and fee measures become practical enforcement. Whether June's CPI disinflation is overshadowed in markets by the new energy shock. Whether PJM reliability holds through the July 14–17 Hot Weather Alert. Whether the EU's July 15 oil-price-cap decision freezes the cap or allows an automatic reset — a secondary sanctions watch.",
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
        <p className="text-center font-sans text-[10px] uppercase tracking-[0.32em] text-[#8a8176] md:text-left">
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
            <h3 className="font-sans text-[10px] uppercase tracking-[0.22em] text-[#8a8176]">
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
