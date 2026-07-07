"use client";

export default function EngagementRingsRingStudioEmbed() {
  return (
    <>
      <div className="mt-8 md:hidden">
        <a
          href="/ring-studio/ring-studio-embed.html"
          className="inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-[0.08em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-300 hover:opacity-95 hover:shadow-[0_2px_6px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-[#cbbda9] focus:ring-offset-2 focus:ring-offset-[#efe8de]"
        >
          Open Ring Studio
        </a>
      </div>

      <div className="mt-8 hidden min-h-[760px] md:block xl:min-h-[820px]">
        <iframe
          src="/ring-studio/ring-studio-embed.html"
          title="Hourglass Ring Studio"
          className="h-[760px] w-full border-0 xl:h-[820px]"
          loading="lazy"
        />
      </div>
    </>
  );
}
