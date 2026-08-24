"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { formatMatchCode } from "@/lib/executive-dashboard/passkeys/pairing-format";
import type { PasskeyPairingPublicView } from "@/lib/executive-dashboard/passkeys/types";
import {
  approveIphonePairingAction,
  cancelIphonePairingAction,
  createIphonePairingAction,
  readIphonePairingStatusAction,
} from "./pairing-actions";

const PAIR_SETUP_ERROR = "Unable to start iPhone setup. Try again.";

type DesktopPairing = {
  pairingId: string;
  pairUrl: string;
  matchCode: string;
  expiresAt: string;
  status: PasskeyPairingPublicView["status"];
  deviceHint: string | null;
};

function remainingLabel(expiresAt: string, now: number): string {
  const ms = Date.parse(expiresAt) - now;
  if (!Number.isFinite(ms) || ms <= 0) return "Expired";
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return minutes === 1 ? "Expires in 1 minute" : `Expires in ${minutes} minutes`;
}

export function IphoneSetup({ disabled }: { disabled: boolean }) {
  const [pairing, setPairing] = useState<DesktopPairing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!pairing || pairing.status === "completed" || pairing.status === "cancelled") {
      return;
    }
    const timer = window.setInterval(() => {
      void readIphonePairingStatusAction(pairing.pairingId).then((result) => {
        if (!result.ok) return;
        setPairing((current) =>
          current
            ? {
                ...current,
                status: result.pairing.status,
                deviceHint: result.pairing.deviceHint,
                matchCode: result.pairing.matchCode,
                expiresAt: result.pairing.expiresAt,
              }
            : current,
        );
      });
    }, 2000);
    return () => window.clearInterval(timer);
  }, [pairing]);

  async function onStart() {
    setPending(true);
    setError(null);
    try {
      const created = await createIphonePairingAction();
      if (!created.ok) {
        setError(created.error);
        return;
      }
      setPairing({
        pairingId: created.pairingId,
        pairUrl: created.pairUrl,
        matchCode: created.matchCode,
        expiresAt: created.expiresAt,
        status: "pending",
        deviceHint: null,
      });
    } catch {
      setError(PAIR_SETUP_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function onCancel() {
    if (!pairing) return;
    setPending(true);
    setError(null);
    try {
      await cancelIphonePairingAction(pairing.pairingId);
      setPairing(null);
    } catch {
      setError(PAIR_SETUP_ERROR);
    } finally {
      setPending(false);
    }
  }

  async function onApprove() {
    if (!pairing) return;
    setPending(true);
    setError(null);
    try {
      const result = await approveIphonePairingAction(pairing.pairingId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPairing((current) =>
        current
          ? {
              ...current,
              status: result.pairing.status,
              deviceHint: result.pairing.deviceHint,
            }
          : current,
      );
    } catch {
      setError(PAIR_SETUP_ERROR);
    } finally {
      setPending(false);
    }
  }

  const expired = pairing
    ? pairing.status === "expired" || Date.parse(pairing.expiresAt) <= now
    : false;
  const claimed = pairing?.status === "claimed";
  const approved = pairing?.status === "approved";
  const completed = pairing?.status === "completed";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          iPhone
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[#c4b7aa]">
          Create the first Face ID passkey on Justin&apos;s iPhone with a
          one-time QR.
        </p>
      </div>

      {!pairing ? (
        <button
          type="button"
          onClick={() => void onStart()}
          disabled={pending || disabled}
          className="min-h-12 w-full rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none transition-opacity hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-60"
        >
          {pending ? "Starting…" : "Set up iPhone"}
        </button>
      ) : completed ? (
        <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
          iPhone passkey is ready. Continuum is available on that phone.
        </p>
      ) : expired ? (
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
            This setup session has expired or was cancelled.
          </p>
          <button
            type="button"
            onClick={() => setPairing(null)}
            className="min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de]"
          >
            Start over
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div
            className="flex justify-center rounded-[24px] bg-[#efe8de] p-6"
            aria-label="QR code for iPhone passkey setup. Scan with the iPhone Camera app."
          >
            <QRCode
              value={pairing.pairUrl}
              size={196}
              bgColor="#efe8de"
              fgColor="#14110f"
              style={{ height: "auto", maxWidth: "196px", width: "196px" }}
            />
          </div>
          <p className="text-center text-[13px] text-[#8d8073]">
            {remainingLabel(pairing.expiresAt, now)}
          </p>
          <p className="text-center font-serif text-[1.65rem] tracking-[0.18em] text-[#efe8de]">
            {formatMatchCode(pairing.matchCode)}
          </p>
          {claimed || approved ? (
            <div className="space-y-3">
              <p className="text-[15px] leading-relaxed text-[#c4b7aa]">
                iPhone is ready to pair
                {pairing.deviceHint ? ` · ${pairing.deviceHint}` : ""}.
              </p>
              {approved ? (
                <p className="text-[13px] leading-relaxed text-[#8d8073]">
                  Waiting for Face ID on the iPhone.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void onApprove()}
                  disabled={pending}
                  className="min-h-12 w-full rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-60"
                >
                  {pending ? "Approving…" : "Approve"}
                </button>
              )}
            </div>
          ) : (
            <p className="text-[13px] leading-relaxed text-[#8d8073]">
              Scan with iPhone Camera. Confirm the code matches before
              approving.
            </p>
          )}
          <button
            type="button"
            onClick={() => void onCancel()}
            disabled={pending}
            className="min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-transparent px-4 text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      )}

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
    </div>
  );
}
