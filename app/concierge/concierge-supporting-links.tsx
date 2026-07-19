import Link from "next/link";
import WhisperedPraiseLink from "../shared-components/WhisperedPraiseLink";

const editorialLink =
  "text-[#6a635c] underline underline-offset-4 transition hover:text-[#1f1d1a]";

export default function ConciergeSupportingLinks() {
  return (
    <aside
      className="mx-auto mt-12 max-w-[680px] border-t border-[#e4dbcf] pt-10 md:mt-14 md:pt-12"
      aria-label="Further reading"
    >
      <p className="text-[10px] uppercase tracking-[0.32em] text-[#8a8177]">
        Still gathering context
      </p>

      <p className="mt-4 text-[0.94rem] leading-[1.88] text-[#7a7268]">
        None of this is required before you reach out. If helpful,{" "}
        <Link
          href="/diamond-guide/why-work-with-a-graduate-gemologist"
          className={editorialLink}
        >
          Why Work With a Graduate Gemologist?
        </Link>
        ,{" "}
        <Link
          href="/diamond-guide/independent-diamond-advisor-vs-jewelry-store"
          className={editorialLink}
        >
          Independent Advisor vs Jewelry Store
        </Link>
        , and — if you are in Charlotte —{" "}
        <Link
          href="/diamond-guide/charlotte-diamond-advisor-guide"
          className={editorialLink}
        >
          our local advisor guide
        </Link>{" "}
        offer a calm place to start.
      </p>

      <p className="mt-6">
        <WhisperedPraiseLink
          variant="arrow"
          className="hg-tap text-[11px] tracking-[0.1em]"
        >
          A few reflections from people we&rsquo;ve worked with &rarr;
        </WhisperedPraiseLink>
      </p>
    </aside>
  );
}
