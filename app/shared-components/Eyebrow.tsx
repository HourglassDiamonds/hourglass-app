import React from "react";

type EyebrowProps = {
  children: React.ReactNode;
  /**
   * `sm` (11px) is the intro/section standard; `xs` (10px) is the quieter
   * in-card / chrome treatment. Both use the canonical 0.34em tracking and
   * `--hg-eyebrow` color.
   */
  size?: "sm" | "xs";
  as?: "div" | "p" | "span";
  className?: string;
};

const SIZE_CLASS: Record<NonNullable<EyebrowProps["size"]>, string> = {
  sm: "text-[11px]",
  xs: "text-[10px]",
};

/**
 * Canonical Hourglass eyebrow label.
 * Consolidates the hand-rolled `text-[10/11px] uppercase tracking-[0.34em]
 * text-[#6d655e]` pattern (283 call sites at audit time). Pass `className`
 * for contextual color/tracking overrides (e.g. dark surfaces) rather than
 * adding variants here.
 */
export default function Eyebrow({
  children,
  size = "sm",
  as: Tag = "div",
  className,
}: EyebrowProps) {
  return (
    <Tag
      className={`${SIZE_CLASS[size]} uppercase tracking-[0.34em] text-hg-eyebrow${
        className ? ` ${className}` : ""
      }`}
    >
      {children}
    </Tag>
  );
}
