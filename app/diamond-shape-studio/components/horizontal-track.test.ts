import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachHorizontalTrack,
  pctFromClientX,
} from "./horizontal-track";

type Listener = (ev: unknown) => void;

function createFakeTrack(width = 200, left = 0) {
  const listeners = new Map<string, Set<Listener>>();
  const classList = new Set<string>();
  const attrs = new Map<string, string>();
  let capturedId: number | null = null;

  const track = {
    getBoundingClientRect: () =>
      ({
        left,
        width,
        top: 0,
        height: 52,
        right: left + width,
        bottom: 52,
        x: left,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect,
    addEventListener: (type: string, fn: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: Listener) => {
      listeners.get(type)?.delete(fn);
    },
    dispatch: (type: string, ev: Record<string, unknown>) => {
      for (const fn of listeners.get(type) ?? []) fn(ev);
    },
    setPointerCapture: (id: number) => {
      capturedId = id;
    },
    releasePointerCapture: (id: number) => {
      if (capturedId === id) capturedId = null;
    },
    hasPointerCapture: (id: number) => capturedId === id,
    classList: {
      toggle: (name: string, force?: boolean) => {
        if (force === true) classList.add(name);
        else if (force === false) classList.delete(name);
        else if (classList.has(name)) classList.delete(name);
        else classList.add(name);
      },
      contains: (name: string) => classList.has(name),
    },
    toggleAttribute: (name: string, force?: boolean) => {
      const on = force ?? !attrs.has(name);
      if (on) attrs.set(name, "");
      else attrs.delete(name);
    },
    closest: () => null,
    get capturedId() {
      return capturedId;
    },
    get isDraggingClass() {
      return classList.has("is-dragging");
    },
  };

  return track;
}

describe("horizontal track interaction", () => {
  it("maps client X into 0–1 along the track", () => {
    assert.equal(pctFromClientX(0, { left: 0, width: 100 }), 0);
    assert.equal(pctFromClientX(50, { left: 0, width: 100 }), 0.5);
    assert.equal(pctFromClientX(100, { left: 0, width: 100 }), 1);
    assert.equal(pctFromClientX(-10, { left: 0, width: 100 }), 0);
    assert.equal(pctFromClientX(140, { left: 0, width: 100 }), 1);
  });

  it("press on track immediately sets value (press-to-set)", () => {
    const track = createFakeTrack(200, 0);
    const draggingRef = { current: false };
    const values: number[] = [];
    const cleanup = attachHorizontalTrack(
      track as unknown as HTMLDivElement,
      draggingRef,
      (pct) => values.push(pct),
    );

    track.dispatch("pointerdown", {
      button: 0,
      pointerType: "touch",
      pointerId: 7,
      clientX: 50,
      preventDefault: () => {},
    });

    assert.equal(values.length, 1);
    assert.equal(values[0], 0.25);
    assert.equal(draggingRef.current, true);
    assert.equal(track.isDraggingClass, true);
    assert.equal(track.capturedId, 7);
    cleanup();
  });

  it("continues drag after pointer moves outside the visible track bounds", () => {
    const track = createFakeTrack(200, 0);
    const draggingRef = { current: false };
    const values: number[] = [];
    const cleanup = attachHorizontalTrack(
      track as unknown as HTMLDivElement,
      draggingRef,
      (pct) => values.push(pct),
    );

    track.dispatch("pointerdown", {
      button: 0,
      pointerType: "touch",
      pointerId: 3,
      clientX: 20,
      preventDefault: () => {},
    });
    // Far above/below the track — capture keeps events flowing to the track.
    track.dispatch("pointermove", {
      pointerId: 3,
      clientX: 160,
      clientY: -80,
      preventDefault: () => {},
    });
    track.dispatch("pointerup", {
      pointerId: 3,
      preventDefault: () => {},
    });

    assert.deepEqual(values, [0.1, 0.8]);
    assert.equal(draggingRef.current, false);
    assert.equal(track.isDraggingClass, false);
    cleanup();
  });
});
