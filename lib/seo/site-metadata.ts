import type { Metadata } from "next";

export const SITE_URL = "https://hourglassdiamonds.com";

export const DEFAULT_SITE_DESCRIPTION =
  "A more thoughtful way to design engagement rings and fine jewelry. Private guidance, refined sourcing, and a calm, personal process.";

export const DEFAULT_OPEN_GRAPH: NonNullable<Metadata["openGraph"]> = {
  type: "website",
  locale: "en_US",
  siteName: "Hourglass Diamonds",
  images: [
    {
      url: "/hourglass-logo-gold.png",
      alt: "Hourglass Diamonds",
    },
  ],
};

export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  openGraphTitle?: string;
}): Metadata {
  const openGraphTitle = input.openGraphTitle ?? `${input.title} | Hourglass Diamonds`;

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: input.path,
    },
    openGraph: {
      ...DEFAULT_OPEN_GRAPH,
      title: openGraphTitle,
      description: input.description,
      url: input.path,
    },
  };
}
