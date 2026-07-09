type DiamondStudioToolHeaderProps = {
  title: string;
  subhead: string;
  className?: string;
};

/** Shared suite tool title block — matches Diamond Size Studio / Engagement Rings rhythm. */
export default function DiamondStudioToolHeader({
  title,
  subhead,
  className = "",
}: DiamondStudioToolHeaderProps) {
  return (
    <header className={`text-center ${className}`.trim()}>
      <h1 className="font-serif text-[clamp(1.05rem,2.6vw,1.3rem)] font-normal leading-[1.25] tracking-[0.02em] text-[var(--hg-ink,#1c1b1a)]">
        {title}
      </h1>
      <p className="mx-auto mt-1 max-w-[32rem] px-2 text-[10.5px] leading-[1.5] tracking-[0.03em] text-[var(--hg-muted,#756b61)]">
        {subhead}
      </p>
    </header>
  );
}
