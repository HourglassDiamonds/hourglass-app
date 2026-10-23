"use client";

export type FrequentMealSavePhase = "idle" | "saving" | "error";

export function FrequentMealSaveControl({
  saved,
  phase,
  onSave,
}: {
  saved: boolean;
  phase: FrequentMealSavePhase;
  onSave: () => void | Promise<void>;
}) {
  const saving = phase === "saving";

  async function activate() {
    if (saved || saving) return;
    await onSave();
  }

  return <button type="button" aria-pressed={saved} disabled={saved || saving} onClick={activate}>
    {saving ? "Saving…" : saved ? "Saved as frequent" : phase === "error" ? "Retry save as frequent" : "Save as frequent"}
  </button>;
}
