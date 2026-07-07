import EngagementRingsRingStudioEmbed from "./engagement-rings-ring-studio-embed";

export default function EngagementRingsRingStudioSection() {
  return (
    <section
      id="ring-studio"
      className="scroll-mt-24 border-b border-[#e4dbcf] py-[52px] md:py-[64px]"
    >
      <div className="text-left">
        <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
          The Ring Studio
        </div>
        <h2
          className="mt-4 max-w-[22ch] text-[1.65rem] font-light leading-[1.12] tracking-[-0.02em] text-[#1f1d1a] md:text-[2rem]"
          style={{ textWrap: "balance" }}
        >
          Explore each design in motion, metal, and profile.
        </h2>
        <p className="mt-4 max-w-[34rem] text-[0.98rem] leading-[1.82] text-[#5f5851] md:text-[1rem]">
          A starting point for comparing proportion, setting style, and presence
          before the conversation becomes more specific.
        </p>
      </div>

      <EngagementRingsRingStudioEmbed />
    </section>
  );
}
