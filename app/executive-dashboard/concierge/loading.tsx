export default function ConciergeLoading() {
  return (
    <main
      aria-label="Loading Continuum"
      aria-busy="true"
      className="min-h-[100dvh] bg-[#14110f] px-5 py-8 text-[#efe8de] md:px-8"
    >
      <div className="mx-auto w-full max-w-[34rem] md:max-w-[75rem]">
        <p className="text-[10px] uppercase tracking-[0.22em] text-[#6f675f]">
          Continuum
        </p>
        <div className="mt-5 h-9 w-48 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-10 space-y-5">
          {[0, 1, 2].map((item) => (
            <div key={item} className="border-t border-white/[0.08] pt-5">
              <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
              <div className="mt-3 h-6 w-full max-w-md animate-pulse rounded bg-white/[0.05]" />
              <div className="mt-2 h-4 w-3/4 max-w-sm animate-pulse rounded bg-white/[0.04]" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
