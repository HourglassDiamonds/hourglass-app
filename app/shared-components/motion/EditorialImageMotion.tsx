"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Editorial image micro-motion — Pass 3.5.
 *
 * One restrained treatment per flagship image (roughly one per page):
 *
 * - `drift` — ambient optical drift. Scale ~1.2% over ~16s, alternating,
 *   pure CSS (see `hg-image-motion` in globals.css). Paused while offscreen
 *   and disabled on mobile / reduced motion.
 * - `light` — perspective light response. Tiny pointer-dependent movement
 *   (max ±4px), heavily damped, desktop pointer devices only. rAF runs only
 *   while the image is onscreen and movement is unsettled.
 *
 * Never applied to product thumbnails, calibrated imagery, uploads, CAD
 * renders, or anything where perceived accuracy matters.
 */

type EditorialImageMotionProps = {
  children: ReactNode;
  mode?: "drift" | "light";
  className?: string;
};

const LIGHT_MAX_PX = 4;
const LIGHT_DAMPING = 0.055;
const SETTLE_EPSILON = 0.02;

const DESKTOP_POINTER_QUERY =
  "(min-width: 768px) and (hover: hover) and (pointer: fine)";

export default function EditorialImageMotion({
  children,
  mode = "drift",
  className = "",
}: EditorialImageMotionProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);

  /* Drift — CSS-driven; JS only gates play state to the viewport. */
  useEffect(() => {
    if (mode !== "drift" || reduced) return;

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        node.classList.toggle("hg-image-motion--running", entry.isIntersecting);
      },
      { threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [mode, reduced]);

  /* Light — damped pointer response, desktop only. */
  useEffect(() => {
    if (mode !== "light" || reduced) return;

    const node = ref.current;
    if (!node) return;

    const media = window.matchMedia(DESKTOP_POINTER_QUERY);

    let raf = 0;
    let onscreen = false;
    let enabled = media.matches;
    const current = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };

    const step = () => {
      current.x += (target.x - current.x) * LIGHT_DAMPING;
      current.y += (target.y - current.y) * LIGHT_DAMPING;

      const settled =
        Math.abs(target.x - current.x) < SETTLE_EPSILON &&
        Math.abs(target.y - current.y) < SETTLE_EPSILON;

      node.style.transform = `translate3d(${current.x.toFixed(2)}px, ${current.y.toFixed(2)}px, 0)`;

      if (settled) {
        current.x = target.x;
        current.y = target.y;
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(step);
    };

    const wake = () => {
      if (!raf) raf = requestAnimationFrame(step);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!onscreen || !enabled) return;
      const rect = node.getBoundingClientRect();
      const nx = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
      const ny = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
      target.x = Math.max(-1, Math.min(1, nx * 2)) * LIGHT_MAX_PX;
      target.y = Math.max(-1, Math.min(1, ny * 2)) * LIGHT_MAX_PX;
      wake();
    };

    const rest = () => {
      target.x = 0;
      target.y = 0;
      wake();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        onscreen = entry.isIntersecting;
        if (!onscreen) rest();
      },
      { threshold: 0.05 },
    );

    const onMediaChange = () => {
      enabled = media.matches;
      if (!enabled) rest();
    };

    observer.observe(node);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", rest);
    media.addEventListener("change", onMediaChange);

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", rest);
      media.removeEventListener("change", onMediaChange);
      cancelAnimationFrame(raf);
      node.style.transform = "";
    };
  }, [mode, reduced]);

  const modeClass =
    mode === "drift" ? "hg-image-motion hg-image-motion--drift" : "";

  return (
    <div
      ref={ref}
      className={`${modeClass}${className ? ` ${className}` : ""}`}
      aria-hidden={undefined}
    >
      {children}
    </div>
  );
}
