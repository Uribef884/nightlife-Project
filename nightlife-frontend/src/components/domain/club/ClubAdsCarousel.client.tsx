// src/components/domain/club/ClubAdsCarousel.client.tsx
"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdLightbox, { type AdLike } from "@/components/common/AdLightbox";
import { ImageSpinner } from "@/components/common/Spinner";

export type ClubAdClient = {
  id: string;
  imageUrl: string;

  // optional links (not required for CTA)
  href?: string | null;
  linkRaw?: string | null;

  // ⬇️ NEW: carry targeting through
  targetType?: "ticket" | "event" | "club" | "external" | null;
  targetId?: string | null;
  externalUrl?: string | null; // For external ads only
  clubId?: string | null;
  resolvedDate?: string | null;
};

export function ClubAdsCarouselClient({ ads }: { ads: ClubAdClient[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [imageLoadingStates, setImageLoadingStates] = useState<Record<string, boolean>>({});

  // 🔵 lightbox state
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<AdLike | null>(null);

  const n = ads?.length ?? 0;
  const isSingle = n === 1;

  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    []
  );

  const cloneCount = n > 1 ? Math.min(2, n) : 0;

  const loopedAds = useMemo(() => {
    if (!ads || n === 0) return [];
    if (cloneCount === 0) return ads;
    const head = ads.slice(0, cloneCount);
    const tail = ads.slice(-cloneCount);
    return [...tail, ...ads, ...head];
  }, [ads, n, cloneCount]);

  const centerChildAtIndex = useCallback((displayIndex: number, smooth: boolean) => {
    const container = listRef.current;
    if (!container) return;
    const child = container.children.item(displayIndex) as HTMLElement | null;
    if (!child) return;
    const left = child.offsetLeft - (container.clientWidth - child.clientWidth) / 2;
    container.scrollTo({ left, behavior: smooth ? "smooth" : ("auto" as ScrollBehavior) });
  }, []);

  const getNearestDisplayIndex = useCallback((): number => {
    const container = listRef.current;
    if (!container || !container.children.length) return 0;
    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    let bestI = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < container.children.length; i++) {
      const el = container.children[i] as HTMLElement;
      const elCenter = el.offsetLeft + el.clientWidth / 2;
      const dist = Math.abs(elCenter - containerCenter);
      if (dist < bestDist) { bestDist = dist; bestI = i; }
    }
    return bestI;
  }, []);

  const maybeRelocateIfClone = useCallback(() => {
    if (cloneCount === 0) return;
    const i = getNearestDisplayIndex();
    const firstReal = cloneCount;
    const lastReal = cloneCount + n - 1;
    if (i < firstReal) centerChildAtIndex(i + n, false);
    else if (i > lastReal) centerChildAtIndex(i - n, false);
  }, [cloneCount, n, centerChildAtIndex, getNearestDisplayIndex]);

  const scrollByOne = useCallback(
    (dir: 1 | -1) => {
      const current = getNearestDisplayIndex();
      centerChildAtIndex(current + dir, true);
    },
    [centerChildAtIndex, getNearestDisplayIndex]
  );

  useEffect(() => {
    if (reduceMotion || n <= 1) return;
    const id = setInterval(() => { if (!paused) scrollByOne(1); }, 10000);
    return () => clearInterval(id);
  }, [paused, reduceMotion, n, scrollByOne]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onEnter = () => setPaused(true);
    const onLeave = () => setPaused(false);
    wrap.addEventListener("mouseenter", onEnter);
    wrap.addEventListener("mouseleave", onLeave);
    wrap.addEventListener("focusin", onEnter);
    wrap.addEventListener("focusout", onLeave);
    return () => {
      wrap.removeEventListener("mouseenter", onEnter);
      wrap.removeEventListener("mouseleave", onLeave);
      wrap.removeEventListener("focusin", onEnter);
      wrap.removeEventListener("focusout", onLeave);
    };
  }, []);

  // Initialize loading states for all ads
  useEffect(() => {
    if (ads && ads.length > 0) {
      const initialStates: Record<string, boolean> = {};
      ads.forEach(ad => {
        initialStates[ad.id] = true;
      });
      setImageLoadingStates(initialStates);
    }
  }, [ads]);

  useEffect(() => {
    if (!listRef.current || loopedAds.length === 0) return;
    const r = requestAnimationFrame(() => {
      const startIndex = cloneCount > 0 ? cloneCount : 0;
      centerChildAtIndex(startIndex, false);
    });
    return () => cancelAnimationFrame(r);
  }, [loopedAds.length, cloneCount, centerChildAtIndex]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || cloneCount === 0) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => { if (t) clearTimeout(t); t = setTimeout(() => maybeRelocateIfClone(), 80); };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => { el.removeEventListener("scroll", onScroll); if (t) clearTimeout(t); };
  }, [maybeRelocateIfClone, cloneCount]);

  const handleImageLoad = useCallback((adId: string) => {
    setImageLoadingStates(prev => ({ ...prev, [adId]: false }));
  }, []);

  const handleImageError = useCallback((adId: string) => {
    setImageLoadingStates(prev => ({ ...prev, [adId]: false }));
  }, []);


  // Initialize loading states for all ads
  useEffect(() => {
    if (ads && ads.length > 0) {
      const initialStates: Record<string, boolean> = {};
      ads.forEach(ad => {
        initialStates[ad.id] = true;
      });
      setImageLoadingStates(initialStates);

      // Fallback timeout to hide spinners after 3 seconds
      const timeout = setTimeout(() => {
        setImageLoadingStates(prev => {
          const newStates = { ...prev };
          Object.keys(newStates).forEach(key => {
            newStates[key] = false;
          });
          return newStates;
        });
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [ads]);

  if (!ads || n === 0) return null;

  const singleSizing =
    "w-[70%] sm:w-[52%] md:w-[42%] lg:w-[34%] xl:w-[28%] 2xl:w-[24%] max-w-[900px]";
  const snapSizing =
    "flex-none snap-center min-w-[70%] sm:min-w-[52%] md:min-w-[42%] lg:min-w-[34%] xl:min-w-[28%] 2xl:min-w-[24%]";
  const trackClasses = isSingle
    ? "relative w-full overflow-hidden flex justify-center px-1 py-1"
    : "relative w-full overflow-x-auto scrollbar-thin flex gap-4 px-1 py-1 snap-x snap-mandatory";

  function openLightbox(ad: ClubAdClient) {
    const al: AdLike = {
      id: ad.id,
      imageUrl: ad.imageUrl,

      // pass any link we might have (but not required)
      link: ad.linkRaw ?? ad.href ?? null,

      // ⬇️ MOST IMPORTANT: pass targeting so CTA can be resolved with no link
      targetType: ad.targetType ?? null,
      targetId: ad.targetId ?? null,
      clubId: ad.clubId ?? null,
      resolvedDate: ad.resolvedDate ?? null,
    };
    setCurrent(al);
    setOpen(true);
  }

  return (
    <section aria-label="Destacado del club" className="w-full" ref={wrapRef}>
      <div className="relative">
        <div
          ref={listRef}
          role="list"
          className={trackClasses}
          style={{ scrollPaddingLeft: 16, scrollPaddingRight: 16 }}
        >
          {loopedAds.map((ad, displayIndex) => {
            const outerSizing = isSingle ? singleSizing : snapSizing;
            const isLoading = imageLoadingStates[ad.id] === true;
            const Card = (
              <div className="
                rounded-3xl overflow-hidden border border-white/10 bg-black/20
                hover:border-nl-secondary/40 transition hover:scale-[1.01] will-change-transform
              ">
                <div className="
                  relative aspect-[9/16] max-h-[50vh]
                  sm:aspect-auto sm:max-h-none sm:h-48 md:h-52 lg:h-56 xl:h-64
                ">
                  <Image
                    src={ad.imageUrl}
                    alt="Destacado"
                    fill
                    sizes="(max-width: 640px) 70vw, (max-width: 768px) 52vw, (max-width: 1024px) 42vw, 34vw"
                    className="object-cover"
                    priority={displayIndex === (cloneCount || 0)}
                    onLoad={() => handleImageLoad(ad.id)}
                    onError={() => handleImageError(ad.id)}
                  />
                  {isLoading && <ImageSpinner />}
                </div>
              </div>
            );

            return (
              <button
                key={`${ad.id}::${displayIndex}`}
                onClick={() => openLightbox(ad)}
                role="listitem"
                className={`${outerSizing} block h-full group focus:outline-none`}
              >
                {Card}
              </button>
            );
          })}
        </div>
      </div>

      {/* modal */}
      <AdLightbox open={open} onClose={() => setOpen(false)} ad={current} />
    </section>
  );
}
