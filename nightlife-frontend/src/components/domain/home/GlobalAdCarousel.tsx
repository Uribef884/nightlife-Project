import { GlobalAdCarouselClient } from "./GlobalAdCarousel.client";

/**
 * Keep the ResolvedAd type **here** (the wrapper) and export it.
 * The client imports this type from here to avoid circular imports.
 */
export type ResolvedAd = {
  id: string;
  clubId: string | null;
  imageUrl: string;
  imageBlurhash?: string | null;
  priority: number;
  isVisible: boolean;
  targetType?: "ticket" | "event" | "club" | "external";
  targetId?: string | null;
  externalUrl?: string | null; // For external ads only
  label?: "global" | "club";
  resolvedDate?: string | null; // YYYY-MM-DD or null
};

export function GlobalAdCarousel({ ads }: { ads: ResolvedAd[] }) {
  if (!ads || ads.length === 0) return null;

  // Match the club ads container chrome (no heading on homepage)
  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
      <GlobalAdCarouselClient ads={ads} />
    </div>
  );
}
