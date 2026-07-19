"use client";

import Image from "next/image";
import { event as gtagEvent } from "@/lib/gtag";
import {
  CUSTOM_DESIGN_ALT,
  CUSTOM_DESIGN_MEDIA,
} from "./custom-design-media-config";

const MEDIA_PANEL_CLASS =
  "group relative block aspect-square w-full overflow-hidden rounded-[22px] border border-[#ddd3c6] bg-[#f5f0e9] transition-[border-color,box-shadow] duration-300 hover:border-[#cfc4b4] hover:shadow-[0_10px_28px_-14px_rgba(31,29,26,0.14)] focus:outline-none focus-visible:ring-2 focus-visible:ring-hg-focus focus-visible:ring-offset-2 focus-visible:ring-offset-hg-ivory";

const MEDIA_WASH_CLASS =
  "pointer-events-none absolute inset-0 bg-[#f5f0e9] mix-blend-multiply";

const MEDIA_SIZES =
  "(max-width: 768px) 100vw, (max-width: 1280px) 36vw, 420px";

export default function CustomDesignFinishedPieceCard() {
  return (
    <a
      href={CUSTOM_DESIGN_MEDIA.finishedMotionUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View the finished custom ring video"
      className={MEDIA_PANEL_CLASS}
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
      <Image
        src={CUSTOM_DESIGN_MEDIA.finishedStill}
        alt={CUSTOM_DESIGN_ALT.finishedStill}
        fill
        quality={95}
        sizes={MEDIA_SIZES}
        className="object-cover object-center p-6 sm:p-7 lg:p-8 transition-[transform,opacity] duration-500 group-hover:opacity-[0.97]"
      />
      <div aria-hidden className={MEDIA_WASH_CLASS} />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-5 right-5 z-10 inline-flex items-center rounded-full border border-[#d9cfc2]/90 bg-[#f5f0e9]/88 px-2.5 py-1 text-[0.74rem] tracking-[0.02em] text-[#5f5851] shadow-[0_1px_3px_rgba(31,29,26,0.05)] backdrop-blur-[4px] transition-[border-color,background-color,color,box-shadow] duration-300 group-hover:border-[#cfc4b4] group-hover:bg-[#faf6f0]/92 group-hover:text-[#4a4440] group-hover:shadow-[0_2px_6px_rgba(31,29,26,0.07)]"
      >
        View Video →
      </span>
    </a>
  );
}
