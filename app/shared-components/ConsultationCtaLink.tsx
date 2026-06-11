"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import {
  CONSULTATION_DESTINATION,
  trackConsultationCtaClicked,
} from "@/lib/consultation-cta";
import CTAGlimmer from "./motion/CTAGlimmer";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  location: string;
  href?: ComponentProps<typeof Link>["href"];
  glimmer?: boolean;
};

/** Concierge CTA with canonical GA4 click tracking (for server or client pages). */
export default function ConsultationCtaLink({
  location,
  href = CONSULTATION_DESTINATION,
  glimmer = false,
  onClick,
  ...props
}: Props) {
  const link = (
    <Link
      href={href}
      onClick={(event) => {
        trackConsultationCtaClicked(location);
        onClick?.(event);
      }}
      {...props}
    />
  );

  if (glimmer) {
    return <CTAGlimmer>{link}</CTAGlimmer>;
  }

  return link;
}
