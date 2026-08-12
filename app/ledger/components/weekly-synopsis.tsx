export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline:
    "Corridor pressure very high; energy premium partial; broader systems still functioning.",
  blocks: [
    {
      title: "What changed",
      body: "Evidence reviewed through August 12, 2026. Hormuz reopen hopes faded amid fresh shipping attacks; Reuters-cited vessel tracking showed a one-week-low Hormuz count near eight (Kpler) / eleven (LSEG) versus roughly 130–140 pre-conflict, with Brent around $89. OpenAI’s August 6 ChatGPT updates broadened consumer GPT-5.6 access while leaving Work/Codex on July versions. PJM’s large-load / Interim Resource Adequacy framework replaced expired mid-July emergency-order language as the live infrastructure story. The first official Ledger System Temperature baseline is established on the hub at 66° (High) with Moderate confidence.",
    },
    {
      title: "What's driving pressure",
      body: "Very high external corridor pressure remains the primary heat source. Transmission is partial into energy prices and contained in credit — reviewed spreads stay near historically tight levels. Infrastructure strain is elevated and structural. Precious materials remain strategically firm and segmented. Information clarity stays uneven, which lowers confidence without independently raising temperature.",
    },
    {
      title: "What to watch next",
      body: "Whether Hormuz transit and official flow claims converge. Whether oil near $90 transmits into inflation and policy more than into credit stress. Whether PJM’s large-load adequacy path advances at FERC. Whether consumer AI access updates remain distinct from enterprise deployment reality. Whether gold near $4,400 and official-sector demand stay supports rather than a jewelry-regime break.",
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
