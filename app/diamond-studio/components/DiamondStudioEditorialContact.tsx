"use client";

import ConsultationCtaLink from "@/app/shared-components/ConsultationCtaLink";
import {
  trackDiamondStudioEvent,
  type DiamondStudioEventProperties,
} from "@/app/diamond-studio/analytics";

type Props = {
  className?: string;
  analyticsProps: DiamondStudioEventProperties;
};

export default function DiamondStudioEditorialContact({
  className,
  analyticsProps,
}: Props) {
  return (
    <ConsultationCtaLink
      location="diamond_studio:editorial"
      tool="diamond-studio"
      className={className}
      onClick={() => {
        trackDiamondStudioEvent(
          "diamond_studio_editorial_contact",
          analyticsProps,
        );
      }}
    >
      Request a comparison or image
    </ConsultationCtaLink>
  );
}
