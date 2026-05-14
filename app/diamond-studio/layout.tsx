import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Diamond Studio | Hourglass Diamonds",
  description:
    "Explore diamond size, finger coverage, shape, and proportion in a visual, calm environment.",
};

export default function DiamondStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] overflow-hidden overscroll-none">
      {children}
    </div>
  );
}
