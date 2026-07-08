import type { Viewport } from "next";
import { ShapeStudioRouteShell } from "./components/shape-studio-route-shell";

export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function DiamondShapeStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ShapeStudioRouteShell>{children}</ShapeStudioRouteShell>;
}
