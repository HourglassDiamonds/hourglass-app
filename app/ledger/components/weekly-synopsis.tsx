export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline: "Relief at the surface; strain underneath.",
  blocks: [
    {
      title: "What changed",
      body: "G7 leaders backed renewed pressure on Russia's war economy while supporting the U.S.-Iran framework around Hormuz. Energy pressure eased, but Hormuz traffic remains uneven and subject to new routing, permit, insurance, and security questions. The World Cup shifted from a sports story into a live test of transportation, security, weather response, and information integrity. AI infrastructure pressure continued to move from abstract compute demand into concrete power, grid, and site-selection constraints. Precious materials remained strategically firm, with gold supported by central-bank reserve behavior and diamonds entering a supply-structure reset.",
    },
    {
      title: "What's driving pressure",
      body: "Markets and energy routes cooled after ceasefire progress, but the underlying system remains tense. Shipping normalization is uneven, sanctions pressure is shifting back toward Russia, World Cup logistics are testing local infrastructure, and AI demand continues moving from software acceleration into power and grid constraints.",
    },
    {
      title: "What to watch next",
      body: "Whether Hormuz traffic normalizes or remains controlled, delayed, or selectively routed. Whether renewed Russia energy sanctions tighten oil and gas flows again after the Middle East relief trade. Whether World Cup host-city strain stays localized or becomes a broader infrastructure and safety narrative. Whether AI power demand continues raising utility, grid, and data-center siting pressure. Whether gold and high-quality natural diamonds continue behaving as scarcity and reserve assets rather than simple luxury cyclicals.",
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
