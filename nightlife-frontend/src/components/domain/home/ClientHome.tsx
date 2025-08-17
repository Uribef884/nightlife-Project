// src/components/domain/home/ClientHome.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchBar } from "./SearchBar";
import { FiltersBar } from "./FiltersBar";
import { ClubGrid } from "./ClubGrid"; // existing client grid (kept optional)
import { GlobalAdCarouselClient } from "./GlobalAdCarousel.client";
import type { ResolvedAd } from "./GlobalAdCarousel";

export function ClientHome({
  cities,
  ads,
  renderGrid = true, // NEW: allow page to hide the client grid
}: {
  cities: string[];
  ads: ResolvedAd[];
  renderGrid?: boolean;
}) {
  const [city, setCity] = useState<string | undefined>(undefined);
  const [q, setQ] = useState("");

  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Debounced URL push (kept as-is)
  const debouncedReplace = useMemo(() => {
    let t: any;
    return (url: string) => {
      clearTimeout(t);
      t = setTimeout(() => router.replace(url, { scroll: false }), 300);
    };
  }, [router]);

  const onCityChange = useCallback((v?: string) => setCity(v), []);
  const onSearch = useCallback((s: string) => setQ(s), []);

  useEffect(() => {
    const next = new URLSearchParams(params?.toString() ?? "");

    if (q && q.trim()) next.set("q", q.trim());
    else next.delete("q");

    if (city && city.trim()) next.set("city", city.trim());
    else next.delete("city");

    const qs = next.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;

    debouncedReplace(url);
  }, [q, city, debouncedReplace, pathname, params]);

  return (
    <section className="space-y-4">
      {/* Ads first (as you requested earlier) */}
      {ads?.length > 0 && (
        <div className="pt-1">
          <GlobalAdCarouselClient ads={ads} />
        </div>
      )}

      {/* Controls below ads */}
      <SearchBar onSearch={onSearch} />
      <FiltersBar cities={cities} selectedCity={city} onCityChange={onCityChange} />

      {/* Optional: keep client grid for other contexts;
         page.tsx passes renderGrid={false} to avoid duplicate rendering */}
      {renderGrid && (
        <>
          <h2 id="clubs-heading" className="pt-1 text-lg md:text-xl font-semibold text-white/90">
            Clubs:
          </h2>
          <div role="region" aria-labelledby="clubs-heading">
            <ClubGrid city={city} q={q} />
          </div>
        </>
      )}
    </section>
  );
}
