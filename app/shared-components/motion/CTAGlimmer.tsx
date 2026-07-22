"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  type ReactElement,
} from "react";
import { useReducedMotion } from "./useReducedMotion";

type CTAGlimmerProps = {
  children: ReactElement;
  /**
   * - `pill` — rounded CTA pills (default).
   * - `rect` — rectangular CTAs (e.g. "Read Our Approach").
   * - `text` — inline text links (Diamond Studio editorial CTA).
   */
  variant?: "pill" | "rect" | "text";
  /**
   * Priority CTA — receives the page's single autonomous glimmer pass:
   * one pass, after the page has settled (~2.2s) and the CTA is actually
   * in view, never looping. At most one CTA wins per page view; every
   * other CTAGlimmer instance only responds to hover/focus with a shorter
   * restrained pass.
   */
  priority?: boolean;
};

/** Delay before the one autonomous pass — lets the page settle first. */
const AUTONOMOUS_DELAY_MS = 2_200;

/**
 * Module-level claim so at most one CTA self-animates per page view,
 * even if several are marked `priority` by mistake.
 */
let autonomousClaimed = false;

export default function CTAGlimmer({
  children,
  variant = "pill",
  priority = false,
}: CTAGlimmerProps) {
  const reduced = useReducedMotion();
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced || !priority || autonomousClaimed) return;

    autonomousClaimed = true;

    const node = wrapperRef.current;
    if (!node) return;

    let settled = false;
    let visible = false;
    let fired = false;

    const fireIfReady = () => {
      if (fired || !settled || !visible) return;
      fired = true;
      node.classList.add("cta-glimmer--active");
      observer.disconnect();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        fireIfReady();
      },
      { threshold: 0.6 },
    );

    const timeoutId = window.setTimeout(() => {
      settled = true;
      fireIfReady();
    }, AUTONOMOUS_DELAY_MS);

    observer.observe(node);

    return () => {
      window.clearTimeout(timeoutId);
      observer.disconnect();
      /* Release the claim on unmount (client-side navigation) so the next
         page view can still have its one autonomous pass. While mounted
         the claim holds, so the pass can never repeat in a page view. */
      autonomousClaimed = false;
    };
  }, [reduced, priority]);

  if (reduced) return children;

  const respondToIntent = () => {
    const node = wrapperRef.current;
    if (!node) return;
    if (
      node.classList.contains("cta-glimmer--hover") ||
      node.classList.contains("cta-glimmer--active")
    ) {
      return;
    }
    node.classList.add("cta-glimmer--hover");
  };

  const clearPass = () => {
    const node = wrapperRef.current;
    if (!node) return;
    node.classList.remove("cta-glimmer--hover");
    node.classList.remove("cta-glimmer--active");
  };

  const variantClass =
    variant === "text"
      ? "cta-glimmer--text"
      : variant === "rect"
        ? "cta-glimmer--rect"
        : "cta-glimmer--pill";

  const childOverlayClass =
    variant === "text"
      ? "relative z-[1]"
      : variant === "rect"
        ? "relative z-[1] overflow-hidden"
        : "relative z-[1] overflow-hidden rounded-full";

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ className?: string }>, {
        className: [
          (children.props as { className?: string }).className,
          childOverlayClass,
        ]
          .filter(Boolean)
          .join(" "),
      })
    : children;

  return (
    <span
      ref={wrapperRef}
      className={`cta-glimmer ${variantClass}`}
      onMouseEnter={respondToIntent}
      onFocus={respondToIntent}
      onAnimationEnd={clearPass}
    >
      {child}
    </span>
  );
}
