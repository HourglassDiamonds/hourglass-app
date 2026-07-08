"use client";

import { event as gtagEvent } from "@/lib/gtag";
import { CUSTOM_DESIGN_MEDIA } from "./custom-design-media-config";

export default function CustomDesignMotionLink() {
  return (
    <p className="mt-4">
      <a
        href={CUSTOM_DESIGN_MEDIA.finishedMotionUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View the finished pear-shaped engagement ring in motion"
        className="text-[0.94rem] text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#cbbda9] focus-visible:ring-offset-2 focus-visible:ring-offset-[#efe8de]"
        onClick={() => {
          try {
            gtagEvent("custom_design_motion_clicked", {
              location: "custom_design:finished_piece",
              destination: "gembox",
              page_path: "/custom-design",
            });
          } catch {
            /* provider missing or blocked */
          }
        }}
      >
        View the finished piece in motion →
      </a>
    </p>
  );
}
