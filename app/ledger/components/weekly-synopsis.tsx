export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline:
    "Energy pressure reaches rates as water and grid constraints broaden.",
  blocks: [
    {
      title: "What changed",
      body: "Evidence reviewed through August 18, 2026. Brent moved above $90 as the negotiating window expired and Hormuz restriction continued. Long-duration sovereign yields repriced — U.S. 30-year around 5.32–5.33% and 10-year above ~4.7% — as energy, fiscal issuance, and AI-infrastructure capital demand interacted, even while near-term Fed-hike expectations softened. European water stress produced real power and freight effects; PJM structural adequacy stress remains. AI industrialization is increasingly capital- and power-intensive. Gold remains around ~$4,400, firm but restrained by higher yields. System Temperature is 69°, +3° from the August 12 baseline of 66°.",
    },
    {
      title: "Why temperature rose — and why not more",
      body: "The move is driven by financial conditions tightening as long-duration borrowing costs repriced. Corridor pressure was already severe, so a higher oil print does not, by itself, raise that channel further. Physical systems remain under strain, with operators adapting. Credit and funding markets continue to function; alternative crude routing remains active.",
    },
    {
      title: "What to watch next",
      body: "Sustained Brent in the mid-$90s or toward $100. Restoration or further deterioration of Hormuz transit. Direction of the 30-year Treasury. Confirmation of IG/HY spreads from dated credit prints. European river recovery or deterioration, nuclear / hydro restoration, and PJM reliability actions. An actual Gulf desalination outage versus strategic exposure only. AI infrastructure financing and power demand.",
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
