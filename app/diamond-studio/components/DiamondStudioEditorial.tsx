import Link from "next/link";
import DiV3Chapter from "@/app/diamond-intelligence/components/DiV3Chapter";
import {
  DI_V3_FAQ_ACCORDION_GROUP,
  DI_V3_STUDIO_ACCORDION_GROUP,
} from "@/app/diamond-intelligence/components/di-v3-styles";

const editorialLink =
  "text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]";

const bodyCopy =
  "space-y-4 text-[0.94rem] leading-[1.82] text-[var(--ink-soft)] md:text-[1rem] md:leading-[1.85]";

const introCopy =
  "text-[0.94rem] leading-[1.82] text-[var(--ink-soft)] md:text-[1rem] md:leading-[1.85]";

const STUDIO_FAQS = [
  {
    question: "What is the Size Studio?",
    answer:
      "The Size Studio is an interactive tool that helps you compare how different diamond carat weights, shapes, and ring sizes appear on the finger.",
  },
  {
    question: "Why do diamonds of the same carat weight look different?",
    answer:
      "Carat measures weight, not visible size. Shape, proportions, depth, table size, and cut quality can all affect how large a diamond appears from the top.",
  },
  {
    question: "Does finger size change how big a diamond looks?",
    answer:
      "Yes. The same diamond can look more substantial on a smaller finger and more restrained on a larger finger because the overall finger coverage changes.",
  },
  {
    question: "Which diamond shapes look largest for their carat weight?",
    answer:
      "Elongated shapes such as oval, marquise, pear, radiant, and emerald cuts can often appear larger or longer on the finger than a round diamond of the same carat weight, though beauty and proportion still matter.",
  },
] as const;

export default function DiamondStudioEditorial() {
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
          How diamond size really looks on the hand
        </h2>

        <div className={`${introCopy} mt-6 max-w-[46rem] space-y-4 md:mt-8`}>
          <p>
            Carat weight tells only part of the story. Shape, proportions, finger
            size, and visual spread all influence how substantial a diamond
            appears once it is worn.
          </p>
          <p>
            Use the studio above to compare scale, then explore the guidance
            below for the factors that shape that impression.
          </p>
        </div>

        <div className={DI_V3_STUDIO_ACCORDION_GROUP}>
          <DiV3Chapter
            number="01"
            title="Carat Weight Is Not Visual Size"
            note="Why two diamonds of the same weight can look very different."
            chapterId="carat-weight-not-visual-size"
            studio
            defaultOpen
          >
            <div className={bodyCopy}>
              <p>
                Carat measures weight, not what you see when the diamond is set.
                Two stones at the same carat can face up quite differently
                depending on shape, depth, table size, proportions, and cut
                quality. A well-proportioned diamond spreads its weight where
                light enters and returns. A deep stone can carry weight below the
                girdle where it adds little to the view from above.
              </p>
              <p>
                That distinction matters when you are comparing listings or
                trying to picture scale before an appointment. The number on a
                certificate is useful. It is not the same as visual size on the
                finger.{" "}
                <Link href="/diamond-guide/diamond-carat-vs-size" className={editorialLink}>
                  Carat versus visible size
                </Link>{" "}
                explains the difference in more detail, and{" "}
                <Link href="/diamond-guide/what-is-diamond-cut" className={editorialLink}>
                  how cut affects light performance
                </Link>{" "}
                explains why beauty should not be traded for spread alone. When
                you have a report in hand,{" "}
                <Link href="/diamond-intelligence" className={editorialLink}>
                  Analyze Sparkle
                </Link>{" "}
                can help translate proportions into practical context.
              </p>
            </div>
          </DiV3Chapter>

          <DiV3Chapter
            number="02"
            title="Finger Size Changes the Impression"
            note="The same diamond can feel subtle or substantial depending on the hand."
            chapterId="finger-size-changes-impression"
            studio
          >
            <div className={bodyCopy}>
              <p>
                The same diamond can read differently on a size 4 finger than on
                a size 8. Finger width, length, and overall proportion all
                influence balance. A two-carat stone may feel substantial on a
                narrower finger and more restrained on a wider one, even though
                the measurements are unchanged.
              </p>
              <p>
                Ring size is part of that picture, not a separate detail. When
                you adjust ring size in the studio, you are seeing how finger
                coverage shifts: how much of the hand the stone occupies, and
                whether the look feels quiet, balanced, or bold. There is no
                universal right answer. What feels harmonious on one hand may
                feel heavy or understated on another.
              </p>
              <p>
                Trying a few ring sizes alongside your preferred carat and shape
                is one of the simplest ways to avoid surprises later. The goal
                is not to chase the largest possible look. It is to find a
                combination that feels natural when you imagine wearing it every
                day.
              </p>
            </div>
          </DiV3Chapter>

          <DiV3Chapter
            number="03"
            title="Shape Changes Apparent Size"
            note="Length, width, outline, and orientation all affect visual spread."
            chapterId="shape-changes-apparent-size"
            studio
          >
            <div className={bodyCopy}>
              <p>
                Shape changes the outline you see from above. Elongated cuts such
                as oval, marquise, pear, emerald, and radiant often stretch
                across the finger differently than a round brilliant of the same
                carat weight. They may appear longer, broader, or more
                substantial depending on length-to-width ratio and how the stone
                is oriented north-south or east-west.
              </p>
              <p>
                Each shape also creates a different kind of presence. A round
                tends to feel balanced and classic. An emerald cut reads
                architectural and quiet. A cushion can feel soft and generous. A
                marquise draws the eye along the finger. Those differences are
                not only about which shape looks largest. They are about which
                shape looks most like you.
              </p>
              <p>
                The studio lets you compare round, oval, emerald, cushion, pear,
                marquise, radiant, princess, and Asscher outlines at the same
                carat before you commit to a direction. For fundamentals on how
                shapes differ beyond face-up size, the{" "}
                <Link href="/diamond-guide/diamond-shapes" className={editorialLink}>
                  diamond shapes guide
                </Link>{" "}
                is a useful companion.
              </p>
            </div>
          </DiV3Chapter>

          <DiV3Chapter
            number="04"
            title="Finger Coverage, Spread, and Balance"
            note="Presence is about proportion, not simply choosing the largest stone."
            chapterId="finger-coverage-spread-balance"
            studio
          >
            <div className={bodyCopy}>
              <p>
                Finger coverage describes how much of the hand a diamond
                occupies when worn: the visible spread relative to finger width,
                setting style, and band proportion. A larger-looking stone is
                not automatically the better choice. Coverage that overwhelms the
                hand can feel less comfortable over time. Coverage that feels too
                restrained may not match the presence you had in mind.
              </p>
              <p>
                Band width, setting height, and metal color also shift the
                impression once the ring is finished. A wide band can make a
                center stone appear slightly smaller. A delicate band can make
                the same stone feel more prominent. Those details belong in the
                conversation early, especially when the ring will be custom.
              </p>
              <p>
                At Hourglass, we guide clients toward proportion, comfort,
                durability, and long-term wearability rather than maximum
                face-up diameter alone.{" "}
                <Link href="/custom-design" className={editorialLink}>
                  Custom design
                </Link>{" "}
                is where those choices are resolved in the metal, and{" "}
                <Link href="/our-approach" className={editorialLink}>
                  our approach
                </Link>{" "}
                explains how selective sourcing and trained judgment support
                that process.
              </p>
            </div>
          </DiV3Chapter>

          <DiV3Chapter
            number="05"
            title="Use the Studio as a Starting Point"
            note="A useful preview, not a substitute for seeing a diamond in person."
            chapterId="use-studio-as-starting-point"
            studio
          >
            <div className={bodyCopy}>
              <p>
                The Size Studio helps you understand scale before you
                choose a stone: how carat, shape, ring size, and orientation
                interact on the hand. It is a useful preview. It is not a
                substitute for seeing diamonds move under light, comparing
                stones side by side, or evaluating how a specific stone behaves
                in the setting you have in mind.
              </p>
              <p>
                Real selection still depends on cut quality, light performance,
                measurements, beauty, and personal taste. Color and clarity
                matter in ways a size preview cannot show. If you are building
                fundamentals first, the{" "}
                <Link href="/diamond-guide" className={editorialLink}>
                  Diamond Guide
                </Link>{" "}
                covers carat, shape, cut, clarity, and color without the noise
                of a typical jewelry blog.
              </p>
              <p>
                When you are ready to move from preview to plan,{" "}
                <Link href="/engagement-rings" className={editorialLink}>
                  engagement rings
                </Link>{" "}
                is the natural next step. If you would rather talk through
                proportions and options with a Graduate Gemologist, you can{" "}
                <Link href="/concierge" className={editorialLink}>
                  begin the conversation
                </Link>{" "}
                at your own pace.
              </p>
            </div>
          </DiV3Chapter>
        </div>

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
            {STUDIO_FAQS.map(({ question, answer }, index) => (
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
      </div>
    </section>
  );
}
