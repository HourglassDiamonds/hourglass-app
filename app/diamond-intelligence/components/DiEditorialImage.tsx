"use client";

import Image from "next/image";
import { useState } from "react";
import {
  DI_IMAGERY,
  resolveImageSpec,
  resolveImageSrc,
  type DiImageSlot,
} from "./di-editorial-imagery";

export type DiEditorialImageVariant = "hero" | "notice" | "watermark";

const VARIANT_STYLES: Record<
  DiEditorialImageVariant,
  { frame: string; image: string; sizes: string }
> = {
  hero: {
    frame:
      "relative overflow-hidden bg-[#faf8f5] ring-1 ring-inset ring-[#ebe4da]/30",
    image: "object-contain p-6 md:p-8 lg:p-10",
    sizes: "(max-width: 1024px) 100vw, 42vw",
  },
  notice: {
    frame:
      "relative mt-4 overflow-hidden rounded-lg bg-[#faf8f5] ring-1 ring-[#ebe4da]/35",
    image: "object-cover",
    sizes: "(max-width: 768px) 100vw, 200px",
  },
  watermark: {
    frame: "pointer-events-none absolute inset-0 flex items-center justify-center",
    image: "object-contain opacity-[0.06]",
    sizes: "240px",
  },
};

function heroImageryEnabled(): boolean {
  return DI_IMAGERY.enableHeroImagery;
}

function slotImageryEnabled(variant: DiEditorialImageVariant): boolean {
  if (variant === "hero") return heroImageryEnabled();
  return DI_IMAGERY.enableEditorialImagery;
}

export default function DiEditorialImage({
  slot,
  variant,
  className = "",
  objectPosition,
}: {
  slot: DiImageSlot;
  variant: DiEditorialImageVariant;
  className?: string;
  objectPosition?: string;
}) {
  if (!slotImageryEnabled(variant)) {
    return null;
  }

  const spec = resolveImageSpec(slot);
  const styles = VARIANT_STYLES[variant];
  const [src, setSrc] = useState(() => resolveImageSrc(spec));
  const isDecorative = variant === "watermark" || spec.alt === "";

  return (
    <div
      className={`${styles.frame} ${className}`}
      style={
        variant === "hero"
          ? { minHeight: 240 }
          : variant === "notice"
            ? { minHeight: 120 }
            : undefined
      }
    >
      <Image
        src={src}
        alt={isDecorative ? "" : spec.alt}
        fill
        priority={spec.priority}
        sizes={styles.sizes}
        className={styles.image}
        style={{
          objectPosition: objectPosition ?? spec.objectPosition ?? "center",
        }}
        onError={() => {
          if (src !== spec.fallbackSrc) setSrc(spec.fallbackSrc);
        }}
      />
    </div>
  );
}
