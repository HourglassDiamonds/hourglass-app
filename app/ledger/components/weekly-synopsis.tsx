export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline:
    "Pressure persists while adaptation keeps the system functioning.",
  blocks: [
    {
      title: "What changed",
      body: "Evidence reviewed through October 29, 2026. EIA still sees constrained Middle East oil flows and a $105 fourth-quarter Brent path, but regional shut-ins eased and export workarounds improved. The Fed held after September's hike; the 10-year remains near 5% while domestic activity and market function remain resilient. PJM used October alerts and demand response but maintained service. Gold cooled toward roughly $4,013, September diamond gains broadened unevenly, Powell rose seasonally to 24% full, and GPT-6 and Gemini 4 Argon expanded frontier access under explicit capability and containment controls.",
    },
    {
      title: "Why temperature held",
      body: "All five discrete channel states are unchanged, so System Temperature remains 74°, High, Systems Functioning, Confidence Moderate. Oil and rates pressure remain confirmed; PJM and frontier-model evidence confirm infrastructure and security constraints. What prevents a higher reading is equally concrete: physical oil workarounds, functioning credit and funding, resilient activity, successful grid operations, lower gold, seasonal Powell improvement, and explicit AI containment. No numerical move was forced to create publication activity.",
    },
    {
      title: "What to watch next",
      body: "Whether improving Middle East exports reduce the fourth-quarter oil premium; whether long yields and inflation force another Fed move; whether PJM's large-load tools remain precautionary or become operationally necessary; whether September diamond gains hold through holiday demand; whether Powell's seasonal rise persists; and whether frontier-model containment keeps pace with broader agentic deployment.",
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
