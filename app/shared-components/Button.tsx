"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

/**
 * Canonical Hourglass CTA pill.
 *
 * Variants preserve the two dominant hand-rolled recipes found in the
 * July 2026 cohesion audit, with one accessibility correction: focus uses
 * `:focus-visible` and the compliant `--hg-focus` ring (WCAG 1.4.11).
 *
 * - `primary`   — charcoal fill (engagement-rings / custom-design CTA family)
 * - `secondary` — ivory outline (homepage hero family)
 *
 * Renders a Next.js `Link` when `href` is provided, otherwise a `<button>`.
 * Keep analytics handlers (e.g. `trackConsultationCtaClicked`) at the call
 * site via `onClick` so tracking locations stay explicit.
 */

const BASE_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hg-focus focus-visible:ring-offset-2 focus-visible:ring-offset-hg-ivory";

const VARIANT_CLASS = {
  primary:
    "bg-hg-charcoal px-7 py-3 text-sm tracking-[0.08em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-300 hover:opacity-95 hover:shadow-[0_2px_6px_rgba(0,0,0,0.12)]",
  secondary:
    "border border-hg-line-strong bg-white/80 px-6 py-3 text-[11px] uppercase tracking-[0.28em] text-hg-charcoal transition-all duration-500 ease-out hover:-translate-y-[1px] hover:bg-white",
} as const;

type Variant = keyof typeof VARIANT_CLASS;

type CommonProps = {
  variant?: Variant;
  className?: string;
  children: ReactNode;
};

type ButtonAsLink = CommonProps & { href: string } & Omit<
    ComponentPropsWithoutRef<typeof Link>,
    "href" | "className" | "children"
  >;

type ButtonAsButton = CommonProps & { href?: undefined } & Omit<
    ComponentPropsWithoutRef<"button">,
    "className" | "children"
  >;

export type ButtonProps = ButtonAsLink | ButtonAsButton;

export default function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = `${BASE_CLASS} ${VARIANT_CLASS[variant]}${
    className ? ` ${className}` : ""
  }`;

  if (typeof rest.href === "string") {
    const linkProps = rest as Omit<ButtonAsLink, keyof CommonProps> & {
      href: string;
    };
    return (
      <Link {...linkProps} className={classes}>
        {children}
      </Link>
    );
  }

  const buttonProps = rest as Omit<ButtonAsButton, keyof CommonProps>;
  return (
    <button
      type={buttonProps.type ?? "button"}
      {...buttonProps}
      className={`${classes} disabled:cursor-not-allowed disabled:opacity-70`}
    >
      {children}
    </button>
  );
}
