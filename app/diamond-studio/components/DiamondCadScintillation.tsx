"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CAD_SCINTILLATION_MIN_INTERVAL_MS } from "./diamond-cad-light";
import {
  computeScintillationAdvance,
  resetScintillationState,
  type ScintillationFront,
  type ScintillationSlot,
} from "./diamond-cad-scintillation-state";

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

function VariantSlot({ src, visible }: { src: string; visible: boolean }) {
  return (
    <div
      className={`dts-cad-variant-slot${visible ? " is-visible" : ""}`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" className="dts-cad-variant-face" />
    </div>
  );
}

/**
 * Crossfades between contrast-shift variant PNGs when carat changes, with a
 * minimum interval between visible pattern advances. Idle reveals base image.
 */
export default function DiamondCadScintillation({
  active,
  carat,
  variants,
  shapeId,
}: {
  active: boolean;
  carat: number;
  variants: readonly string[];
  shapeId: string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const lastCaratRef = useRef(carat);
  const patternIndexRef = useRef(-1);
  const lastAdvanceAtRef = useRef(0);
  const frontRef = useRef<ScintillationFront>("b");
  const [slotA, setSlotA] = useState<ScintillationSlot>({
    variant: 0,
    visible: false,
  });
  const [slotB, setSlotB] = useState<ScintillationSlot>({
    variant: 0,
    visible: false,
  });
  const [patternIndex, setPatternIndex] = useState(-1);

  useEffect(() => {
    const reset = resetScintillationState();
    patternIndexRef.current = reset.patternIndex;
    lastAdvanceAtRef.current = reset.lastAdvanceAt;
    frontRef.current = reset.front;
    lastCaratRef.current = carat;
    setSlotA(reset.slotA);
    setSlotB(reset.slotB);
    setPatternIndex(reset.patternIndex);
    // Reset only when the shape (variant stack) changes — not on every carat tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeId]);

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
    const result = computeScintillationAdvance({
      active,
      carat,
      lastCarat: lastCaratRef.current,
      patternIndex: patternIndexRef.current,
      lastAdvanceAt: lastAdvanceAtRef.current,
      now: Date.now(),
      variantCount: variants.length,
      minIntervalMs: CAD_SCINTILLATION_MIN_INTERVAL_MS,
    });
    lastCaratRef.current = carat;
    if (!result.accepted) return;

    patternIndexRef.current = result.patternIndex;
    lastAdvanceAtRef.current = result.lastAdvanceAt;
    const frame = requestAnimationFrame(() => showPattern(result.nextIndex));
    return () => cancelAnimationFrame(frame);
  }, [carat, active, showPattern, variants.length]);

  const srcA = variants[slotA.variant] ?? variants[0]!;
  const srcB = variants[slotB.variant] ?? variants[0]!;

  return (
    <div
      className="dts-cad-scintillation"
      data-cad-scintillation-active={active ? "true" : "false"}
      data-cad-scintillation-pattern={patternIndex >= 0 ? patternIndex : "idle"}
      data-cad-shape={shapeId}
      aria-hidden
    >
      <VariantSlot src={srcA} visible={slotA.visible} />
      <VariantSlot src={srcB} visible={slotB.visible} />
    </div>
  );
}
