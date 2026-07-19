import React from "react";
import Eyebrow from "./Eyebrow";

type SectionHeadingProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  /** Heading level — pages use `h1` for intros, `h2` for sections. */
  as?: "h1" | "h2";
  align?: "center" | "left";
  /** Wrapper spacing/width hooks (e.g. `mb-14 max-w-3xl`). */
  className?: string;
  /** Title-only hooks (e.g. `max-w-[14ch]`). */
  titleClassName?: string;
};

/**
 * Canonical Hourglass intro/section heading: eyebrow + light display title
 * (+ optional description). Matches the dominant hand-rolled pattern on
 * concierge / engagement-rings / custom-design intros. Unlike the previous
 * version, spacing below the block is owned by the caller.
 */
export default function SectionHeading({
  title,
  eyebrow,
  description,
  as: Heading = "h2",
  align = "left",
  className,
  titleClassName,
}: SectionHeadingProps) {
  return (
    <div
      className={`${align === "center" ? "mx-auto text-center" : ""}${
        className ? ` ${className}` : ""
      }`}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}

      <Heading
        className={`${eyebrow ? "mt-4 " : ""}text-[2rem] font-light leading-[1.1] tracking-[0.015em] text-hg-ink md:text-[2.45rem]${
          titleClassName ? ` ${titleClassName}` : ""
        }`}
        style={{ textWrap: "balance" }}
      >
        {title}
      </Heading>

      {description ? (
        <p className="mt-5 max-w-[32rem] text-[1rem] leading-[1.88] text-[#6a635c]">
          {description}
        </p>
      ) : null}
    </div>
  );
}
