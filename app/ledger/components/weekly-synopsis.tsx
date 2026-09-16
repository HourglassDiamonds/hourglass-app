export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline:
    "Energy disruption broadens as financial transmission deepens.",
  blocks: [
    {
      title: "What changed",
      body: "Evidence reviewed through September 16, 2026. The energy shock broadened after Saudi Arabia’s principal Hormuz-bypass route was disrupted, while already-depressed Hormuz traffic fell further. Brent established a $100+ regime around $108. Hormuz commodity traffic printed four vessels. The U.S. 10-year crossed 5% on September 15 and a September 15–16 Fed hike became nearly fully priced; the 10-year retreated just below 5% on the morning of September 16 without reversing that financial pressure. EIA forecasts record electricity demand; Texas is gating data-center power and water. Gold fell toward the high-$4,200s. Credit, funding, equities, and earnings continue to function. Physical oil continues clearing. System Temperature is 74°, High, Systems Functioning, Confidence Moderate — +4° from the August 24 published reading of 70°.",
    },
    {
      title: "Why temperature rose — and why not more",
      body: "Geo/energy moved from severe/partial to severe/broad after Saudi Arabia’s principal Hormuz-bypass route was disrupted and oil established a $100+ regime. Financial pressure moved from high/partial to very-high/partial as the 10-year crossed 5% and hike odds reversed the August 18 path. Infrastructure, materials, and Technology/AI hold their August 24 discrete states. What kept the reading from moving higher: functioning credit and funding, resilient equities and earnings, physical oil still clearing, Texas load-gating rather than grid failure, and gold’s decline as a rates disconfirmation rather than a materials increment.",
    },
    {
      title: "What to watch next",
      body: "Whether the principal East-West Pipeline / Yanbu route resumes on a days-to-weeks timeline. Independently trackable Hormuz transit versus a deeper single-digit print. Whether the 10-year holds near 5% after the September Fed decision. Texas data-center water/power compliance versus re-admission of load. Colorado Powell protection via Flaming Gorge releases. Whether lab safety-coordination becomes an operational slowdown or remains a statement.",
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
