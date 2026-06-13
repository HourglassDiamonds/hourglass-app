"use client";

import { useEffect, useRef, useState } from "react";
import {
  ANALYSIS_PROGRESS_EDUCATION,
  ANALYSIS_PROGRESS_FADE_MS,
  ANALYSIS_PROGRESS_LONG_DURATION,
  ANALYSIS_PROGRESS_LONG_DURATION_MS,
  ANALYSIS_PROGRESS_ROTATION_MS,
  ANALYSIS_PROGRESS_STATES,
  nextAnalysisProgressIndex,
  type AnalysisProgressMessage,
} from "./analysis-progress-narrative";
import { DI_EYEBROW_MUTED } from "./di-editorial-classes";
import { DI_SERIF_HEADLINE } from "./di-studio-styles";

type AnalysisProgressNarrativeProps = {
  active: boolean;
};

export function useAnalysisProgressNarrative(active: boolean): {
  message: AnalysisProgressMessage;
  visible: boolean;
  longDuration: boolean;
} {
  const [stateIndex, setStateIndex] = useState(0);
  const [longDuration, setLongDuration] = useState(false);
  const [visible, setVisible] = useState(true);
  const longDurationRef = useRef(false);

  useEffect(() => {
    if (!active) {
      longDurationRef.current = false;
      setStateIndex(0);
      setLongDuration(false);
      setVisible(true);
      return;
    }

    longDurationRef.current = false;
    setStateIndex(0);
    setLongDuration(false);
    setVisible(true);

    const longTimer = window.setTimeout(() => {
      longDurationRef.current = true;
      setLongDuration(true);
      setVisible(true);
    }, ANALYSIS_PROGRESS_LONG_DURATION_MS);

    const rotateTimer = window.setInterval(() => {
      if (longDurationRef.current) return;

      setVisible(false);
      window.setTimeout(() => {
        if (longDurationRef.current) return;
        setStateIndex((index) => nextAnalysisProgressIndex(index));
        setVisible(true);
      }, ANALYSIS_PROGRESS_FADE_MS);
    }, ANALYSIS_PROGRESS_ROTATION_MS);

    return () => {
      window.clearTimeout(longTimer);
      window.clearInterval(rotateTimer);
    };
  }, [active]);

  const message = longDuration
    ? ANALYSIS_PROGRESS_LONG_DURATION
    : ANALYSIS_PROGRESS_STATES[stateIndex]!;

  return { message, visible, longDuration };
}

export default function AnalysisProgressNarrative({
  active,
}: AnalysisProgressNarrativeProps) {
  const { message, visible } = useAnalysisProgressNarrative(active);

  if (!active) return null;

  return (
    <section className="relative py-4 md:py-6" aria-live="polite" aria-busy="true">
      <p className={DI_EYEBROW_MUTED}>Diamond Intelligence</p>

      <div className="mt-8 max-w-xl">
        <span
          className="inline-block font-serif text-[1.35rem] leading-none text-[#b8a99a] motion-safe:animate-pulse"
          aria-hidden
        >
          ◇
        </span>

        <div
          className={`mt-6 transition-opacity duration-500 ease-in-out ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        >
          <h2
            className={`${DI_SERIF_HEADLINE} text-[1.85rem] font-normal leading-[1.12] tracking-[-0.02em] md:text-[2.15rem]`}
            style={{ textWrap: "balance" }}
          >
            {message.headline}
          </h2>
          <p className="mt-4 text-[0.98rem] leading-[1.75] text-[#75675e] md:text-[1.02rem]">
            {message.body}
          </p>
        </div>
      </div>

      <aside className="mt-12 max-w-lg border-t border-[rgba(181,150,98,0.14)] pt-6">
        <p className={DI_EYEBROW_MUTED}>{ANALYSIS_PROGRESS_EDUCATION.title}</p>
        <p className="mt-3 text-[0.82rem] leading-[1.7] text-[#9b8b78]">
          {ANALYSIS_PROGRESS_EDUCATION.body}
        </p>
      </aside>
    </section>
  );
}
