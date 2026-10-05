import ConsultationCtaLink from "../shared-components/ConsultationCtaLink";

export default function EngagementRingsHeroActions() {
  return (
    <div className="mt-7 md:mt-8">
      <ConsultationCtaLink
        location="engagement_rings:hero"
        className="hg-tap text-[0.92rem] text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]"
      >
        Begin the Conversation
      </ConsultationCtaLink>
    </div>
  );
}
