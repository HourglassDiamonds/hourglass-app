export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline: "Corridor pressure holds; frontier access broadens.",
  blocks: [
    {
      title: "What changed",
      body: "Global geopolitical pressure remained at an extremely elevated 93. The corridor conflict became more operational — the U.S. naval blockade on Iranian ports was reimposed on July 14 within a campaign that began earlier in 2026, CENTCOM continued strikes framed around maritime security, commercial vessels were attacked near Oman with crews evacuated, and traceable Hormuz and LNG traffic stayed sharply reduced. Brent briefly tested above $90 before settling in the high $80s. A Houthi maritime-embargo declaration entered as a secondary corridor risk without demonstrated sustained enforcement. AI capability rose to 85 as frontier performance, practical access, cost compression, international competition, and adoption broadened together through GPT-5.6 general availability and Kimi K3 product and API access. Precious materials, infrastructure strain, and information clarity held within their established regimes.",
    },
    {
      title: "What's driving pressure",
      body: "Corridor confidence and the energy premium remain the binding geopolitical channel, but this week largely confirmed the risk already incorporated in the July 14 increase rather than establishing a distinctly broader systemic regime. Markets remained functional; diplomatic and ceasefire efforts stay an offsetting consideration. On the AI side, broader frontier access and competitive diffusion moved the acceleration reading, while compute, electricity, and deployment infrastructure continue to bound practical pace.",
    },
    {
      title: "What to watch next",
      body: "Whether Brent establishes a sustained settlement above $90. Whether traceable Hormuz and LNG traffic stabilizes or stays depressed. Whether the Houthi declaration shows practical enforcement. Whether additional Gulf infrastructure damage is confirmed. The status of ceasefire or diplomatic proposals. Whether energy pressure spreads into broader credit or liquidity stress. Whether Kimi K3 downloadable weights arrive as scheduled and how GPT-5.6 and competing models convert access into durable enterprise workflows under summer grid limits.",
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
