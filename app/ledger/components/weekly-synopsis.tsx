export const WEEKLY_SYNOPSIS = {
  eyebrow: "Weekly Synopsis",
  headline: "Fragile corridors; strain beneath calm markets.",
  blocks: [
    {
      title: "What changed",
      body: "Hormuz and Gulf-route confidence weakened as shipping, routing, and insurance questions persisted, even while energy markets continued to function and oil pricing remained comparatively calm. The U.S.–Iran framework remained active but visibly strained. AI infrastructure pressure became more policy-visible as large-load grid integration moved further into the regulatory foreground. World Cup-related fraud, scams, and AI-generated content kept information integrity under pressure. Precious materials remained strategically firm, with gold sensitive to rates and premium natural diamond supply still selective.",
    },
    {
      title: "What's driving pressure",
      body: "Energy routes are not closed, but confidence is thinner. Financial conditions remain sensitive to the inflation and rate path. Infrastructure strain is increasingly visible through grid interconnection, data-center power demand, shipping friction, and event logistics. The information layer remains noisy as geopolitical, institutional, and AI-generated narratives overlap.",
    },
    {
      title: "What to watch next",
      body: "Whether Hormuz transit volumes stabilize or continue thinning. Whether oil pricing begins to reflect route-risk more aggressively. Whether FERC and large-load grid rules accelerate data-center cost and siting debates. Whether World Cup scam and deepfake activity remains event-localized or broadens. Whether gold reconnects to reserve demand or remains tethered to real yields. Whether AI capability releases translate into broad deployment or remain constrained by power and governance.",
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
