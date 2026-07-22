"use client";

import {
  useEffect,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from "react";
import { useReducedMotion } from "./useReducedMotion";

type RevealOnScrollProps = {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  /** Stagger delay in milliseconds. */
  delay?: number;
  /**
   * Reveal direct children in sequence (eyebrow → heading → copy → media)
   * using `--hg-motion-reveal-stagger`. The wrapper itself stays static so
   * layout never shifts; only the children settle into clarity.
   */
  stagger?: boolean;
  id?: string;
};

export default function RevealOnScroll({
  children,
  className = "",
  as: Tag = "div",
  delay = 0,
  stagger = false,
  id,
}: RevealOnScrollProps) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(reduced);

  useEffect(() => {
    if (reduced) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -4% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [reduced]);

  const classes = [
    "luxury-reveal",
    stagger ? "luxury-reveal--stagger" : "",
    visible ? "luxury-reveal--visible" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Tag
      ref={ref}
      id={id}
      className={classes}
      style={delay > 0 ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
