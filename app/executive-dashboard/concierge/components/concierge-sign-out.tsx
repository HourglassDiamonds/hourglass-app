import { logoutExecutiveDashboard } from "../../actions";

export function ConciergeSignOut() {
  return (
    <form action={logoutExecutiveDashboard}>
      <button
        type="submit"
        className="min-h-11 text-[11px] uppercase tracking-[0.24em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de]"
      >
        Sign out
      </button>
    </form>
  );
}
