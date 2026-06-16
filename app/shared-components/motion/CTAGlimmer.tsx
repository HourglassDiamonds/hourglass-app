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
  /** Pill buttons vs inline text links (Diamond Studio editorial CTA). */
  variant?: "pill" | "text";
};

const MIN_INTERVAL_MS = 20_000;
const MAX_INTERVAL_MS = 30_000;

export default function CTAGlimmer({
  children,
  variant = "pill",
}: CTAGlimmerProps) {
  const reduced = useReducedMotion();
  const wrapperRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced) return;

    let timeoutId = 0;

    const trigger = () => {
      const node = wrapperRef.current;
      if (!node) return;
      node.classList.remove("cta-glimmer--active");
      void node.offsetWidth;
      node.classList.add("cta-glimmer--active");
    };

    const schedule = () => {
      const wait =
        MIN_INTERVAL_MS +
        Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS);
      timeoutId = window.setTimeout(() => {
        trigger();
        schedule();
      }, wait);
    };

    timeoutId = window.setTimeout(() => {
      trigger();
      schedule();
    }, 5_000 + Math.random() * 4_000);

    return () => window.clearTimeout(timeoutId);
  }, [reduced]);

  if (reduced) return children;

  const variantClass =
    variant === "text" ? "cta-glimmer--text" : "cta-glimmer--pill";

  const child = isValidElement(children)
    ? cloneElement(children as ReactElement<{ className?: string }>, {
        className: [
          (children.props as { className?: string }).className,
          variant === "text" ? "relative z-[1]" : "relative z-[1] overflow-hidden rounded-full",
        ]
          .filter(Boolean)
          .join(" "),
      })
    : children;

  return (
    <span
      ref={wrapperRef}
      className={`cta-glimmer ${variantClass}`}
    >
      {child}
    </span>
  );
}
