import { PerformanceApp } from "../performance-app";

export const dynamic = "force-dynamic";
export const metadata = { title: "Progress", robots: { index: false, follow: false } };

export default function PersonalProgressPage() {
  return <PerformanceApp initialView="progress" />;
}
