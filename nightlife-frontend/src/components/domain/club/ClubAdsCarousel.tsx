"use client";

import { ClubAdsCarouselClient, type ClubAdClient } from "./ClubAdsCarousel.client";

export type ClubAd = {
  id: string;
  imageUrl: string;
  blurhash?: string | null;
  link?: string | null;      // external or internal
  priority: number;
};

// Very small safety check — allow only http/https or internal paths
function safeHref(url?: string | null): string | null {
  if (!url) return null;
  try {
    if (url.startsWith("/")) return url;
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
    return null;
  } catch {
    return null;
  }
}

export function ClubAdsCarousel({ ads }: { ads: ClubAd[] }) {
  if (!ads || ads.length === 0) return null;

  // Sort by priority (desc) and normalize for client
  const normalized: ClubAdClient[] = [...ads]
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .map((a) => ({
      id: a.id,
      imageUrl: a.imageUrl,
      href: safeHref(a.link),
    }));

  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
      {/* 🔁 Text changed from "Promociones" to "Destacado" */}
      <h3 className="text-white font-semibold mb-3">Destacado</h3>
      <ClubAdsCarouselClient ads={normalized} />
    </div>
  );
}
