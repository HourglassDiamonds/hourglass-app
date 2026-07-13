import type { Metadata, Viewport } from "next";
import { DEFAULT_OG_IMAGE, DEFAULT_OPEN_GRAPH } from "@/lib/seo/site-metadata";
import { ShapeStudioRouteShell } from "./components/shape-studio-route-shell";
import ShapeStudioJsonLd from "./components/ShapeStudioJsonLd";

const SHAPE_STUDIO_TITLE = "See It On Your Hand | Preview Diamond Shapes";
const SHAPE_STUDIO_DESCRIPTION =
  "Upload or photograph your hand and preview how different diamond shapes, carat weights, and proportions may appear before beginning a ring design.";

export const metadata: Metadata = {
  title: SHAPE_STUDIO_TITLE,
  description: SHAPE_STUDIO_DESCRIPTION,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/diamond-shape-studio",
  },
  openGraph: {
    ...DEFAULT_OPEN_GRAPH,
    title: SHAPE_STUDIO_TITLE,
    description: SHAPE_STUDIO_DESCRIPTION,
    url: "/diamond-shape-studio",
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SHAPE_STUDIO_TITLE,
    description: SHAPE_STUDIO_DESCRIPTION,
    images: [DEFAULT_OG_IMAGE.url],
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
  return (
    <>
      <ShapeStudioJsonLd />
      <ShapeStudioRouteShell>{children}</ShapeStudioRouteShell>
    </>
  );
}
