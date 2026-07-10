"use client";

import { useCallback, useRef } from "react";
import {
  CARAT_MAX,
  CARAT_MIN,
  CARAT_STEP,
  RING_SIZE_MAX,
  RING_SIZE_MIN,
  RING_SIZE_STEP,
  caratFromSliderPct,
  caratSliderPct,
  ringSizeFromSliderPct,
  ringSizeSliderPct,
  snapCarat,
  snapRingSize,
} from "@/lib/shape-studio/constants";
import { formatDimensionReadout } from "@/lib/shape-studio/dimensions";
import type { PhotoScaleSource, ShapeId } from "@/lib/shape-studio/types";
import { useHorizontalTrack } from "./horizontal-track";

type RingSizeControlProps = {
  ringSize: number;
  onChange: (value: number) => void;
  photoScaleSource?: PhotoScaleSource | null;
};

export function RingSizeControl({
  ringSize,
  onChange,
  photoScaleSource = null,
}: RingSizeControlProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const applyPct = useCallback(
    (pct: number) => onChange(ringSizeFromSliderPct(pct)),
    [onChange],
  );
  useHorizontalTrack(trackRef, applyPct);

  const handleStep = (delta: number) => {
    onChange(snapRingSize(ringSize + delta));
  };

  const fill = ringSizeSliderPct(ringSize);
  const isCardReference = photoScaleSource === "card-reference";

  if (isCardReference) {
    return (
      <section className="dss-card" aria-label="Ring size">
        <div className="dss-card-head">Ring Size</div>
        <p className="dss-ring-pending-val">Not estimated yet</p>
        <p className="dss-dim-note">
          Ring-size estimation needs an additional guided step. Guided card and
          finger measurement is required before a scaled preview is created.
        </p>
      </section>
    );
  }

  return (
    <section className="dss-card" aria-label="Ring size calibration">
      <div className="dss-card-head">Ring Size</div>
      <div className="dss-stepper">
        <button
          type="button"
          aria-label="Smaller ring size"
          disabled={ringSize <= RING_SIZE_MIN}
          onClick={() => handleStep(-RING_SIZE_STEP)}
        >
          ‹
        </button>
        <span className="dss-step-val">{ringSize.toFixed(1)}</span>
        <button
          type="button"
          aria-label="Larger ring size"
          disabled={ringSize >= RING_SIZE_MAX}
          onClick={() => handleStep(RING_SIZE_STEP)}
        >
          ›
        </button>
      </div>
      <div className="dss-slider">
        <div
          ref={trackRef}
          className="dss-track"
          style={{ "--dss-fill": `${fill}%` } as React.CSSProperties}
        >
          <div className="dss-handle" style={{ left: `${fill}%` }} />
        </div>
        <div className="dss-endpoints">
          <span>{RING_SIZE_MIN.toFixed(1)}</span>
          <span>{RING_SIZE_MAX.toFixed(1)}</span>
        </div>
      </div>
    </section>
  );
}

type CaratControlProps = {
  carat: number;
  shape: ShapeId;
  onChange: (value: number) => void;
};

export function CaratControl({ carat, shape, onChange }: CaratControlProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const applyPct = useCallback(
    (pct: number) => onChange(caratFromSliderPct(pct)),
    [onChange],
  );
  useHorizontalTrack(trackRef, applyPct);

  const dims = formatDimensionReadout(shape, carat);
  const fill = caratSliderPct(carat);

  return (
    <section className="dss-card" aria-label="Carat weight">
      <div className="dss-card-head">Carat Weight</div>
      <div className="dss-stepper">
        <button
          type="button"
          aria-label="Decrease carat"
          disabled={carat <= CARAT_MIN}
          onClick={() => onChange(snapCarat(carat - CARAT_STEP))}
        >
          ‹
        </button>
        <span className="dss-step-val">{carat.toFixed(2)}</span>
        <button
          type="button"
          aria-label="Increase carat"
          disabled={carat >= CARAT_MAX}
          onClick={() => onChange(snapCarat(carat + CARAT_STEP))}
        >
          ›
        </button>
      </div>
      <div className="dss-slider">
        <div
          ref={trackRef}
          className="dss-track"
          style={{ "--dss-fill": `${fill}%` } as React.CSSProperties}
        >
          <div className="dss-handle" style={{ left: `${fill}%` }} />
        </div>
        <div className="dss-endpoints">
          <span>{CARAT_MIN.toFixed(2)} ct</span>
          <span>{CARAT_MAX.toFixed(2)} ct</span>
        </div>
      </div>
      <p className="dss-dim-note">
        Est. dimensions: <strong>{dims.label}</strong>
      </p>
    </section>
  );
}
