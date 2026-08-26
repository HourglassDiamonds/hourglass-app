export default function PublicDigitalCardNotFound() {
  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#14110f] px-5 py-16 text-[#efe8de]">
      <div className="mx-auto max-w-[22.5rem] text-center">
        <h1 className="font-serif text-[2rem] font-normal leading-[1.1] tracking-[-0.04em]">
          This card isn’t available.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#c4b7aa]">
          The link may be mistyped, or the card is no longer public.
        </p>
      </div>
    </main>
  );
}
