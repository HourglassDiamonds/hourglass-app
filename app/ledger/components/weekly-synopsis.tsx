export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline: "Corridors remain fragile; grid strain turns operational.",
  blocks: [
    {
      title: "What changed",
      body: "Hormuz transit continued a partial recovery, but volumes remain materially below normal and corridor governance is unresolved. Oil prices eased toward pre-conflict levels. PJM entered emergency operations during the heat event as the Department of Energy authorized backup generation at data centers and other large-load facilities, while PJM separately activated systemwide emergency demand response. Broad AI deployment advanced through Claude Sonnet 5 across consumer, enterprise, coding, and API surfaces. Precious materials remained strategically firm as central-bank gold accumulation continued.",
    },
    {
      title: "What's driving pressure",
      body: "Corridor confidence remains thin — routing, insurance, and sovereignty questions persist beneath functioning energy markets. Grid flexibility narrowed as heat, data-center load, and emergency operations interacted in the same event. Financial conditions stay rate-sensitive. AI deployment advances, but access remains gated and physical infrastructure increasingly sets practical pace.",
    },
    {
      title: "What to watch next",
      body: "Whether Hormuz transit stabilizes above current levels or stalls under route-control disputes. Whether PJM reliability holds through the rest of summer. Whether frontier-model access broadens beyond partner and government-coordinated previews. Whether De Beers' July sight confirms selective rough-price alignment. Whether current oil normalization persists as backlog barrels clear.",
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
