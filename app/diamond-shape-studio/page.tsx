import type { Metadata } from "next";
import { ShapeStudioView } from "./shape-studio-view";

export const metadata: Metadata = {
  title: "Scaled Preview | Diamond Shape Studio",
  description:
    "Preview diamond shape and presence on your hand, physically scaled from a standard-size card.",
};

export default function DiamondShapeStudioPage() {
  return <ShapeStudioView />;
}
