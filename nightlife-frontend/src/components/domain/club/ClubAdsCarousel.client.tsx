"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type ClubAdClient = {
  id: string;
  imageUrl: string;
  href?: string | null; // normalized/safe link (internal or external) or null
};

export function ClubAdsCarouselClient({ ads }: { ads: ClubAdClient[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  const n = ads?.length ?? 0;
  const isSingle = n === 1; // special-case: exactly one ad

  // Respect prefers-reduced-motion
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    []
  );

  // Clone head/tail to enable infinite loop (only when we have >1 ad)
  const cloneCount = n > 1 ? Math.min(2, n) : 0;

  const loopedAds = useMemo(() => {
    if (!ads || n === 0) return [];
    if (cloneCount === 0) return ads;
    const head = ads.slice(0, cloneCount);
    const tail = ads.slice(-cloneCount);
    return [...tail, ...ads, ...head];
  }, [ads, n, cloneCount]);

  // Center a slide by its index in loopedAds
  const centerChildAtIndex = useCallback((displayIndex: number, smooth: boolean) => {
    const container = listRef.current;
    if (!container) return;
    const child = container.children.item(displayIndex) as HTMLElement | null;
    if (!child) return;

    const left = child.offsetLeft - (container.clientWidth - child.clientWidth) / 2;
    container.scrollTo({ left, behavior: smooth ? "smooth" : ("auto" as ScrollBehavior) });
  }, []);

  // Which slide is visually centered now?
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
      if (dist < bestDist) {
        bestDist = dist;
        bestI = i;
      }
    }
    return bestI;
  }, []);

  // If the centered slide is a clone, relocate to its real twin instantly
  const maybeRelocateIfClone = useCallback(() => {
    if (cloneCount === 0) return;
    const i = getNearestDisplayIndex();
    const firstReal = cloneCount;
    const lastReal = cloneCount + n - 1;

    if (i < firstReal) centerChildAtIndex(i + n, false);
    else if (i > lastReal) centerChildAtIndex(i - n, false);
  }, [cloneCount, n, centerChildAtIndex, getNearestDisplayIndex]);

  // Advance one slide
  const scrollByOne = useCallback(
    (dir: 1 | -1) => {
      const current = getNearestDisplayIndex();
      centerChildAtIndex(current + dir, true);
    },
    [centerChildAtIndex, getNearestDisplayIndex]
  );

  // Autoplay every 10s (disabled when there’s only one ad)
  useEffect(() => {
    if (reduceMotion || n <= 1) return;
    const id = setInterval(() => {
      if (!paused) scrollByOne(1);
    }, 10000);
    return () => clearInterval(id);
  }, [paused, reduceMotion, n, scrollByOne]);

  // Pause on hover/focus
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

  // Initial center (harmless no-op when single because there’s no scroll)
  useEffect(() => {
    if (!listRef.current || loopedAds.length === 0) return;
    const r = requestAnimationFrame(() => {
      const startIndex = cloneCount > 0 ? cloneCount : 0;
      centerChildAtIndex(startIndex, false);
    });
    return () => cancelAnimationFrame(r);
  }, [loopedAds.length, cloneCount, centerChildAtIndex]);

  // Normalize after scroll (only relevant when we have clones)
  useEffect(() => {
    const el = listRef.current;
    if (!el || cloneCount === 0) return;

    let t: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => maybeRelocateIfClone(), 80);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (t) clearTimeout(t);
    };
  }, [maybeRelocateIfClone, cloneCount]);

  if (!ads || n === 0) return null;

  // Sizing: keep your previous widths for single vs multi
  const singleSizing =
    "w-[70%] sm:w-[52%] md:w-[42%] lg:w-[34%] xl:w-[28%] 2xl:w-[24%] max-w-[900px]";
  const snapSizing =
    "flex-none snap-center min-w-[70%] sm:min-w-[52%] md:min-w-[42%] lg:min-w-[34%] xl:min-w-[28%] 2xl:min-w-[24%]";

  // Track classes:
  const trackClasses = isSingle
    ? "relative w-full overflow-hidden flex justify-center px-1 py-1"
    : "relative w-full overflow-x-auto scrollbar-thin flex gap-4 px-1 py-1 snap-x snap-mandatory";

  // a11y label: singular vs plural
  const aria = isSingle ? "Destacado del club" : "Destacados del club";

  return (
    <section aria-label={aria} className="w-full" ref={wrapRef}>
      <div className="relative">
        <div
          ref={listRef}
          role="list"
          className={trackClasses}
          style={{ scrollPaddingLeft: 16, scrollPaddingRight: 16 }}
        >
          {loopedAds.map((ad, displayIndex) => {
            // Shared card visual
            const Card = (
              <div
                className="
                  rounded-3xl overflow-hidden border border-white/10 bg-black/20
                  hover:border-nl-secondary/40 transition
                  hover:scale-[1.01] will-change-transform
                "
              >
                {/*
                  📱 Mobile (<sm): IG Stories frame (9:16) with object-cover.
                  - We cap height to 75vh to avoid overly tall cards.
                  🖥️ From sm+: keep your original fixed heights (unchanged).
                */}
                <div
                  className="
                    relative
                    aspect-[9/16] max-h-[75vh]   /* IG Stories on mobile */
                    sm:aspect-auto sm:max-h-none  /* reset at sm+ */
                    sm:h-64
                    md:h-72
                    lg:h-80
                    xl:h-96
                  "
                >
                  <Image
                    src={ad.imageUrl}
                    alt="Destacado"
                    fill
                    sizes="(max-width: 640px) 70vw, (max-width: 768px) 52vw, (max-width: 1024px) 42vw, 34vw"
                    className="object-cover"  /* true IG crop */
                    priority={displayIndex === (cloneCount || 0)}
                  />
                </div>
              </div>
            );

            const outerSizing = isSingle ? singleSizing : snapSizing;

            // Link/unlinked variants
            if (ad.href) {
              const isInternal = ad.href.startsWith("/");
              return isInternal ? (
                <Link
                  key={`${ad.id}::${displayIndex}`}
                  href={ad.href}
                  role="listitem"
                  className={`${outerSizing} block h-full group`}
                >
                  {Card}
                </Link>
              ) : (
                <a
                  key={`${ad.id}::${displayIndex}`}
                  href={ad.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  role="listitem"
                  className={`${outerSizing} block h-full group`}
                >
                  {Card}
                </a>
              );
            }

            return (
              <div
                key={`${ad.id}::${displayIndex}`}
                role="listitem"
                className={`${outerSizing} block h-full group`}
              >
                {Card}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
