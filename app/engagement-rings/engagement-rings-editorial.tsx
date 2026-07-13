import Link from "next/link";
import WhisperedPraiseLink from "../shared-components/WhisperedPraiseLink";

const editorialLink =
  "text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]";

const resourceLink =
  "text-[#6b5048] underline decoration-[#d9cfc2] underline-offset-[5px] transition-colors hover:text-[#1f1d1a] hover:decoration-[#b8a896] focus:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-[#cbbda9]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f2ea]";

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
    label: "Analyze Sparkle",
    description:
      "Interpret proportions and light performance from an existing report.",
  },
  {
    href: "/diamond-studio",
    label: "See It On a Finger",
    description: "Compare carat, shape, and finger coverage before you decide.",
  },
  {
    href: "/diamond-shape-studio",
    label: "See It On Your Hand",
    description: "Preview diamond shapes and presence on your own hand.",
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
      <section className="border-b border-[#e4dbcf]/75 pt-[56px] pb-[56px] md:pt-[60px] md:pb-[72px] lg:pb-[88px]">
        <div className={`${LOWER_GRID} md:items-start`}>
          <div className="col-span-12 min-w-0 md:col-span-5">
            <h2
              className="max-w-[20ch] text-[1.75rem] font-light leading-[1.12] tracking-[-0.02em] text-[#1f1d1a] md:text-[2.15rem]"
              style={{ textWrap: "balance" }}
            >
              Private guidance, sourced with judgment.
            </h2>

            <div className="mt-8 space-y-5 text-[0.98rem] leading-[1.88] text-[#5f5851] md:mt-9 md:text-[1rem] md:leading-[1.9]">
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
          </div>

          <div className="col-span-12 min-w-0 md:col-span-6 md:col-start-7 md:pt-1">
            <p className="text-[10px] uppercase tracking-[0.28em] text-[#8a8177]">
              A guided process
            </p>

            <ol className="mt-6 border-t border-[#e4dbcf]">
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

      <section className="border-b border-[#e4dbcf]/75 bg-[#ebe4da]/40 py-[56px] md:py-[72px] lg:py-[88px]">
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
            <div className="rounded-[24px] border border-[#e4dbcf]/55 bg-[radial-gradient(circle_at_14%_10%,rgba(255,255,255,0.4),rgba(251,246,238,0.52)_40%,rgba(245,238,228,0.34)_100%)] p-1.5 md:p-2">
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {authorityLinks.map((item) => (
                  <li
                    key={item.href}
                    className="rounded-[18px] border border-[#ebe3d6]/75 bg-white/28 px-5 py-5 transition-[background-color,border-color] duration-300 hover:border-[#e0d4c4]/85 hover:bg-white/40 md:px-6 md:py-[1.35rem]"
                  >
                    <Link
                      href={item.href}
                      className={`${resourceLink} text-[0.98rem] md:text-[1rem]`}
                    >
                      {item.label}
                    </Link>
                    <p className="mt-2.5 max-w-[22rem] text-[0.94rem] leading-[1.8] text-[#534d47] md:text-[0.95rem]">
                      {item.description}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <blockquote className="mt-8 rounded-[22px] border border-[#e4dbcf]/55 bg-[#f5efe6]/38 px-6 py-7 md:mt-9 md:px-8 md:py-8">
              <p
                className="max-w-[32rem] font-serif text-[1.28rem] font-normal leading-[1.4] tracking-[-0.02em] text-[#252220] md:text-[1.42rem] md:leading-[1.38]"
                style={{ textWrap: "balance" }}
              >
                &ldquo;It always felt like I was working with a partner.&rdquo;
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
          </div>
        </div>
      </section>
    </>
  );
}
