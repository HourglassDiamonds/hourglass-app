import Link from "next/link";
import WhisperedPraiseLink from "../shared-components/WhisperedPraiseLink";

const editorialLink =
  "text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]";

const LOWER_GRID = "grid grid-cols-12 gap-x-6 lg:gap-x-8";

const processSteps = [
  {
    label: "01 Conversation",
    body: "We begin with how the ring will be worn, what it should express, and the direction that feels natural.",
  },
  {
    label: "02 Direction",
    body: "Diamonds are sourced with clear visual guidance, honest recommendations, and no pressure to choose too soon.",
  },
  {
    label: "03 Refinement",
    body: "Proportion, reference imagery, and small adjustments bring the design into balance.",
  },
  {
    label: "04 Completion",
    body: "The finished piece is reviewed and presented with the same care that shaped the process from the start.",
  },
];

const authorityLinks = [
  {
    href: "/diamond-intelligence",
    label: "Diamond Intelligence",
    description:
      "Interpret proportions and light performance from an existing report.",
  },
  {
    href: "/diamond-studio",
    label: "Diamond Size Studio",
    description: "Compare carat, shape, and finger coverage before you decide.",
  },
  {
    href: "/diamond-guide/why-work-with-a-graduate-gemologist",
    label: "Why Work With a Graduate Gemologist?",
    description:
      "What gemological training means when two stones look similar on paper.",
  },
  {
    href: "/diamond-guide/natural-vs-lab-diamonds",
    label: "Natural versus Lab-Grown Diamonds",
    description: "Practical differences without hype or pressure.",
  },
];

export default function EngagementRingsEditorial() {
  return (
    <>
      <section className="border-b border-[#e4dbcf] pt-[48px] pb-[56px] md:pt-[52px] md:pb-[72px] lg:pb-[88px]">
        <div className={LOWER_GRID}>
          <h2
            className="col-span-12 max-w-[20ch] text-[1.75rem] font-light leading-[1.12] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.15rem]"
            style={{ textWrap: "balance" }}
          >
            Private guidance, sourced with judgment.
          </h2>

          <div
            className={`col-span-12 mt-8 ${LOWER_GRID} md:mt-10 md:items-start`}
          >
            <div className="col-span-12 min-w-0 space-y-5 text-[0.98rem] leading-[1.88] text-[#5f5851] md:col-span-5 md:text-[1rem] md:leading-[1.9]">
              <p>
                Most engagement ring shopping still begins in a case or a cart.
                Hourglass is structured differently. There is no showroom floor
                to browse and no pressure to choose from what is already on
                hand. Diamonds and settings are considered together, with
                recommendations shaped by beauty, make, and suitability rather
                than paper grades alone.
              </p>
              <p>
                Natural and lab-grown diamonds can both be excellent when cut
                quality and transparency are prioritized. A{" "}
                <Link href="/the-house" className={editorialLink}>
                  Graduate Gemologist
                </Link>{" "}
                reads grading reports with context, compares stones that
                actually fit your setting, and explains tradeoffs honestly
                before you commit.
              </p>
              <p>
                <Link href="/custom-design" className={editorialLink}>
                  For broader bespoke jewelry projects, explore Custom Design.
                </Link>
              </p>
            </div>

            <ol className="col-span-12 min-w-0 border-t border-[#e4dbcf] md:col-span-6 md:col-start-7">
              {processSteps.map((step) => (
                <li
                  key={step.label}
                  className="border-b border-[#e4dbcf] py-5 md:py-[1.35rem]"
                >
                  <div className="text-[10px] uppercase tracking-[0.26em] text-[#8a8177]">
                    {step.label}
                  </div>
                  <p className="mt-2.5 max-w-[36rem] text-[0.95rem] leading-[1.78] text-[#5f5851] md:text-[0.96rem]">
                    {step.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="border-b border-[#e4dbcf] bg-[#ebe4da]/40 py-[56px] md:py-[80px] lg:py-[96px]">
        <div className={`${LOWER_GRID} md:items-start`}>
          <div className="col-span-12 md:col-span-4">
            <div className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
              Judgment Before Inventory
            </div>
            <h2
              className="mt-4 max-w-[16ch] text-[1.75rem] font-light leading-[1.12] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.15rem]"
              style={{ textWrap: "balance" }}
            >
              A clearer way to decide.
            </h2>
            <p className="mt-4 max-w-[22rem] text-[0.96rem] leading-[1.82] text-[#5f5851] md:text-[0.98rem]">
              Useful when reports, proportions, or origin still need context.
            </p>
          </div>

          <div className="col-span-12 mt-10 md:col-span-8 md:col-start-5 md:mt-0">
            <ul className="grid border-t border-[#e4dbcf] sm:grid-cols-2">
              {authorityLinks.map((item, index) => (
                <li
                  key={item.href}
                  className={`min-w-0 border-b border-[#e4dbcf] py-5 sm:py-6 ${
                    index % 2 === 0 ? "sm:border-r sm:pr-6 lg:pr-8" : "sm:pl-6 lg:pl-8"
                  }`}
                >
                  <Link
                    href={item.href}
                    className={`${editorialLink} text-[1rem]`}
                  >
                    {item.label}
                  </Link>
                  <p className="mt-2 max-w-[22rem] text-[0.95rem] leading-[1.82] text-[#534d47]">
                    {item.description}
                  </p>
                </li>
              ))}
            </ul>

            <blockquote className="mt-7 border-t border-[#e4dbcf] pt-7 md:mt-8 md:pt-8">
              <p
                className="max-w-[32rem] font-serif text-[1.28rem] font-normal leading-[1.4] tracking-[-0.02em] text-[#252220] md:text-[1.42rem] md:leading-[1.38]"
                style={{ textWrap: "balance" }}
              >
                &ldquo;It always felt like I was working with a partner.&rdquo;
              </p>
              <footer className="mt-4">
                <WhisperedPraiseLink
                  variant="arrow"
                  className="text-[10.5px] tracking-[0.12em]"
                >
                  Whispered Praise &rarr;
                </WhisperedPraiseLink>
              </footer>
            </blockquote>
          </div>
        </div>
      </section>
    </>
  );
}
