/** Stage-space point used by calibration overlay geometry. */
export type CalVec2 = { x: number; y: number };

/**
 * Visible connector from the inner edge of handle A to the inner edge of handle B.
 * `p1`/`p2` are true edge centers (ring centers); `ringRadiusPx` is the rendered
 * handle-ring radius so the line never crosses either circle’s center.
 */
export function connectorSegmentGeometry(
  p1: CalVec2,
  p2: CalVec2,
  ringRadiusPx: number,
): { left: number; top: number; width: number; angleDeg: number } {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const length = Math.hypot(dx, dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const ux = length < 1e-6 ? 1 : dx / length;
  const uy = length < 1e-6 ? 0 : dy / length;
  const inset = Math.min(Math.max(0, ringRadiusPx), length / 2);
  return {
    left: p1.x + ux * inset,
    top: p1.y + uy * inset,
    width: Math.max(0, length - 2 * inset),
    angleDeg,
  };
}
