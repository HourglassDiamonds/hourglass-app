"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  loginExecutiveDashboard,
  type ExecutiveDashboardLoginState,
} from "./actions";

const initialState: ExecutiveDashboardLoginState = {};

export function ExecutiveDashboardLoginForm() {
  const [state, formAction, pending] = useActionState(
    loginExecutiveDashboard,
    initialState,
  );
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.error) {
      errorRef.current?.focus();
    }
  }, [state.error]);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div>
        <label
          htmlFor="executive-dashboard-username"
          className="block text-[10px] uppercase tracking-[0.28em] text-[#8d8073]"
        >
          Username
        </label>
        <input
          id="executive-dashboard-username"
          name="username"
          type="text"
          autoComplete="username"
          required
          spellCheck={false}
          enterKeyHint="next"
          className="mt-2 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none transition-[border-color,box-shadow] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </div>
      <div>
        <label
          htmlFor="executive-dashboard-password"
          className="block text-[10px] uppercase tracking-[0.28em] text-[#8d8073]"
        >
          Password
        </label>
        <input
          id="executive-dashboard-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          enterKeyHint="go"
          className="mt-2 min-h-12 w-full rounded-[18px] border border-white/[0.08] bg-[#1d1916] px-4 text-[16px] text-[#efe8de] outline-none transition-[border-color,box-shadow] focus-visible:border-[#ad9164]/70 focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
        />
      </div>
      {state.error ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="text-[13px] leading-relaxed text-[#d2b8a8] outline-none"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 w-full rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none transition-opacity hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)] disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
