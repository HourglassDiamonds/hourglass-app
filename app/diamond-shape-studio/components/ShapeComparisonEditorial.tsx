import Link from "next/link";
import DiV3Chapter from "@/app/diamond-intelligence/components/DiV3Chapter";
import { DI_V3_STUDIO_ACCORDION_GROUP } from "@/app/diamond-intelligence/components/di-v3-styles";

const editorialLink =
  "text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]";

const bodyCopy =
  "space-y-4 text-[0.94rem] leading-[1.82] text-[var(--ink-soft)] md:text-[1rem] md:leading-[1.85]";

const introCopy =
  "text-[0.94rem] leading-[1.82] text-[var(--ink-soft)] md:text-[1rem] md:leading-[1.85]";

export default function ShapeComparisonEditorial() {
  return (
    <section
      className="dss-editorial border-t border-[#e4dbcf]/40 bg-[var(--bg)] px-6 py-14 md:px-10 md:py-20"
      aria-labelledby="dss-editorial-heading"
    >
      <div className="mx-auto w-full max-w-[50rem]">
        <h2
          id="dss-editorial-heading"
          className="font-serif text-[1.65rem] font-normal leading-[1.2] tracking-[-0.02em] text-[var(--ink)] md:text-[1.85rem]"
        >
          Shape and scale on your own hand
        </h2>

        <div className={`${introCopy} mt-6 max-w-[46rem] space-y-4 md:mt-8`}>
          <p>
            Comparing shapes on a hand photo helps you judge length, spread, and
            balance before you choose a setting. Carat weight, finger size, and
            outline all change the impression.
          </p>
          <p>
            Use the studio above to preview shapes and carat sizes, then read
            the notes below when you want more context.
          </p>
        </div>

        <div className={DI_V3_STUDIO_ACCORDION_GROUP}>
          <DiV3Chapter
            number="01"
            title="Why compare on your hand"
            note="A personal reference is more useful than a generic size chart."
            chapterId="shape-compare-on-hand"
            studio
          >
            <div className={bodyCopy}>
              <p>
                Generic renderings rarely match your finger proportions. A photo
                of your own hand, with calibrated scale references, gives a
                clearer sense of how round, oval, emerald, and other outlines
                occupy the finger.
              </p>
            </div>
          </DiV3Chapter>

          <DiV3Chapter
            number="02"
            title="Shape changes the outline"
            note="Length, width, and orientation all affect presence."
            chapterId="shape-outline-presence"
            studio
          >
            <div className={bodyCopy}>
              <p>
                Elongated shapes often read longer on the finger than a round
                brilliant at the same carat weight. The goal is not only which
                shape looks largest, but which feels most natural when worn. The{" "}
                <Link href="/diamond-guide/diamond-shapes" className={editorialLink}>
                  diamond shapes guide
                </Link>{" "}
                explains how outlines differ beyond face-up size.
              </p>
            </div>
          </DiV3Chapter>

          <DiV3Chapter
            number="03"
            title="When you are ready to choose"
            note="A preview supports judgment; it does not replace seeing stones in person."
            chapterId="shape-compare-next-step"
            studio
          >
            <div className={bodyCopy}>
              <p>
                This tool is a starting point for proportion and preference. When
                you are ready to discuss options with a Graduate Gemologist, you
                can{" "}
                <Link href="/concierge" className={editorialLink}>
                  begin the conversation
                </Link>{" "}
                at your own pace, or explore{" "}
                <Link href="/diamond-studio" className={editorialLink}>
                  Diamond Size Studio
                </Link>{" "}
                for carat and finger coverage.
              </p>
            </div>
          </DiV3Chapter>
        </div>
      </div>
    </section>
  );
}
