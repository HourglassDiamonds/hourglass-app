import { logoutExecutiveDashboard } from "./actions";

export function LogoutButton() {
  return (
    <form
      action={logoutExecutiveDashboard}
      className="absolute right-4 top-[4.75rem] z-40 md:right-6 md:top-6"
    >
      <button
        type="submit"
        className="border border-[#e4dbcf]/80 bg-white/80 px-3 py-2 text-[10px] uppercase tracking-[0.28em] text-[#5f5851] backdrop-blur-sm transition-colors hover:border-[#cfc3b4] hover:text-[#1f1c19] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f1c19]"
      >
        Sign out
      </button>
    </form>
  );
}
