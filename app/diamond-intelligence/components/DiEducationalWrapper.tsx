import Link from "next/link";
import {
  DIAMOND_INTELLIGENCE_CERTIFICATION_LINKS,
  DIAMOND_INTELLIGENCE_FAQS,
} from "@/lib/seo/diamond-intelligence-educational";
import { DI_BODY_STUDIO, DI_SERIF_HEADLINE } from "./di-studio-styles";

const editorialLink =
  "text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]";

export default function DiEducationalWrapper() {
  return (
    <section
      className="border-b border-[#e4dbcf]/60 bg-[#f7f1e7] px-5 py-12 md:px-10 md:py-16"
      aria-labelledby="di-educational-heading"
    >
      <div className="mx-auto w-full max-w-[42rem]">
        <h2
          id="di-educational-heading"
          className={`${DI_SERIF_HEADLINE} text-[1.65rem] font-normal leading-[1.2] tracking-[-0.02em] md:text-[1.85rem]`}
        >
          How Diamond Intelligence reads your report
        </h2>

        <div className={`${DI_BODY_STUDIO} mt-10 space-y-12 md:mt-12 md:space-y-14`}>
          <div>
            <h3
              className={`${DI_SERIF_HEADLINE} text-[1.15rem] font-normal leading-[1.3] tracking-[-0.015em] md:text-[1.25rem]`}
            >
              What Diamond Intelligence does
            </h3>
            <div className="mt-4 space-y-4 text-[0.94rem] leading-[1.82] text-[#5f5148] md:text-[1rem] md:leading-[1.85]">
              <p>
                Diamond Intelligence is an independent interpretation layer for
                original diamond grading reports. You upload a PDF from a
                recognized laboratory, and the tool extracts the measurements,
                proportions, and performance signals the report contains—then
                translates them into practical context using Hourglass review
                standards.
              </p>
              <p>
                It is not a listing search, a price engine, or a sales funnel.
                The goal is clearer judgment: understanding what a report
                actually suggests about light behavior, craftsmanship, and
                overall quality before you commit to a stone.
              </p>
            </div>
          </div>

          <div>
            <h3
              className={`${DI_SERIF_HEADLINE} text-[1.15rem] font-normal leading-[1.3] tracking-[-0.015em] md:text-[1.25rem]`}
            >
              Reading GIA, IGI, and GCAL 8X reports
            </h3>
            <div className="mt-4 space-y-4 text-[0.94rem] leading-[1.82] text-[#5f5148] md:text-[1rem] md:leading-[1.85]">
              <p>
                Grading reports use a shared vocabulary—carat, color, clarity,
                cut—but the numbers behind those grades are not self-explanatory.
                Table size, depth, crown and pavilion angles, and optical
                balance all influence how a diamond actually performs in light.
                GIA, IGI, and GCAL 8X each present that data differently.
              </p>
              <p>
                Diamond Intelligence is built to read those documents on their
                own terms: extracting what the laboratory measured and
                interpreting how those measurements may translate in real-world
                viewing. For background on each laboratory&apos;s approach, see
                our guides to{" "}
                <Link
                  href="/diamond-guide/gia-diamond-certification-explained"
                  className={editorialLink}
                >
                  GIA
                </Link>
                ,{" "}
                <Link
                  href="/diamond-guide/igi-diamond-certification-explained"
                  className={editorialLink}
                >
                  IGI
                </Link>
                , and{" "}
                <Link
                  href="/diamond-guide/gcal-8x-diamond-certification-explained"
                  className={editorialLink}
                >
                  GCAL 8X
                </Link>{" "}
                certification—and{" "}
                <Link
                  href="/diamond-guide/how-to-read-a-diamond-certificate"
                  className={editorialLink}
                >
                  how to read a diamond certificate
                </Link>{" "}
                for a walkthrough of what belongs on the page.
              </p>
            </div>
          </div>

          <div>
            <h3
              className={`${DI_SERIF_HEADLINE} text-[1.15rem] font-normal leading-[1.3] tracking-[-0.015em] md:text-[1.25rem]`}
            >
              A report is a starting point—not the final decision
            </h3>
            <div className="mt-4 space-y-4 text-[0.94rem] leading-[1.82] text-[#5f5148] md:text-[1rem] md:leading-[1.85]">
              <p>
                Even an excellent certificate cannot fully describe how a
                diamond moves under different lighting, how inclusions behave at
                distance, or how the stone will feel in your setting. Paper
                grades are useful precisely because they narrow the field—but
                the final choice still depends on seeing the diamond, comparing
                alternatives, and weighing beauty against budget with calm
                judgment.
              </p>
              <p>
                Diamond Intelligence is designed for that earlier stage: when you
                are evaluating a specific report and want a structured second
                opinion before scheduling a viewing or conversation. Pair it
                with the{" "}
                <Link href="/diamond-studio" className={editorialLink}>
                  Diamond Size Studio
                </Link>{" "}
                when size on the hand is part of the question, and with{" "}
                <Link href="/our-approach" className={editorialLink}>
                  our approach
                </Link>{" "}
                when you want to understand how Hourglass evaluates stones in
                person.
              </p>
            </div>
          </div>

          <div>
            <h3
              className={`${DI_SERIF_HEADLINE} text-[1.15rem] font-normal leading-[1.3] tracking-[-0.015em] md:text-[1.25rem]`}
            >
              Graduate Gemologist review and conservative standards
            </h3>
            <div className="mt-4 space-y-4 text-[0.94rem] leading-[1.82] text-[#5f5148] md:text-[1rem] md:leading-[1.85]">
              <p>
                Hourglass Diamonds is led by a Graduate Gemologist with deep
                trade experience. Diamond Intelligence reflects that
                perspective: conservative where the data is ambiguous,
                performance-oriented where proportions matter, and honest about
                what a report can and cannot prove.
              </p>
              <p>
                The tool does not inflate grades or smooth over weak
                craftsmanship signals. When a report raises questions—borderline
                proportions, unclear optical balance, or clarity that deserves
                in-person verification—the interpretation says so plainly. That
                is the same standard applied in private client work at{" "}
                <Link href="/the-house" className={editorialLink}>
                  The House
                </Link>
                . If you would rather talk through a specific stone, you can{" "}
                <Link href="/concierge" className={editorialLink}>
                  begin the conversation
                </Link>{" "}
                without pressure.
              </p>
            </div>
          </div>
        </div>

        <section
          className="mt-14 border-t border-[#e4dbcf]/40 pt-12 md:mt-16 md:pt-14"
          aria-labelledby="di-faq-heading"
        >
          <h2
            id="di-faq-heading"
            className={`${DI_SERIF_HEADLINE} text-[1.35rem] font-normal leading-[1.25] tracking-[-0.02em] md:text-[1.5rem]`}
          >
            Common questions
          </h2>
          <dl className="mt-8 space-y-8 md:mt-10 md:space-y-9">
            {DIAMOND_INTELLIGENCE_FAQS.map(({ question, answer }) => (
              <div key={question}>
                <dt
                  className={`${DI_SERIF_HEADLINE} text-[1.05rem] font-normal leading-[1.35] tracking-[-0.015em] md:text-[1.1rem]`}
                >
                  {question}
                </dt>
                <dd className="mt-2.5 text-[0.94rem] leading-[1.82] text-[#5f5148] md:text-[1rem] md:leading-[1.85]">
                  {answer}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          className="mt-14 border-t border-[#e4dbcf]/40 pt-10 md:mt-16 md:pt-12"
          aria-labelledby="di-cert-reading-heading"
        >
          <h2
            id="di-cert-reading-heading"
            className="text-[9px] font-normal uppercase tracking-[0.38em] text-[#9a9084]"
          >
            Further reading
          </h2>
          <p
            className={`${DI_SERIF_HEADLINE} mt-2 text-[1.15rem] font-normal tracking-[-0.02em] md:text-[1.2rem]`}
          >
            Diamond certification guides
          </p>
          <ul className="mt-6 flex flex-col divide-y divide-[#ebe4da]/50">
            {DIAMOND_INTELLIGENCE_CERTIFICATION_LINKS.map((item) => (
              <li key={item.href} className="py-3.5 first:pt-0">
                <Link
                  href={item.href}
                  className={`${DI_SERIF_HEADLINE} text-[1.02rem] tracking-[-0.01em] text-[#3a3632] no-underline transition-colors duration-300 hover:text-[#1f1d1a]`}
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  );
}
