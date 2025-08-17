import type { ReactNode } from "react";
import { GlobalAdCarouselClient } from "./GlobalAdCarousel.client";

export type ResolvedAd = {
  id: string;
  clubId: string | null;
  imageUrl: string;
  imageBlurhash?: string | null;
  priority: number;
  isVisible: boolean;
  targetType?: "ticket" | "event" | "club";
  targetId?: string | null;
  label?: "global" | "club";
  resolvedDate?: string | null; // YYYY-MM-DD or null
};

export function GlobalAdCarousel({ ads }: { ads: ResolvedAd[] }) {
  if (!ads || ads.length === 0) return null;
  return <GlobalAdCarouselClient ads={ads} />;
}
