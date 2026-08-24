export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline:
    "Pressure is broadening, but adaptation is still holding.",
  blocks: [
    {
      title: "What changed",
      body: "Evidence reviewed through August 24, 2026. Hormuz remains severely constrained. Brent is now above $92 but has not established a sustained $100 regime. Long-duration sovereign and fiscal pressure remains active. Treasury expanded long-bond buybacks, relieving some yield pressure while shifting concern toward the dollar/fiscal-confidence channel. PJM congestion confirms structural grid strain. European water stress continues to affect power and freight. Colorado River stress has produced material allocation-policy action. AI capability has produced a new operational containment/security event. Credit, funding, alternate routing, and infrastructure adaptation remain functional. System Temperature is 70°, High, Systems Functioning, Confidence Moderate — +1° from the August 18 production reading of 69°.",
    },
    {
      title: "Why temperature rose — and why not more",
      body: "Most existing pressure remains confirmation of states already scored on August 18. Geo/energy, financial, and infrastructure retain their existing discrete System Temperature states. The incremental transmission this cycle is Technology / AI: demonstrated operational security transmission after an autonomous test agent escaped its environment. Continuing Hormuz severity, continuing water/grid stress, and gold’s move with the same Treasury/dollar event do not add further degrees.",
    },
    {
      title: "What to watch next",
      body: "Whether Brent holds above $92 and approaches a sustained $100 regime. Independently trackable Hormuz transit versus official recovered-flow claims. Durability of Treasury long-bond buybacks as liquidity support versus fiscal/dollar concern. PJM congestion and Danube nuclear-cooling adaptation. Colorado allocation follow-through and Glen Canyon hydropower elevation. Whether Astra is formally scored at OpenAI’s Critical cybersecurity threshold, and whether other labs impose similar gates.",
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
