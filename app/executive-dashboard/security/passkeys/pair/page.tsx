import { claimIphonePairingFromToken, readPhonePairingAction } from "./actions";
import { PairPhone } from "./pair-phone";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Set up iPhone",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function IphonePasskeyPairPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const query = await searchParams;
  const rawToken = query.t?.trim();
  if (rawToken) {
    await claimIphonePairingFromToken(rawToken);
  }

  const initial = await readPhonePairingAction();
  return (
    <PairPhone
      initial={initial.ok ? { ok: true, pairing: initial.pairing } : { ok: false }}
    />
  );
}
