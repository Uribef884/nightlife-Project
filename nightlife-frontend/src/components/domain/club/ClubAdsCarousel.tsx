// src/components/domain/club/ClubAdsCarousel.tsx
"use client";
import Image from "next/image";

export type ClubAd = {
  id: string;
  imageUrl: string;
  blurhash?: string | null;
  link?: string | null;
  priority: number;
};

export function ClubAdsCarousel({ ads }: { ads: ClubAd[] }) {
  if (!ads || ads.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
      <h3 className="text-white font-semibold mb-3">Promociones</h3>
      <div className="flex gap-4 overflow-x-auto snap-x">
        {ads.sort((a, b) => b.priority - a.priority).map((ad) => {
          const content = (
            <div key={ad.id} className="relative h-40 w-72 shrink-0 snap-start overflow-hidden rounded-xl">
              <Image src={ad.imageUrl} alt="Ad" fill className="object-cover" />
            </div>
          );
          return ad.link ? (
            <a key={ad.id} href={ad.link} target="_blank" rel="noopener noreferrer">{content}</a>
          ) : content;
        })}
      </div>
    </div>
  );
}
