"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  CompareSlotId,
  DiamondSlotState,
  OverlayPosition,
  PhotoScaleSource,
  StudioMode,
} from "@/lib/shape-studio/types";
import { SHAPE_LABELS } from "@/lib/shape-studio/constants";
import { formatCaratLabel } from "@/lib/shape-studio/overlay-scale";
import { CaratControl, RingSizeControl } from "./components/calibration-controls";
import DiamondStudioToolHeader from "../diamond-studio/components/DiamondStudioToolHeader";
import {
  HandPhotoPanel,
  type HandPhotoPanelHandle,
} from "./components/hand-photo-panel";
import { OverlayStage } from "./components/overlay-stage";
import ShapeComparisonEditorial from "./components/ShapeComparisonEditorial";
import { ShapeSelector } from "./components/shape-selector";
import { ShapeStudioStyles } from "./components/shape-studio-styles";

/** Centered start — capture orientation is not enforced. */
const DEFAULT_POSITION: OverlayPosition = { xPct: 50, yPct: 46 };
/** Compare offsets keep A/B readable; not a ring-finger assumption. */
const COMPARE_A_POSITION: OverlayPosition = { xPct: 42, yPct: 46 };
const COMPARE_B_POSITION: OverlayPosition = { xPct: 58, yPct: 46 };

function createDefaultSlot(
  shape: DiamondSlotState["shape"] = "round",
  carat = 2.0,
  position: OverlayPosition = DEFAULT_POSITION,
): DiamondSlotState {
  return { shape, carat, position };
}

/** One source-specific trust line near the viewer. */
function trustLine(source: PhotoScaleSource | null): string | null {
  if (!source) return null;
  if (source === "card-reference") {
    return "The card has not been measured yet. Complete the guided measurement to create a scaled preview and estimate a starting ring size.";
  }
  if (source === "known-size") {
    return "Your selected ring size helps guide this visual preview. Final sizing should be professionally confirmed.";
  }
  return "This is a visual preview, not a final sizing measurement.";
}

export function ShapeStudioView() {
  const handPhotoRef = useRef<HandPhotoPanelHandle>(null);
  const [handImageUrl, setHandImageUrl] = useState<string | null>(null);
  const [photoScaleSource, setPhotoScaleSource] =
    useState<PhotoScaleSource | null>(null);
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

  const awaitingCardCalibration = photoScaleSource === "card-reference";

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

  const handleImageSelected = useCallback(
    (url: string, source: PhotoScaleSource) => {
      setPhotoScaleSource(source);
      setHandImageUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return url;
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (handImageUrl?.startsWith("blob:")) URL.revokeObjectURL(handImageUrl);
    };
  }, [handImageUrl]);

  const overlayEntries = useMemo(() => {
    if (awaitingCardCalibration) return [];
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
  }, [awaitingCardCalibration, mode, singleSlot, compareA, compareB]);

  const shapeLabel = SHAPE_LABELS[activeSlot.shape].toLowerCase();
  const caratLabel = formatCaratLabel(activeSlot.carat);
  const liveSentence = !handImageUrl
    ? "Upload a hand photo to compare shapes and carat sizes as a visual preview."
    : awaitingCardCalibration
      ? "Your hand photo is ready."
      : `A ${caratLabel}-carat ${shapeLabel} diamond, shown as a visual preview on your hand.`;
  const trustCopy = trustLine(photoScaleSource);

  return (
    <div
      className="dss-shell h-full min-h-full w-full"
      data-theme="light"
      data-shape-studio-instrument
      data-photo-scale-source={photoScaleSource ?? undefined}
    >
      <ShapeStudioStyles />
      <div className="dss-app">
        <div className="dss-main">
          <aside className="dss-control-rail" aria-label="Shape Studio controls">
            <HandPhotoPanel
              ref={handPhotoRef}
              onImageSelected={handleImageSelected}
            />

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

            <RingSizeControl
              ringSize={ringSize}
              onChange={setRingSize}
              photoScaleSource={photoScaleSource}
            />
            <CaratControl
              carat={activeSlot.carat}
              shape={activeSlot.shape}
              onChange={setActiveCarat}
            />
          </aside>

          <div className="dss-stage-stack">
            <div className="dss-stage-preview" aria-label="Hand photo preview">
              <DiamondStudioToolHeader
                title="Shape Comparison"
                subhead="Compare diamond shapes on the hand before choosing a setting."
                className="dss-tool-header"
              />
              {handImageUrl ? (
                <>
                  <p className="dss-sentence">{liveSentence}</p>
                  {trustCopy ? (
                    <p className="dss-trust-note">{trustCopy}</p>
                  ) : null}
                </>
              ) : null}
              <OverlayStage
                handImageUrl={handImageUrl}
                ringSize={ringSize}
                photoScaleSource={photoScaleSource}
                studioMode={mode}
                overlays={overlayEntries}
                onUploadClick={() => handPhotoRef.current?.openDevicePicker()}
                onPhoneCaptureClick={() =>
                  handPhotoRef.current?.revealPhonePaths()
                }
              />
            </div>
            <ShapeSelector
              selected={activeSlot.shape}
              onSelect={setActiveShape}
            />
          </div>
        </div>
      </div>
      <ShapeComparisonEditorial />
    </div>
  );
}
