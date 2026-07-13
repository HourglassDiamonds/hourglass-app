import DiamondStudioToolHeader from "@/app/diamond-studio/components/DiamondStudioToolHeader";

const TRUST_ITEMS = [
  "Private by Default",
  "Independent Analysis",
  "Graduate Gemologist Reviewed",
  "No Sales Pressure",
] as const;

/** Compact suite tool intro — replaces full landing hero inside the shared shell. */
export function DiSuiteToolIntro() {
  return (
    <header
      className="border-b border-[#e4dbcf]/60 pb-4 pt-1 md:pb-5 md:pt-2"
      aria-label="Analyze Sparkle tool introduction"
    >
      <DiamondStudioToolHeader
        title="Analyze Sparkle"
        subhead="Upload an original GIA, IGI, or GCAL grading report for independent interpretation before you decide."
      />
      <p className="mx-auto mt-2 max-w-[36rem] text-center text-[10px] uppercase tracking-[0.22em] text-[#948a80]">
        Diamond Intelligence · Private · No sales pressure
      </p>
    </header>
  );
}

export function TrustPrivacyBand() {
  return (
    <section
      className="mt-5 border-t border-[#e4dbcf]/70 pt-5 md:mt-6 md:pt-6"
      aria-label="Trust and privacy"
    >
      <ul className="grid grid-cols-2 gap-x-3 gap-y-3 md:grid-cols-4 md:gap-0">
        {TRUST_ITEMS.map((item, index) => (
          <li
            key={item}
            className={`px-1 text-center text-[9px] uppercase leading-snug tracking-[0.24em] text-[#8a8177] sm:text-[10px] sm:tracking-[0.28em] ${
              index > 0
                ? "md:border-l md:border-[#e4dbcf]/70 md:px-4 lg:px-6"
                : "md:px-4 lg:px-6"
            }`}
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** @deprecated Large landing hero — use DiSuiteToolIntro inside the suite shell. */
export default function DiLandingMarketing() {
  return <DiSuiteToolIntro />;
}
