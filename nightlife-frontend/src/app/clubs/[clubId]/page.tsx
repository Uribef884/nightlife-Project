// src/app/clubs/[clubId]/page.tsx
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getClubByIdSSR } from "@/services/clubs.service";
import ClubPageClient from "./pageClient";

type Props = { params: { clubId: string } };

function isUuid(id: string) {
  return /^[0-9a-fA-F-]{36}$/.test(id);
}

export default async function Page({ params }: Props) {
  const { clubId } = params;
  if (!isUuid(clubId)) return notFound();

  // SSR: fetch minimal club info for SEO/shell
  const club = await getClubByIdSSR(clubId);
  if (!club) return notFound();

  // Hydrate the rest on the client
  return (
    <Suspense fallback={<div className="p-6 text-white/70">Cargando...</div>}>
      {/* Client component will fetch events/tickets/ads + all tab behaviors */}
      <ClubPageClient clubId={clubId} clubSSR={club} />
    </Suspense>
  );
}
