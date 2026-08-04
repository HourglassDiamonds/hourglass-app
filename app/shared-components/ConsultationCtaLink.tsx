"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import {
  buildConciergeHref,
  isBareConciergeHref,
  trackConsultationCtaClicked,
  type BuildConciergeHrefInput,
} from "@/lib/consultation-cta";
import CTAGlimmer from "./motion/CTAGlimmer";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  /** Short standardized CTA location ID (e.g. home:hero). */
  location: string;
  tool?: string | null;
  content?: string | null;
  params?: BuildConciergeHrefInput["params"];
  /**
   * Explicit href. Non-bare Concierge URLs (e.g. Diamond Intelligence context)
   * are preserved. Bare /concierge is replaced by the attributed builder.
   */
  href?: ComponentProps<typeof Link>["href"];
  glimmer?: boolean;
};

function resolveAttributedHref(props: {
  href?: ComponentProps<typeof Link>["href"];
  location: string;
  tool?: string | null;
  content?: string | null;
  params?: BuildConciergeHrefInput["params"];
}): ComponentProps<typeof Link>["href"] {
  if (props.href != null && typeof props.href !== "string") {
    return props.href;
  }

  const explicit = typeof props.href === "string" ? props.href : undefined;
  if (explicit != null && !isBareConciergeHref(explicit)) {
    return explicit;
  }

  return buildConciergeHref({
    tool: props.tool,
    content: props.content,
    params: {
      ...props.params,
      // Durable CTA location for new-tab / copied-link / middle-click.
      location: props.location,
    },
  });
}

/** Concierge CTA with attributed href + canonical GA4 click tracking. */
export default function ConsultationCtaLink({
  location,
  tool,
  content,
  params,
  href,
  glimmer = false,
  onClick,
  ...props
}: Props) {
  const resolvedHref = resolveAttributedHref({
    href,
    location,
    tool,
    content,
    params,
  });

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    trackConsultationCtaClicked(location);
    onClick?.(event);
  };

  const link = (
    <Link href={resolvedHref} onClick={handleClick} {...props} />
  );

  if (glimmer) {
    return <CTAGlimmer>{link}</CTAGlimmer>;
  }

  return link;
}
