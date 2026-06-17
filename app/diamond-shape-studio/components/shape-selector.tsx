"use client";

import { SHAPE_LABELS, SHAPES, shapeAssetPath } from "@/lib/shape-studio/constants";
import type { ShapeId } from "@/lib/shape-studio/types";

type ShapeSelectorProps = {
  selected: ShapeId;
  onSelect: (shape: ShapeId) => void;
};

export function ShapeSelector({ selected, onSelect }: ShapeSelectorProps) {
  return (
    <div className="dss-shape-strip-wrap">
      <div
        className="dss-shape-strip"
        role="tablist"
        aria-label="Diamond shape"
      >
        {SHAPES.map((shapeId) => (
          <button
            key={shapeId}
            type="button"
            role="tab"
            aria-selected={selected === shapeId}
            className={`dss-shape-chip${selected === shapeId ? " is-selected" : ""}`}
            onClick={() => onSelect(shapeId)}
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
