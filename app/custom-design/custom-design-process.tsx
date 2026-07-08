import Link from "next/link";
import WhisperedPraiseLink from "../shared-components/WhisperedPraiseLink";

const editorialLink =
  "text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]";

const processSteps = [
  {
    label: "01 Conversation",
    body:
      "We begin with references, lifestyle, what the piece should express, and how it will be worn.",
  },
  {
    label: "02 Direction",
    body:
      "Sketches and CAD translate that direction into proportion, structure, stone placement, and setting height.",
  },
  {
    label: "03 Refinement",
    body:
      "The design is adjusted until it reads correctly from every angle and the diamond, setting, and smaller details feel resolved together.",
  },
  {
    label: "04 Completion",
    body:
      "The appropriate workshop carries the piece through production, setting, finishing, and final review against the approved direction.",
  },
  {
    label: "05 Gemological Oversight",
    body:
      "Diamonds and materials are selected for the design, not because they happen to be available in a case. Each decision is reviewed for beauty, suitability, and the finished piece.",
  },
  {
    label: "06 Workshop, Timing & Service",
    body:
      "The workshop is chosen for the requirements of the piece. Most projects are completed approximately four to six weeks after design approval. Clients may meet in Charlotte or South Charlotte, while many projects are completed remotely.",
  },
];

export default function CustomDesignProcess() {
  return (
    <section className="border-b border-[#e4dbcf] pt-[56px] pb-[48px] md:pt-[72px] md:pb-[56px] lg:pt-[88px] lg:pb-[64px]">
      <div className="mx-auto max-w-[40rem] text-center">
        <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
          The Custom Process
        </div>
        <h2
          className="mt-4 text-[1.75rem] font-light leading-[1.12] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.15rem]"
          style={{ textWrap: "balance" }}
        >
          How a custom piece takes shape.
        </h2>
        <p className="mx-auto mt-5 max-w-[34rem] text-[0.98rem] leading-[1.88] text-[#5f5851] md:text-[1rem] md:leading-[1.9]">
          Custom design is not a menu of styles. It is a sequence of decisions
          that keeps the finished piece aligned with the original direction.
        </p>
      </div>

      <ol className="mx-auto mt-10 grid max-w-[920px] grid-cols-1 border-t border-[#e4dbcf] md:mt-12 md:grid-cols-2 lg:gap-x-10">
        {processSteps.map((step) => (
          <li
            key={step.label}
            className="border-b border-[#e4dbcf] py-5 md:py-[1.3rem]"
          >
            <div className="text-[10px] uppercase tracking-[0.26em] text-[#8a8177]">
              {step.label}
            </div>
            <p className="mt-2.5 max-w-[34rem] text-[1.02rem] leading-[1.88] text-[#4f4842] md:text-[1.04rem]">
              {step.body}
            </p>
          </li>
        ))}
      </ol>

      <p className="mx-auto mt-8 max-w-[920px] text-center md:mt-9 md:text-left">
        <Link
          href="/diamond-guide/custom-engagement-rings-in-charlotte"
          className={editorialLink}
        >
          Read the Charlotte Custom Engagement Ring Guide →
        </Link>
      </p>

      <blockquote className="mx-auto mt-8 max-w-[34rem] border-t border-[#e4dbcf] pt-7 text-center md:mt-10 md:pt-8">
        <p
          className="font-serif text-[1.32rem] font-normal leading-[1.4] tracking-[-0.02em] text-[#252220] md:text-[1.48rem] md:leading-[1.38]"
          style={{ textWrap: "balance" }}
        >
          &ldquo;He truly brought it to life with care, skill, and attention to
          detail.&rdquo;
        </p>
        <footer className="mt-5">
          <WhisperedPraiseLink
            variant="arrow"
            className="text-[10.5px] tracking-[0.12em]"
          >
            Whispered Praise &rarr;
          </WhisperedPraiseLink>
        </footer>
      </blockquote>
    </section>
  );
}
