import type { Metadata, Viewport } from "next";
import { ShapeStudioRouteShell } from "./components/shape-studio-route-shell";

/** Unfinished tool — reachable locally; excluded from search until launch. */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

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
