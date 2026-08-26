import type { ReactNode } from "react";
import type { PublicDigitalCard } from "@/lib/continuum/digital-card/types";
import {
  formatPublicPhone,
  publicMailtoHref,
  publicSmsHref,
  publicTelHref,
} from "@/lib/continuum/digital-card/public";
import { publicCardVcardPath } from "@/lib/continuum/digital-card/paths";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "???";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
}

function SecondaryLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.22em] text-[#8d8073] outline-none hover:text-[#efe8de] focus-visible:text-[#efe8de] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
    >
      {children}
    </a>
  );
}

export function PublicCardView({
  card,
  actions,
}: {
  card: PublicDigitalCard;
  actions?: ReactNode;
}) {
  const tel = publicTelHref(card.phone);
  const sms = publicSmsHref(card.phone);
  const mail = publicMailtoHref(card.email);
  const phoneLabel = formatPublicPhone(card.phone);

  return (
    <article className="hg-card-fade mx-auto w-full max-w-[22.5rem]">
      <div className="flex flex-col items-center text-center">
        {card.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.avatarUrl}
            alt=""
            width={88}
            height={88}
            className="h-[5.5rem] w-[5.5rem] rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full border border-[#ad9164]/35 text-[1.35rem] tracking-[0.18em] text-[#ad9164]"
          >
            {initials(card.displayName)}
          </div>
        )}
        <h1 className="mt-7 font-serif text-[2.15rem] font-normal leading-[1.08] tracking-[-0.04em] text-[#efe8de]">
          {card.displayName}
        </h1>
        {card.memorableTitle ? (
          <p className="mt-3 font-serif text-[1.2rem] leading-snug tracking-[-0.02em] text-[#d4c4ae]">
            {card.memorableTitle}
          </p>
        ) : null}
        {card.professionalTitle ? (
          <p className="mt-3 text-[13px] uppercase tracking-[0.22em] text-[#8d8073]">
            {card.professionalTitle}
          </p>
        ) : null}
        {card.company ? (
          <p className="mt-2 text-[15px] leading-relaxed text-[#c4b7aa]">{card.company}</p>
        ) : null}
        {phoneLabel ? (
          <p className="sr-only">{phoneLabel}</p>
        ) : null}
      </div>

      {actions}

      <nav
        aria-label="Contact"
        className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-1"
      >
        {tel ? <SecondaryLink href={tel}>Call</SecondaryLink> : null}
        {sms ? <SecondaryLink href={sms}>Text</SecondaryLink> : null}
        {mail ? <SecondaryLink href={mail}>Email</SecondaryLink> : null}
        {card.websiteUrl ? (
          <SecondaryLink href={card.websiteUrl}>Website</SecondaryLink>
        ) : null}
        {card.instagramUrl ? (
          <SecondaryLink href={card.instagramUrl}>Instagram</SecondaryLink>
        ) : null}
        {card.linkedinUrl ? (
          <SecondaryLink href={card.linkedinUrl}>LinkedIn</SecondaryLink>
        ) : null}
        {card.additionalLinks.map((link) => (
          <SecondaryLink key={`${link.label}:${link.url}`} href={link.url}>
            {link.label}
          </SecondaryLink>
        ))}
      </nav>
    </article>
  );
}

export function PublicCardActions({
  slug,
  onShare,
}: {
  slug: string;
  onShare?: ReactNode;
}) {
  return (
    <div className="mt-10 flex flex-col gap-3">
      <a
        href={publicCardVcardPath(slug)}
        className="inline-flex min-h-12 items-center justify-center rounded-[18px] border border-[#ad9164]/50 bg-[#1d1916] px-4 text-[11px] uppercase tracking-[0.22em] text-[#efe8de] outline-none hover:border-[#ad9164] focus-visible:shadow-[0_0_0_3px_rgba(173,145,100,0.22)]"
      >
        Save Contact
      </a>
      {onShare}
    </div>
  );
}
