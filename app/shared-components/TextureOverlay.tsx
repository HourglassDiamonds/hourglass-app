import React from "react";

export default function TextureOverlay() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 opacity-[0.07] mix-blend-multiply"
      style={{
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(0,0,0,0.2) 0.6px, transparent 0.8px), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.18) 0.6px, transparent 0.8px)",
        backgroundSize: "18px 18px, 22px 22px",
      }}
    />
  );
}