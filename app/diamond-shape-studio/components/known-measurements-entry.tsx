"use client";

import { useEffect, useId, useRef } from "react";
import {
  RING_SIZE_MAX,
  RING_SIZE_MIN,
  RING_SIZE_STEP,
  RING_SIZE_TO_MM,
} from "@/lib/shape-studio/constants";

type KnownMeasurementsEntryProps = {
  active: boolean;
  ringSize: number;
  onChoose: () => void;
  onRingSizeChange: (ringSize: number) => void;
  onUseCardPhoto: () => void;
};

const RING_SIZE_OPTIONS = Object.keys(RING_SIZE_TO_MM)
  .map(Number)
  .filter((size) => size >= RING_SIZE_MIN && size <= RING_SIZE_MAX)
  .sort((a, b) => a - b);

export function KnownMeasurementsEntry({
  active,
  ringSize,
  onChoose,
  onRingSizeChange,
  onUseCardPhoto,
}: KnownMeasurementsEntryProps) {
  const headingId = useId();
  const selectId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (active) selectRef.current?.focus();
  }, [active]);

  if (!active) {
    return (
      <button
        type="button"
        className="dss-entry-secondary-link"
        data-dss-entry-action="use-known-measurements"
        onClick={onChoose}
      >
        Use known measurements instead
      </button>
    );
  }

  return (
    <section
      className="dss-known-measurements"
      aria-labelledby={headingId}
      data-dss-known-measurements
    >
      <h2 id={headingId}>Use your known ring size</h2>
      <p>
        Choose a US ring size you already know. We’ll use it to set the
        diamond’s visual scale on your hand photo; it does not measure your
        finger or replace a jeweler’s fitting.
      </p>
      <label htmlFor={selectId}>Known US ring size</label>
      <select
        ref={selectRef}
        id={selectId}
        name="knownRingSize"
        value={ringSize}
        onChange={(event) => onRingSizeChange(Number(event.target.value))}
      >
        {RING_SIZE_OPTIONS.map((size) => (
          <option key={size} value={size}>
            US {size.toFixed(1)}
          </option>
        ))}
      </select>
      <p className="dss-known-measurements-note">
        Supported sizes: US {RING_SIZE_MIN.toFixed(1)}–{RING_SIZE_MAX.toFixed(1)}
        , in {RING_SIZE_STEP.toFixed(1)}-size steps.
      </p>
      <button
        type="button"
        className="dss-entry-secondary-link"
        data-dss-entry-action="use-card-measurement"
        onClick={onUseCardPhoto}
      >
        Use a card measurement instead
      </button>
    </section>
  );
}
