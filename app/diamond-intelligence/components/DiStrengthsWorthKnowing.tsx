"use client";

import {
  DI_BODY,
  DI_EYEBROW,
  DI_HEADLINE_SERIF,
  DI_SECTION,
} from "./di-editorial-classes";

export default function DiStrengthsWorthKnowing({
  strengths,
  worthKnowing,
}: {
  strengths: string[];
  worthKnowing: string[];
}) {
  if (strengths.length === 0 && worthKnowing.length === 0) return null;

  return (
    <section className={DI_SECTION}>
      <div className="grid gap-12 md:grid-cols-2 md:gap-16 lg:gap-24">
        {strengths.length > 0 ? (
          <div>
            <p className={DI_EYEBROW}>Strengths</p>
            <h3
              className={`${DI_HEADLINE_SERIF} mt-4 text-[1.35rem] md:text-[1.45rem]`}
            >
              What reads well on paper
            </h3>
            <ul className="mt-6 space-y-3.5">
              {strengths.map((item) => (
                <li
                  key={item}
                  className={`${DI_BODY} flex gap-3 text-[0.98rem]`}
                >
                  <span
                    className="mt-[0.55em] shrink-0 text-[#a8926a]"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {worthKnowing.length > 0 ? (
          <div>
            <p className={DI_EYEBROW}>Worth Knowing</p>
            <h3
              className={`${DI_HEADLINE_SERIF} mt-4 text-[1.35rem] md:text-[1.45rem]`}
            >
              Before you buy
            </h3>
            <ul className="mt-6 space-y-3.5">
              {worthKnowing.map((item) => (
                <li
                  key={item}
                  className={`${DI_BODY} flex gap-3 text-[0.98rem]`}
                >
                  <span
                    className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-[#948a80]"
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
