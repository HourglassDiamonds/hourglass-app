import { PerformanceApp } from "../performance-app";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nutrition", robots: { index: false, follow: false } };

export default function PersonalFoodPage() {
  return <PerformanceApp initialView="nutrition" />;
}
