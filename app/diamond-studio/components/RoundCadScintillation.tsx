"use client";

/** @deprecated Prefer DiamondCadScintillation. */
import DiamondCadScintillation from "./DiamondCadScintillation";
import { getDiamondCadAsset } from "./diamond-cad-assets";

/** Thin wrapper preserving the previous Round-only API. */
export default function RoundCadScintillation({
  active,
  carat,
}: {
  active: boolean;
  carat: number;
}) {
  const cad = getDiamondCadAsset("round");
  return (
    <DiamondCadScintillation
      active={active}
      carat={carat}
      variants={cad.variants}
      shapeId="round"
    />
  );
}
