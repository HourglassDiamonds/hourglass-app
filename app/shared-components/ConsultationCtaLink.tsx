"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import {
  CONSULTATION_DESTINATION,
  trackConsultationCtaClicked,
} from "@/lib/consultation-cta";

type Props = Omit<ComponentProps<typeof Link>, "href"> & {
  location: string;
  href?: ComponentProps<typeof Link>["href"];
};

/** Concierge CTA with canonical GA4 click tracking (for server or client pages). */
export default function ConsultationCtaLink({
  location,
  href = CONSULTATION_DESTINATION,
  onClick,
  ...props
}: Props) {
  return (
    <Link
      href={href}
      onClick={(event) => {
        trackConsultationCtaClicked(location);
        onClick?.(event);
      }}
      {...props}
    />
  );
}
