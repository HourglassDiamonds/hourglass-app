import type { Metadata } from "next";
import { ShapeStudioView } from "./shape-studio-view";

export const metadata: Metadata = {
  title: "Diamond Shape Studio",
  description:
    "Compare diamond shapes and carat sizes on your own hand as a visual preview.",
};

export default function DiamondShapeStudioPage() {
  return <ShapeStudioView />;
}
