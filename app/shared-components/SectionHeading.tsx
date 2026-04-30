import React from "react";

type SectionHeadingProps = {
  title: string;
  description?: string;
  align?: "center" | "left";
  eyebrow?: string;
};

export default function SectionHeading({
  title,
  description,
  align = "center",
  eyebrow,
}: SectionHeadingProps) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto mb-14 max-w-3xl text-center"
          : "mb-14 max-w-2xl"
      }
    >
      {eyebrow ? (
        <div className="mb-4 text-[11px] uppercase tracking-[0.34em] text-[#8a8177]">
          {eyebrow}
        </div>
      ) : null}

      <h2 className="text-[2rem] font-light leading-[1.12] tracking-[0.015em] text-[#1f1d1a] md:text-[2.45rem]">
        {title}
      </h2>

      {description ? (
        <p className="mt-5 text-base leading-8 text-[#6a635c] md:text-lg">
          {description}
        </p>
      ) : null}
    </div>
  );
}