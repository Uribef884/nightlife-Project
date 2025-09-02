// src/components/domain/club/ClubAdsCarousel.tsx
"use client";

import { ClubAdsCarouselClient, type ClubAdClient } from "./ClubAdsCarousel.client";

export type ClubAd = {
  id: string;
  imageUrl: string;
  blurhash?: string | null;
  priority: number;

  // might exist, but not required for CTA
  link?: string | null;

  // ⬇️ NEW: targeting info coming from backend
  targetType?: "ticket" | "event" | "club" | "external";
  targetId?: string | null;
  externalUrl?: string | null; // For external ads only
  clubId?: string | null;
  resolvedDate?: string | null; // YYYY-MM-DD
};

// Allow only http/https or internal paths (used only if we directly render a link)
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

      // keep both: sanitized link (rarely used) + raw (for completeness)
      href: safeHref(a.link),
      linkRaw: a.link ?? null,

      // ⬇️ pass targeting through so the lightbox can build the CTA with no link
      targetType: a.targetType ?? null,
      targetId: a.targetId ?? null,
      clubId: a.clubId ?? null,
      resolvedDate: a.resolvedDate ?? null,
    }));

  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
      <h3 className="text-white font-semibold mb-3">Destacado</h3>
      <ClubAdsCarouselClient ads={normalized} />
    </div>
  );
}
