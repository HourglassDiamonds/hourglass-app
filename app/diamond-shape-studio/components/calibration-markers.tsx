"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import {
  clampContentPoint,
  type ContentRect,
} from "@/lib/shape-studio/card-calibration";
import type { ContentPoint } from "@/lib/shape-studio/types";
import { connectorSegmentGeometry } from "./calibration-connector";

type MarkerPair = {
  a: ContentPoint;
  b: ContentPoint;
};

export type CalibrationMarkersProps = {
  stageRef: RefObject<HTMLDivElement | null>;
  content: ContentRect;
  stageWidth: number;
  stageHeight: number;
  points: MarkerPair;
  mode: "card" | "finger";
  onChange: (points: MarkerPair) => void;
};

/**
 * Stage px from precision-marker endpoint to circular grab-handle center,
 * outward along the segment. Must exceed the visual ring radius so the stem
 * and tick remain visible while a finger rests on the circle.
 * Keep in sync with `.dss-cal-handle-ring` sizes in shape-studio-styles.
 */
const GRIP_OFFSET_PX = 26;
const GRIP_OFFSET_MOBILE_PX = 34;
/** Tiny inset so the connector meets tick faces without covering them. */
const TICK_CONNECTOR_INSET_PX = 1;
const MOBILE_CAL_MQ = "(max-width: 960px)";

type Vec2 = { x: number; y: number };

function contentToStagePx(point: ContentPoint, content: ContentRect): Vec2 {
  return {
    x: content.left + point.u * content.width,
    y: content.top + point.v * content.height,
  };
}

function stagePxToStyle(
  x: number,
  y: number,
  stageWidth: number,
  stageHeight: number,
): { left: string; top: string } {
  return {
    left: `${(x / stageWidth) * 100}%`,
    top: `${(y / stageHeight) * 100}%`,
  };
}

function gripOffsetPx(): number {
  if (
    typeof window !== "undefined" &&
    window.matchMedia(MOBILE_CAL_MQ).matches
  ) {
    return GRIP_OFFSET_MOBILE_PX;
  }
  return GRIP_OFFSET_PX;
}

/** Unit vector A→B in stage pixels; falls back to +X when coincident. */
function segmentUnit(
  a: ContentPoint,
  b: ContentPoint,
  content: ContentRect,
): Vec2 {
  const p1 = contentToStagePx(a, content);
  const p2 = contentToStagePx(b, content);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) return { x: 1, y: 0 };
  return { x: dx / length, y: dy / length };
}

/**
 * Connector between vertical precision ticks (measured endpoints).
 * Grab circles sit outward and do not participate in this segment.
 */
function segmentStyle(
  a: ContentPoint,
  b: ContentPoint,
  content: ContentRect,
): CSSProperties {
  const p1 = contentToStagePx(a, content);
  const p2 = contentToStagePx(b, content);
  const geom = connectorSegmentGeometry(p1, p2, TICK_CONNECTOR_INSET_PX);
  return {
    left: `${geom.left}px`,
    top: `${geom.top}px`,
    width: `${geom.width}px`,
    transform: `rotate(${geom.angleDeg}deg)`,
  };
}

function stemStyle(endpoint: Vec2, unitOutward: Vec2, lengthPx: number): CSSProperties {
  const angle = (Math.atan2(unitOutward.y, unitOutward.x) * 180) / Math.PI;
  return {
    left: `${endpoint.x}px`,
    top: `${endpoint.y}px`,
    width: `${lengthPx}px`,
    transform: `rotate(${angle}deg)`,
  };
}

export function CalibrationMarkers({
  content,
  stageWidth,
  stageHeight,
  points,
  mode,
  onChange,
}: CalibrationMarkersProps) {
  const dragKeyRef = useRef<"a" | "b" | null>(null);
  const pointerStartRef = useRef<Vec2>({ x: 0, y: 0 });
  const endpointStartRef = useRef<ContentPoint>({ u: 0, v: 0 });
  const pointsRef = useRef(points);
  const [activeKey, setActiveKey] = useState<"a" | "b" | null>(null);
  const [gripPx, setGripPx] = useState(GRIP_OFFSET_PX);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_CAL_MQ);
    const sync = () => setGripPx(gripOffsetPx());
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  /**
   * Delta-based drag: endpoint moves by the same stage-pixel delta as the pointer.
   * Thumb stays visually offset; jaw stays on the true endpoint — no pointer-down jump.
   */
  const applyPointerDelta = useCallback(
    (key: "a" | "b", clientX: number, clientY: number) => {
      if (content.width <= 0 || content.height <= 0) return;
      const dx = clientX - pointerStartRef.current.x;
      const dy = clientY - pointerStartRef.current.y;
      const startPx = contentToStagePx(endpointStartRef.current, content);
      const next = clampContentPoint({
        u: (startPx.x + dx - content.left) / content.width,
        v: (startPx.y + dy - content.top) / content.height,
      });
      const current = pointsRef.current;
      onChange(key === "a" ? { a: next, b: current.b } : { a: current.a, b: next });
    },
    [content, onChange],
  );

  useEffect(() => {
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const key = dragKeyRef.current;
      if (!key) return;
      const cx = "touches" in ev ? ev.touches[0]?.clientX : ev.clientX;
      const cy = "touches" in ev ? ev.touches[0]?.clientY : ev.clientY;
      if (cx == null || cy == null) return;
      if ("touches" in ev) ev.preventDefault();
      applyPointerDelta(key, cx, cy);
    };
    const onEnd = () => {
      dragKeyRef.current = null;
      setActiveKey(null);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchend", onEnd);
    };
  }, [applyPointerDelta]);

  const beginDrag = useCallback(
    (key: "a" | "b", clientX: number, clientY: number) => {
      const current = pointsRef.current;
      pointerStartRef.current = { x: clientX, y: clientY };
      endpointStartRef.current = key === "a" ? { ...current.a } : { ...current.b };
      dragKeyRef.current = key;
      setActiveKey(key);
    },
    [],
  );

  if (stageWidth <= 0 || stageHeight <= 0 || content.width <= 0) return null;

  const unit = segmentUnit(points.a, points.b, content);
  // Jaw is natively vertical; rotate by segment angle only so a horizontal
  // measurement shows vertical precision marks at each measured endpoint.
  const jawRotation = (Math.atan2(unit.y, unit.x) * 180) / Math.PI;
  const endA = contentToStagePx(points.a, content);
  const endB = contentToStagePx(points.b, content);
  const thumbA = {
    x: endA.x - unit.x * gripPx,
    y: endA.y - unit.y * gripPx,
  };
  const thumbB = {
    x: endB.x + unit.x * gripPx,
    y: endB.y + unit.y * gripPx,
  };
  const labelA = mode === "card" ? "A" : "L";
  const labelB = mode === "card" ? "B" : "R";

  return (
    <div className="dss-cal-layer" data-dss-cal-grip-offset={gripPx}>
      <div
        className="dss-cal-segment"
        style={segmentStyle(points.a, points.b, content)}
        data-dss-cal-connector
      />
      {(["a", "b"] as const).map((key) => {
        const end = key === "a" ? endA : endB;
        const thumb = key === "a" ? thumbA : thumbB;
        const outward =
          key === "a" ? { x: -unit.x, y: -unit.y } : { x: unit.x, y: unit.y };
        const label = key === "a" ? labelA : labelB;

        return (
          <div
            key={key}
            className="dss-cal-endpoint"
            data-dss-cal-endpoint={key}
          >
            {/* Precision tick at the measured endpoint — remains visible while dragging. */}
            <div
              className="dss-cal-jaw-anchor"
              style={
                {
                  ...stagePxToStyle(end.x, end.y, stageWidth, stageHeight),
                  ["--dss-cal-jaw-angle" as string]: `${jawRotation}deg`,
                } as CSSProperties
              }
              data-dss-cal-tick
              aria-hidden
            >
              <span className="dss-cal-jaw" />
            </div>
            <div
              className="dss-cal-stem"
              style={stemStyle(end, outward, gripPx)}
              data-dss-cal-stem
              aria-hidden
            />
            {/* Circular grab handle sits outward; drag still moves the endpoint. */}
            <button
              type="button"
              className={`dss-cal-handle${activeKey === key ? " is-dragging" : ""}`}
              style={stagePxToStyle(thumb.x, thumb.y, stageWidth, stageHeight)}
              data-dss-cal-grip
              aria-label={
                mode === "card"
                  ? `Card edge point ${label}`
                  : `Finger edge point ${label}`
              }
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                beginDrag(key, e.clientX, e.clientY);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                const t = e.touches[0];
                if (!t) return;
                beginDrag(key, t.clientX, t.clientY);
              }}
            >
              <span className="dss-cal-handle-ring" aria-hidden />
              <span className="dss-cal-handle-center" aria-hidden />
            </button>
          </div>
        );
      })}
    </div>
  );
}
