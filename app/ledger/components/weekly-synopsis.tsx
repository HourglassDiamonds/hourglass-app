export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline: "External pressure high; systemic transmission still contained.",
  blocks: [
    {
      title: "What changed",
      body: "Composite numerical scoring across the Ledger monitoring system is paused while methodology is standardized and historically validated. Public surfaces now use qualitative states, direction, documented evidence, and defined change triggers. Geopolitical and energy risks remain unusually elevated around critical shipping corridors; financial markets and the wider economy have not confirmed a systemic transmission event. AI capability pace is accelerating beneath infrastructure-bound deployment. Precious materials remain strategically firm and highly segmented. Infrastructure strain stays elevated with narrowed flexibility.",
    },
    {
      title: "What's driving pressure",
      body: "Threat pressure remains very high: shipping-corridor disruption, geopolitical escalation risk, oil and commodity sensitivity, and structural electricity-grid constraints. System transmission is moderate and currently easing — oil declined after the pause in planned military action, equities rallied, Treasury yields eased, and credit markets are not showing crisis-level stress. Signal density is rising without clarity gains. Frontier AI access broadened while grid and power limits still set practical pace.",
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
