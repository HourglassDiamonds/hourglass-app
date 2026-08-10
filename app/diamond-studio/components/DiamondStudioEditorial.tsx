import Link from "next/link";
import DiV3Chapter from "@/app/diamond-intelligence/components/DiV3Chapter";
import { DI_V3_FAQ_ACCORDION_GROUP } from "@/app/diamond-intelligence/components/di-v3-styles";
import type { DiamondStudioEventProperties } from "@/app/diamond-studio/analytics";
import {
  DIAMOND_STUDIO_EDUCATIONAL_HEADING,
  DIAMOND_STUDIO_FAQS,
} from "@/lib/seo/diamond-studio-educational";
import { PERSON_JOB_TITLE, PERSON_NAME } from "@/lib/seo/schema/constants";
import DiamondStudioEditorialContact from "./DiamondStudioEditorialContact";

const editorialLink =
  "text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]";

const bodyCopy =
  "space-y-4 text-[0.94rem] leading-[1.82] text-[var(--ink-soft)] md:text-[1rem] md:leading-[1.85]";

type DiamondStudioEditorialProps = {
  analyticsProps: DiamondStudioEventProperties;
};

export default function DiamondStudioEditorial({
  analyticsProps,
}: DiamondStudioEditorialProps) {
  return (
    <section
      className="dts-editorial border-t border-[#e4dbcf]/40 bg-[var(--bg)] px-6 py-14 md:px-10 md:py-20"
      aria-labelledby="dts-editorial-heading"
    >
      <div className="mx-auto w-full max-w-[50rem]">
        <h2
          id="dts-editorial-heading"
          className="font-serif text-[1.65rem] font-normal leading-[1.2] tracking-[-0.02em] text-[var(--ink)] md:text-[1.85rem]"
        >
          {DIAMOND_STUDIO_EDUCATIONAL_HEADING}
        </h2>

        <div className={`${bodyCopy} mt-6 max-w-[46rem] md:mt-8`}>
          <p>
            Carat weight measures weight, not the visible face-up size you see
            once a diamond is on the hand. Two stones with identical carat
            weights can still look different in scale because of diamond shape,
            proportions, length-to-width ratio, depth, finger size, band width,
            and orientation. That is why{" "}
            <Link href="/diamond-guide/diamond-carat-vs-size" className={editorialLink}>
              carat versus visible size
            </Link>{" "}
            is such a practical distinction when comparing listings or imagining
            diamond size on finger before an appointment.
          </p>
          <p>
            The Diamond Size Studio above is designed to help you understand
            scale and finger coverage before choosing a center stone. Adjust
            carat, shape, ring size, band width, and orientation to see how
            diamond size on hand changes in context—not as an abstract millimeter
            chart, but as a relative impression on the finger. The same carat can
            feel quiet on one hand and more present on another; elongated outlines
            often read differently from rounds.{" "}
            <Link
              href="/diamond-guide/do-elongated-diamonds-look-bigger"
              className={editorialLink}
            >
              Elongated diamonds and face-up presence
            </Link>{" "}
            and the{" "}
            <Link href="/diamond-guide/diamond-size-on-hand" className={editorialLink}>
              diamond size on hand guide
            </Link>{" "}
            explain those tendencies in more depth, while the{" "}
            <Link href="/diamond-guide/diamond-size-chart" className={editorialLink}>
              diamond size chart
            </Link>{" "}
            remains a useful millimeter reference beside the visualizer.
          </p>
          <p>
            Use the Studio as a calibrated visualization for proportion and
            comparison. Actual appearance varies with exact stone dimensions,
            screen calibration, viewing distance, setting geometry, and
            photography or display characteristics. It will not perfectly predict
            every real-world diamond. When you are ready to move from preview to
            selection,{" "}
            <Link href="/diamond-guide/what-is-diamond-cut" className={editorialLink}>
              cut and proportions
            </Link>
            ,{" "}
            <Link href="/diamond-guide/diamond-shapes" className={editorialLink}>
              diamond shapes
            </Link>
            , and{" "}
            <Link href="/engagement-rings" className={editorialLink}>
              engagement rings
            </Link>{" "}
            remain useful next steps.
          </p>
        </div>

        <aside
          className="mt-10 max-w-[46rem] border-t border-[#e4dbcf]/30 pt-8 md:mt-12"
          aria-label="Creator attribution"
        >
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#6d655e]">
            Built by{" "}
            <Link
              href="/"
              className="text-[#6d655e] transition-colors duration-300 hover:text-[#1f1d1a]"
            >
              Hourglass Diamonds
            </Link>
          </p>
          <p className="mt-3 text-[0.9rem] leading-[1.7] text-[var(--ink-soft)]">
            Developed by{" "}
            <Link
              href="/the-house"
              className={`${editorialLink} font-medium text-[var(--ink-soft)]`}
            >
              {PERSON_NAME}
            </Link>
            , {PERSON_JOB_TITLE}, to help clients compare diamond scale, shape,
            and finger coverage before choosing a center stone.
          </p>
        </aside>

        <section
          className="dts-faq mt-14 border-t border-[#e4dbcf]/30 pt-12 md:mt-16 md:pt-14"
          aria-labelledby="dts-faq-heading"
        >
          <h2
            id="dts-faq-heading"
            className="font-serif text-[1.35rem] font-normal leading-[1.25] tracking-[-0.02em] text-[var(--ink)] md:text-[1.5rem]"
          >
            Common questions
          </h2>
          <div className={DI_V3_FAQ_ACCORDION_GROUP}>
            {DIAMOND_STUDIO_FAQS.map(({ question, answer }, index) => (
              <DiV3Chapter
                key={question}
                number={`Q${index + 1}`}
                title={question}
                chapterId={`studio-faq-${index + 1}`}
                compact
              >
                <p>{answer}</p>
              </DiV3Chapter>
            ))}
          </div>
        </section>

        <section
          className="mt-14 border-t border-[#e4dbcf]/30 pt-12 md:mt-16 md:pt-14"
          aria-labelledby="dts-editorial-use-heading"
        >
          <h2
            id="dts-editorial-use-heading"
            className="font-serif text-[1.35rem] font-normal leading-[1.25] tracking-[-0.02em] text-[var(--ink)] md:text-[1.5rem]"
          >
            Editorial &amp; Educational Use
          </h2>
          <div className={`${bodyCopy} mt-5 max-w-[46rem]`}>
            <p>
              Writing about diamond size, carat weight, or engagement-ring
              proportions? Selected Diamond Size Studio comparisons may be used
              for editorial or educational purposes with attribution to Hourglass
              Diamonds and a link to the Diamond Size Studio.
            </p>
            <p className="pt-1">
              <DiamondStudioEditorialContact
                className={editorialLink}
                analyticsProps={analyticsProps}
              />
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}
