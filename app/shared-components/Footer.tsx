import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-[#e8e2d9]">
      <div className="mx-auto max-w-[1180px] px-6 py-10 md:px-8 md:py-12">
        
        {/* Top row */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          
          <div className="text-[10px] uppercase tracking-[0.30em] text-[#746c62]">
            Hourglass Diamonds
          </div>

          <nav className="flex flex-wrap gap-4 text-[12px] text-[#625b54]">
            <Link href="/the-house" className="hover:text-[#1f1d1a]">The House</Link>
            <Link href="/engagement-rings" className="hover:text-[#1f1d1a]">Engagement Rings</Link>
            <Link href="/custom-design" className="hover:text-[#1f1d1a]">Custom Design</Link>
            <Link href="/diamond-guide" className="hover:text-[#1f1d1a]">Diamond Guide</Link>
            <Link href="/diamond-studio" className="hover:text-[#1f1d1a]">Diamond Studio</Link>
            <Link href="/concierge" className="hover:text-[#1f1d1a]">Concierge</Link>
          </nav>

        </div>

        {/* The Ledger — quiet editorial module */}
        <div className="mt-10 border-t border-[#ebe5dc] pt-10">
          <div className="max-w-[28rem]">
            <p className="text-[10px] uppercase tracking-[0.32em] text-[#8a8176]">
              The Ledger
            </p>
            <p className="mt-3 text-[12px] leading-[1.75] text-[#7a7268]">
              Weekly intelligence on markets, infrastructure, AI, energy, and
              global systems.
            </p>
            <Link
              href="/ledger"
              className="mt-4 inline-block text-[11px] uppercase tracking-[0.26em] text-[#625b54] transition-colors hover:text-[#1f1d1a]"
            >
              Explore the Ledger
            </Link>
          </div>
        </div>

        {/* Bottom row */}
        <div className="mt-8 flex flex-col gap-4 border-t border-[#e8e2d9] pt-6 md:flex-row md:items-center md:justify-between">

          <div className="text-[11px] text-[#8a8178]">
            © {new Date().getFullYear()} Hourglass Diamonds · Charlotte, NC
          </div>

          <div className="flex gap-4 text-[11px] text-[#8a8178]">
            <Link href="/privacy" className="hover:text-[#1f1d1a]">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-[#1f1d1a]">
              Terms
            </Link>
          </div>

        </div>

      </div>
    </footer>
  );
}