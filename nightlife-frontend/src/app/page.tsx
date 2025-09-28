// src/app/page.tsx
// Server Component: SSR fetches ads + cities + clubs (by searchParams),
// renders Ads (inside ClientHome), search controls (ClientHome), then an SSR grid.

import { Suspense } from "react";

import {
  Ad,
  getGlobalAds,
  getCities,
  getEventById,
  getTicketById,
  toYmd,
} from "@/lib/apiClient";

import { ClientHome } from "@/components/domain/home/ClientHome";
import SSRClubGrid from "@/components/domain/home/SSRClubGrid";
import { fetchClubsSSR } from "@/services/clubs.service";
import type { ResolvedAd } from "@/components/domain/home/GlobalAdCarousel";

/* -------- Resolve date for ad deep-links (unchanged) -------- */
async function resolveAdDate(ad: Ad): Promise<string | null> {
  if (!ad.targetType || !ad.targetId) return null;

  try {
    if (ad.targetType === "event") {
      const ev = await getEventById(ad.targetId);
      return ev ? toYmd(ev.availableDate) : null;
    }

    if (ad.targetType === "ticket") {
      const ticket = await getTicketById(ad.targetId);
      if (!ticket) return null;

      if (ticket.eventId) {
        const ev = await getEventById(ticket.eventId);
        return ev ? toYmd(ev.availableDate) : null;
      }

      if (ticket.availableDate) return toYmd(ticket.availableDate);
      return null;
    }

    return null; // targetType "club" or unknown → no date param
  } catch {
    return null;
  }
}

async function getResolvedAds(): Promise<ResolvedAd[]> {
  const ads = await getGlobalAds();
  const resolved = await Promise.all(
    ads.map(async (ad) => {
      const resolvedDate = await resolveAdDate(ad);
      return { ...ad, resolvedDate };
    })
  );
  return resolved;
}

/* ------------------------------- Page ------------------------------- */
type PageProps = {
  searchParams?: Promise<{
    q?: string;
    city?: string;
    musicType?: string | string[];
    openDays?: string | string[];
    page?: string;
    pageSize?: string;
  }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  let ads: ResolvedAd[] = [];
  let cities: string[] = [];

  // 1) Load ads + cities concurrently (same as before)
  try {
    [ads, cities] = await Promise.all([getResolvedAds(), getCities()]);
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[HomePage] ads/cities fetch failed; rendering with fallbacks", e);
    }
    ads = [];
    cities = [];
  }

  // 2) Read params for SSR clubs (q, city, page, pageSize, musicType, openDays)
  const resolvedParams = await searchParams;
  const q = resolvedParams?.q;
  const city = resolvedParams?.city;
  const musicType = resolvedParams?.musicType;
  const openDays = resolvedParams?.openDays;
  const page = resolvedParams?.page ? Number(resolvedParams.page) : undefined;
  const pageSize = resolvedParams?.pageSize ? Number(resolvedParams.pageSize) : undefined;

  // 3) SSR fetch clubs from backend using our server helper
  let clubsSSR;
  try {
    clubsSSR = await fetchClubsSSR({ q, city, musicType, openDays, page, pageSize });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[HomePage] SSR clubs fetch failed", e);
    }
    clubsSSR = { items: [], page: 1, pageSize: 20, total: 0 };
  }

  return (
    <main 
      className="mx-auto max-w-7xl px-4 space-y-4"
      style={{
        paddingBottom: `max(var(--kb-inset, 0px), env(safe-area-inset-bottom))`
      }}
    >
      {/* Client shell (ads + search/filters); renderGrid=false to avoid duplicate client grid */}
      <Suspense fallback={<div className="text-white/60">Cargando…</div>}>
        <ClientHome cities={cities} ads={ads} renderGrid={false} />
      </Suspense>

      {/* "Clubs:" heading + SSR-rendered grid */}
      <h2 id="clubs-heading" className="text-lg md:text-xl font-semibold text-white/90">
        Clubs:
      </h2>
      <div role="region" aria-labelledby="clubs-heading">
        <SSRClubGrid items={clubsSSR.items} />
      </div>
    </main>
  );
}
