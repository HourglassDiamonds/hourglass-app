"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ROUND_CAD_SCINTILLATION_MIN_INTERVAL_MS,
  ROUND_CAD_SCINTILLATION_VARIANTS,
} from "./round-cad-light";

function usePrefersReducedMotion(): boolean {
  return React.useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function VariantSlot({
  src,
  visible,
}: {
  src: string;
  visible: boolean;
}) {
  return (
    <div
      className={`dts-rbc-cad-variant-slot${visible ? " is-visible" : ""}`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="dts-rbc-cad-variant-face" />
    </div>
  );
}

/**
 * Crossfades between contrast-shift variant PNGs when carat changes, with a
 * minimum interval between visible pattern advances. Idle reveals base image.
 */
export default function RoundCadScintillation({
  active,
  carat,
}: {
  active: boolean;
  carat: number;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const lastCaratRef = useRef(carat);
  const patternIndexRef = useRef(-1);
  const lastAdvanceAtRef = useRef(0);
  const frontRef = useRef<"a" | "b">("b");
  const [slotA, setSlotA] = useState({ variant: 0, visible: false });
  const [slotB, setSlotB] = useState({ variant: 0, visible: false });
  const [patternIndex, setPatternIndex] = useState(-1);

  const showPattern = useCallback(
    (nextIndex: number) => {
      if (reducedMotion) {
        setPatternIndex(nextIndex);
        setSlotA({ variant: nextIndex, visible: true });
        setSlotB({ variant: nextIndex, visible: false });
        frontRef.current = "a";
        return;
      }

      if (frontRef.current === "a") {
        frontRef.current = "b";
        setSlotB({ variant: nextIndex, visible: true });
        setSlotA((s) => ({ ...s, visible: false }));
      } else {
        frontRef.current = "a";
        setSlotA({ variant: nextIndex, visible: true });
        setSlotB((s) => ({ ...s, visible: false }));
      }
      setPatternIndex(nextIndex);
    },
    [reducedMotion],
  );

  useEffect(() => {
    if (!active) {
      const frame = requestAnimationFrame(() => {
        setSlotA((s) => ({ ...s, visible: false }));
        setSlotB((s) => ({ ...s, visible: false }));
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [active]);

  useEffect(() => {
    if (Math.abs(carat - lastCaratRef.current) < 0.001) return;
    lastCaratRef.current = carat;
    if (!active) return;

    const now = Date.now();
    const isFirst = patternIndexRef.current < 0;
    const elapsed = now - lastAdvanceAtRef.current;
    if (
      !isFirst &&
      elapsed < ROUND_CAD_SCINTILLATION_MIN_INTERVAL_MS
    ) {
      return;
    }

    const next = isFirst
      ? 0
      : (patternIndexRef.current + 1) % ROUND_CAD_SCINTILLATION_VARIANTS.length;
    patternIndexRef.current = next;
    lastAdvanceAtRef.current = now;
    const frame = requestAnimationFrame(() => showPattern(next));
    return () => cancelAnimationFrame(frame);
  }, [carat, active, showPattern]);

  return (
    <div
      className="dts-rbc-cad-scintillation"
      data-rbc-scintillation-active={active ? "true" : "false"}
      data-rbc-scintillation-pattern={
        patternIndex >= 0 ? patternIndex : "idle"
      }
      aria-hidden
    >
      <VariantSlot
        src={ROUND_CAD_SCINTILLATION_VARIANTS[slotA.variant]!}
        visible={slotA.visible}
      />
      <VariantSlot
        src={ROUND_CAD_SCINTILLATION_VARIANTS[slotB.variant]!}
        visible={slotB.visible}
      />
    </div>
  );
}
