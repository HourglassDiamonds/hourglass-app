import Link from "next/link";
import WhisperedPraiseLink from "../shared-components/WhisperedPraiseLink";

const editorialLink =
  "text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]";

const toolPill =
  "inline-flex h-8 items-center justify-center whitespace-nowrap rounded-full border border-[#ddd1c2] bg-white/82 px-2.5 text-[10px] uppercase tracking-[0.18em] text-[#6f665d] transition duration-200 hover:border-[#ccbda9] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hg-focus focus-visible:ring-offset-2 focus-visible:ring-offset-hg-ivory";

const toolPills = [
  { href: "/diamond-intelligence", label: "Analyze Sparkle" },
  { href: "/diamond-shape-studio", label: "See It On Your Hand" },
  {
    href: "/our-approach",
    label: "What We Look For",
  },
] as const;

export default function EngagementRingsEditorial() {
  return (
    <>
      <section className="border-b border-[#e4dbcf]/75 px-1 pb-8 pt-6 text-center md:pb-10 md:pt-8">
        <h2
          className="mx-auto max-w-[16rem] text-[1.75rem] font-light leading-[1.12] tracking-[-0.02em] text-[#1f1d1a] md:max-w-[22rem] md:text-[2.15rem]"
          style={{ textWrap: "balance" }}
        >
          Private guidance, sourced with judgment.
        </h2>

        <div className="mx-auto mt-8 max-w-[40rem] space-y-5 text-[0.98rem] leading-[1.88] text-[#5f5851] md:mt-9 md:text-[1rem] md:leading-[1.9]">
          <p>
            Most engagement ring shopping still begins in a case or a cart.
            Hourglass is structured differently. There is no showroom floor to
            browse and no pressure to choose from what is already on hand.
            Diamonds and settings are considered together, with recommendations
            shaped by beauty, make, and suitability rather than paper grades
            alone.
          </p>
          <p>
            Natural and lab-grown diamonds can both be excellent when cut
            quality and transparency are prioritized. A{" "}
            <Link href="/diamond-guide/why-work-with-a-graduate-gemologist" className={editorialLink}>
              Graduate Gemologist
            </Link>{" "}
            reads grading reports with context, compares stones that actually
            fit your setting, and explains tradeoffs honestly before you commit.
          </p>
          <p>
            <Link href="/custom-design" className={editorialLink}>
              For broader bespoke jewelry projects, explore Custom Design.
            </Link>
          </p>
        </div>

        <p className="mx-auto mt-5 max-w-[28rem] text-[0.96rem] leading-[1.8] text-[#5f5851]">
          Useful when reports, proportions, or origin still need context.
        </p>
        <ul className="mx-auto mt-5 flex max-w-full flex-wrap items-center justify-center gap-2 lg:flex-nowrap">
          {toolPills.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className={toolPill}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4">
          <Link
            href="/diamond-guide/natural-vs-lab-diamonds"
            className={editorialLink}
          >
            Natural versus Lab-Grown Diamonds
          </Link>
        </p>
      </section>

      <section className="border-b border-[#e4dbcf]/75 px-2 pb-[72px] pt-10 text-center md:pb-[96px] md:pt-12">
        <blockquote>
          <p
            className="mx-auto max-w-[34rem] font-serif text-[1.28rem] font-normal leading-[1.45] tracking-[-0.02em] text-[#252220] md:text-[1.42rem] md:leading-[1.4]"
            style={{ textWrap: "balance" }}
          >
            &ldquo;It always felt like I was working with a partner.&rdquo;
          </p>
        </blockquote>
        <p className="mt-8">
          <WhisperedPraiseLink
            variant="arrow"
            className="hg-tap text-[10.5px] tracking-[0.12em]"
          >
            Whispered Praise &rarr;
          </WhisperedPraiseLink>
        </p>
      </section>
    </>
  );
}
