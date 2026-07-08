"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CompareSlotId,
  DiamondSlotState,
  OverlayPosition,
  StudioMode,
} from "@/lib/shape-studio/types";
import { CaratControl, RingSizeControl } from "./components/calibration-controls";
import { OverlayStage } from "./components/overlay-stage";
import { HandPhotoPanel } from "./components/hand-photo-panel";
import { ShapeSelector } from "./components/shape-selector";
import { ShapeStudioStyles } from "./components/shape-studio-styles";

const DEFAULT_POSITION: OverlayPosition = { xPct: 50, yPct: 42 };
const COMPARE_A_POSITION: OverlayPosition = { xPct: 42, yPct: 42 };
const COMPARE_B_POSITION: OverlayPosition = { xPct: 58, yPct: 42 };

function createDefaultSlot(
  shape: DiamondSlotState["shape"] = "round",
  carat = 2.0,
  position: OverlayPosition = DEFAULT_POSITION,
): DiamondSlotState {
  return { shape, carat, position };
}

export function ShapeStudioView() {
  const [handImageUrl, setHandImageUrl] = useState<string | null>(null);
  const [ringSize, setRingSize] = useState(6.0);
  const [mode, setMode] = useState<StudioMode>("single");
  const [activeCompareSlot, setActiveCompareSlot] =
    useState<CompareSlotId>("a");

  const [singleSlot, setSingleSlot] = useState<DiamondSlotState>(() =>
    createDefaultSlot(),
  );
  const [compareA, setCompareA] = useState<DiamondSlotState>(() =>
    createDefaultSlot("round", 2.0, COMPARE_A_POSITION),
  );
  const [compareB, setCompareB] = useState<DiamondSlotState>(() =>
    createDefaultSlot("oval", 2.0, COMPARE_B_POSITION),
  );

  const activeSlot =
    mode === "single"
      ? singleSlot
      : activeCompareSlot === "a"
        ? compareA
        : compareB;

  const setActiveShape = useCallback(
    (shape: DiamondSlotState["shape"]) => {
      if (mode === "single") {
        setSingleSlot((prev) => ({ ...prev, shape }));
      } else if (activeCompareSlot === "a") {
        setCompareA((prev) => ({ ...prev, shape }));
      } else {
        setCompareB((prev) => ({ ...prev, shape }));
      }
    },
    [mode, activeCompareSlot],
  );

  const setActiveCarat = useCallback(
    (carat: number) => {
      if (mode === "single") {
        setSingleSlot((prev) => ({ ...prev, carat }));
      } else if (activeCompareSlot === "a") {
        setCompareA((prev) => ({ ...prev, carat }));
      } else {
        setCompareB((prev) => ({ ...prev, carat }));
      }
    },
    [mode, activeCompareSlot],
  );

  const handleImageSelected = useCallback((url: string) => {
    setHandImageUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (handImageUrl?.startsWith("blob:")) URL.revokeObjectURL(handImageUrl);
    };
  }, [handImageUrl]);

  const overlayEntries = useMemo(() => {
    if (mode === "single") {
      return [
        {
          id: "single",
          slot: singleSlot,
          onPositionChange: (position: OverlayPosition) =>
            setSingleSlot((prev) => ({ ...prev, position })),
        },
      ];
    }
    return [
      {
        id: "compare-a",
        slot: compareA,
        label: "A",
        onPositionChange: (position: OverlayPosition) =>
          setCompareA((prev) => ({ ...prev, position })),
      },
      {
        id: "compare-b",
        slot: compareB,
        label: "B",
        onPositionChange: (position: OverlayPosition) =>
          setCompareB((prev) => ({ ...prev, position })),
      },
    ];
  }, [mode, singleSlot, compareA, compareB]);

  return (
    <div className="dss-shell h-full min-h-full w-full" data-theme="light">
      <ShapeStudioStyles />
      <div className="dss-app">
        <div className="dss-main">
          <aside className="dss-control-rail" aria-label="Shape Studio controls">
            <HandPhotoPanel onImageSelected={handleImageSelected} />

            <section className="dss-card" aria-label="Comparison mode">
              <div className="dss-card-head">Mode</div>
              <div className="dss-mode-row">
                <button
                  type="button"
                  className={`dss-mode-btn${mode === "single" ? " is-active" : ""}`}
                  onClick={() => setMode("single")}
                >
                  Single
                </button>
                <button
                  type="button"
                  className={`dss-mode-btn${mode === "compare" ? " is-active" : ""}`}
                  onClick={() => setMode("compare")}
                >
                  Compare
                </button>
              </div>
              {mode === "compare" ? (
                <div className="dss-slot-row">
                  <button
                    type="button"
                    className={`dss-slot-btn${activeCompareSlot === "a" ? " is-active" : ""}`}
                    onClick={() => setActiveCompareSlot("a")}
                  >
                    Diamond A
                  </button>
                  <button
                    type="button"
                    className={`dss-slot-btn${activeCompareSlot === "b" ? " is-active" : ""}`}
                    onClick={() => setActiveCompareSlot("b")}
                  >
                    Diamond B
                  </button>
                </div>
              ) : null}
            </section>

            <RingSizeControl ringSize={ringSize} onChange={setRingSize} />
            <CaratControl
              carat={activeSlot.carat}
              shape={activeSlot.shape}
              onChange={setActiveCarat}
            />
          </aside>

          <div className="dss-stage-stack">
            <div className="dss-stage-preview" aria-label="Hand photo preview">
              <p className="dss-sentence">
                Compare diamond shapes and carat sizes on your own hand with
                accurate scale references.
              </p>
              <OverlayStage
                handImageUrl={handImageUrl}
                ringSize={ringSize}
                overlays={overlayEntries}
              />
            </div>
            <ShapeSelector
              selected={activeSlot.shape}
              onSelect={setActiveShape}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
