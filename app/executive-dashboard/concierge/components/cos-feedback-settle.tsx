"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { settleCosFeedback } from "../cos-feedback-actions";

export function CosFeedbackSettle({
  watermark,
  calendarKey = "",
}: {
  watermark: string | null;
  calendarKey?: string;
}) {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void settleCosFeedback()
      .then((result) => {
        if (active && result.refresh) router.refresh();
      })
      .catch(() => {
        // Today already shows deterministic guidance.
      });
    return () => {
      active = false;
    };
  }, [watermark, calendarKey, router]);
  return null;
}
