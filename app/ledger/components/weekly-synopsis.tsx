export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline: "Pressure recalibrated; corridor heat remains concentrated.",
  blocks: [
    {
      title: "What changed",
      body: "The Global Pressure Index was recalibrated to 84° — High Heat, Concentrated Pressure — to separate current system pressure from future escalation risk. Earlier readings near 93° could overweight a single corridor event across related categories. Geopolitics and energy remain near the extreme end of the scale; financial markets, credit spreads, and broader economic activity have not confirmed a 2008- or COVID-style system event. AI capability, precious materials, infrastructure strain, and information clarity continue within their established regimes.",
    },
    {
      title: "What's driving pressure",
      body: "Primary drivers remain energy corridors, geopolitical escalation, and shipping disruption. The primary offset is functioning credit markets and continued economic expansion. Direction stays high and unstable: escalation potential is elevated even while the recalibrated reading stays below collapse-era benchmarks.",
    },
    {
      title: "What to watch next",
      body: "Whether disruption through Hormuz and Bab el-Mandeb persists or broadens. Whether oil remains elevated long enough to affect inflation, consumption, and policy. Whether corporate-credit spreads, financial-stress measures, or volatility begin confirming the geopolitical signal. Whether supply-chain disruption spreads beyond energy shipping. Whether electricity systems continue operating normally under record demand or require emergency measures.",
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
