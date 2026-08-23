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
          className="block text-[10px] uppercase tracking-[0.28em] text-[#948a80]"
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
          className="mt-2 w-full border border-[#e4dbcf] bg-white/70 px-3 py-2.5 text-[15px] text-[#1f1c19] outline-none transition-[border-color,box-shadow] focus-visible:border-[#1f1c19] focus-visible:shadow-[0_0_0_3px_rgba(31,28,25,0.18)]"
        />
      </div>
      <div>
        <label
          htmlFor="executive-dashboard-password"
          className="block text-[10px] uppercase tracking-[0.28em] text-[#948a80]"
        >
          Password
        </label>
        <input
          id="executive-dashboard-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full border border-[#e4dbcf] bg-white/70 px-3 py-2.5 text-[15px] text-[#1f1c19] outline-none transition-[border-color,box-shadow] focus-visible:border-[#1f1c19] focus-visible:shadow-[0_0_0_3px_rgba(31,28,25,0.18)]"
        />
      </div>
      {state.error ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="text-[13px] leading-relaxed text-[#7a4a3a] outline-none"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full border border-[#1f1c19] bg-[#1f1c19] px-4 py-3 text-[11px] uppercase tracking-[0.28em] text-[#f7f3ec] transition-opacity disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f1c19]"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
