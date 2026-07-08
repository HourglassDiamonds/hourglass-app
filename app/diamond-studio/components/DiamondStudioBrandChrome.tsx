"use client";

import { useLayoutEffect } from "react";

/**
 * Measures Diamond Studio suite header + subnav so instrument workspace
 * height stays `100dvh − chrome` without magic numbers.
 */
export default function DiamondStudioBrandChrome() {
  useLayoutEffect(() => {
    const root =
      document.querySelector<HTMLElement>("[data-diamond-studio-suite-route]") ??
      document.querySelector<HTMLElement>("[data-diamond-studio-route]");
    if (!root) return;

    const apply = () => {
      const header = root.querySelector<HTMLElement>("[data-dts-site-header]");
      const subnav = root.querySelector<HTMLElement>("[data-dts-subnav]");
      const headerH = header
        ? Math.ceil(header.getBoundingClientRect().height)
        : 0;
      const subnavH = subnav
        ? Math.ceil(subnav.getBoundingClientRect().height)
        : 44;
      if (headerH > 0) {
        root.style.setProperty("--dts-header-h", `${headerH}px`);
      }
      if (subnavH > 0) {
        root.style.setProperty("--dts-subnav-h", `${subnavH}px`);
      }
    };

    apply();
    const raf = window.requestAnimationFrame(apply);

    const observer = new ResizeObserver(apply);
    const observeTargets = () => {
      const header = root.querySelector("[data-dts-site-header]");
      const subnav = root.querySelector("[data-dts-subnav]");
      if (header) observer.observe(header);
      if (subnav) observer.observe(subnav);
    };
    observeTargets();

    const mutation = new MutationObserver(() => {
      observer.disconnect();
      observeTargets();
      apply();
    });
    mutation.observe(root, { childList: true, subtree: true });

    window.addEventListener("resize", apply);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  return null;
}
