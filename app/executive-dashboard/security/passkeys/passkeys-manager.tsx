"use client";

import { useEffect, useRef, useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import {
  beginPasskeyRegistration,
  completePasskeyRegistration,
  revokePasskey,
} from "./actions";

const PASSKEY_ENROLL_ERROR = "Unable to create passkey. Try again.";

export type PasskeyListItem = {
  id: string;
  label: string | null;
  createdAt: string;
};

function addedLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Added";
  return `Added ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}`;
}

export function PasskeysManager({
  passkeys,
  unavailable,
}: {
  passkeys: PasskeyListItem[];
  unavailable: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [label, setLabel] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function onCreate() {
    setPending(true);
    setError(null);
    try {
      const begin = await beginPasskeyRegistration();
      if (!begin.ok) {
        setError(begin.error);
        return;
      }
      const attestation = await startRegistration({
        optionsJSON: begin.options,
      });
      const done = await completePasskeyRegistration(
        attestation,
        label.trim() || undefined,
      );
      if (!done.ok) {
        setError(done.error);
        return;
      }
      setLabel("");
    } catch {
      setError(PASSKEY_ENROLL_ERROR);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-10 space-y-10">
      <div>
        <label
          htmlFor="passkey-label"
          className="block text-[10px] uppercase tracking-[0.28em] text-[#8d8073]"
        >
          Label
        </label>
        <input
          id="passkey-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          maxLength={80}
          placeholder="iPhone"
          className="mt-2 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none transition-[border-color,box-shadow] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={pending || unavailable}
          className="mt-4 min-h-12 w-full rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none transition-opacity hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-60"
        >
          {pending ? "Waiting…" : "Create passkey"}
        </button>
        <p className="mt-3 text-[13px] leading-relaxed text-[#8d8073]">
          On iPhone this uses Face ID. From Windows Chrome, choose a phone or
          hybrid passkey if offered.
        </p>
      </div>

      {error ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="text-[13px] leading-relaxed text-[#d2b8a8] outline-none"
        >
          {error}
        </p>
      ) : null}

      {unavailable ? (
        <p className="text-[13px] leading-relaxed text-[#8d8073]">
          Passkeys are unavailable.
        </p>
      ) : (
        <ul className="space-y-4">
          {passkeys.map((passkey) => (
            <li
              key={passkey.id}
              className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-4"
            >
              <div>
                <p className="text-[15px] text-[#efe8de]">
                  {passkey.label?.trim() || "Passkey"}
                </p>
                <p className="mt-1 text-[12px] text-[#8d8073]">
                  {addedLabel(passkey.createdAt)}
                </p>
              </div>
              <form action={revokePasskey}>
                <input type="hidden" name="id" value={passkey.id} />
                <button
                  type="submit"
                  className="min-h-11 text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
                >
                  Revoke
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
