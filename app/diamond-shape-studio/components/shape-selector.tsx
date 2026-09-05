"use client";

import { SHAPE_LABELS, SHAPES, shapeAssetPath } from "@/lib/shape-studio/constants";
import type { ShapeId } from "@/lib/shape-studio/types";

type ShapeSelectorProps = {
  selected: ShapeId;
  onSelect: (shape: ShapeId) => void;
};

function handleShapeRadioKeyDown(
  event: React.KeyboardEvent<HTMLButtonElement>,
  selected: ShapeId,
  onSelect: (shape: ShapeId) => void,
) {
  let delta = 0;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") delta = 1;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") delta = -1;
  else return;
  event.preventDefault();
  const index = SHAPES.indexOf(selected);
  const next = SHAPES[(index + delta + SHAPES.length) % SHAPES.length];
  onSelect(next);
  event.currentTarget
    .closest('[role="radiogroup"]')
    ?.querySelector<HTMLButtonElement>(`[data-shape="${next}"]`)
    ?.focus();
}

export function ShapeSelector({ selected, onSelect }: ShapeSelectorProps) {
  return (
    <div className="dss-shape-strip-wrap">
      <div
        className="dss-shape-strip"
        role="radiogroup"
        aria-label="Diamond shape"
      >
        {SHAPES.map((shapeId) => (
          <button
            key={shapeId}
            type="button"
            role="radio"
            aria-checked={selected === shapeId}
            tabIndex={selected === shapeId ? 0 : -1}
            data-shape={shapeId}
            className={`dss-shape-chip${selected === shapeId ? " is-selected" : ""}`}
            onClick={() => onSelect(shapeId)}
            onKeyDown={(event) =>
              handleShapeRadioKeyDown(event, selected, onSelect)
            }
          >
            <span className="dss-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shapeAssetPath(shapeId)}
                alt=""
                className="dss-shape-thumb-img"
              />
            </span>
            <span className="dss-name">{SHAPE_LABELS[shapeId]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
