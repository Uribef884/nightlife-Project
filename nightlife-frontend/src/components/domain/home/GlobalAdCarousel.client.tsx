// src/components/domain/home/GlobalAdCarousel.client.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResolvedAd } from "./GlobalAdCarousel";

export function GlobalAdCarouselClient({ ads }: { ads: ResolvedAd[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  // Respect user's reduced-motion preference
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    []
  );

  // ---------- Infinite loop helpers (clone head/tail like stories) ----------
  const n = ads?.length ?? 0;
  const cloneCount = n > 1 ? Math.min(2, n) : 0;

  // Build: [tail clones] + real ads + [head clones]
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

    // Align child's center with container's center
    const left = child.offsetLeft - (container.clientWidth - child.clientWidth) / 2;

    container.scrollTo({
      left,
      behavior: smooth ? "smooth" : ("auto" as ScrollBehavior),
    });
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

  // If we've snapped onto a clone, instantly relocate to the real twin
  const maybeRelocateIfClone = useCallback(() => {
    if (cloneCount === 0) return;
    const i = getNearestDisplayIndex();
    const firstReal = cloneCount;
    const lastReal = cloneCount + n - 1;

    if (i < firstReal) {
      // In head clones -> jump forward by n
      centerChildAtIndex(i + n, false);
    } else if (i > lastReal) {
      // In tail clones -> jump backward by n
      centerChildAtIndex(i - n, false);
    }
  }, [cloneCount, n, centerChildAtIndex, getNearestDisplayIndex]);

  // Advance exactly one centered slide
  const scrollByOne = useCallback(
    (dir: 1 | -1) => {
      const current = getNearestDisplayIndex();
      centerChildAtIndex(current + dir, true);
    },
    [centerChildAtIndex, getNearestDisplayIndex]
  );

  // Autoplay (10s) — no UI arrows anymore
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

  // On mount: center the first real slide
  useEffect(() => {
    if (!listRef.current || loopedAds.length === 0) return;
    const r = requestAnimationFrame(() => {
      const startIndex = cloneCount > 0 ? cloneCount : 0;
      centerChildAtIndex(startIndex, false);
    });
    return () => cancelAnimationFrame(r);
  }, [loopedAds.length, cloneCount, centerChildAtIndex]);

  // After any scroll (user/momentum), normalize if we’re on a clone
  useEffect(() => {
    const el = listRef.current;
    if (!el || cloneCount === 0) return;

    let t: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        maybeRelocateIfClone();
      }, 80);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (t) clearTimeout(t);
    };
  }, [maybeRelocateIfClone, cloneCount]);

  if (!ads || n === 0) return null;

  return (
    <section aria-label="Anuncios" className="w-full" ref={wrapRef}>
      <div className="relative">
        {/* Scroll container: horizontal flex track; slides are direct children */}
        <div
          ref={listRef}
          role="list"
          className="
            relative w-full overflow-x-auto scrollbar-thin
            flex gap-4 px-1 py-1
            snap-x snap-mandatory
          "
          // Allow first/last real item to center properly
          style={{ scrollPaddingLeft: 16, scrollPaddingRight: 16 }}
        >
          {loopedAds.map((ad, displayIndex) => {
            const realIndex =
              cloneCount === 0
                ? displayIndex
                : (displayIndex - cloneCount + n) % n;

            const clickable = !!ad.clubId; // only clickable ads redirect
            const hasImg =
              typeof ad.imageUrl === "string" && ad.imageUrl.trim().length > 0;

            const base = clickable ? `/clubs/${ad.clubId}?tab=reservations` : "#";
            const href = clickable
              ? ad.resolvedDate
                ? `${base}&date=${encodeURIComponent(ad.resolvedDate)}`
                : base
              : "#";

            // Center snapping + portrait-like width (stories vibe)
            const snapSizing =
              "flex-none snap-center min-w-[70%] sm:min-w-[52%] md:min-w-[42%] lg:min-w-[34%] xl:min-w-[28%] 2xl:min-w-[24%]";

            // Reusable card
            const Card = (
                <div
                  className="
                    rounded-3xl overflow-hidden border border-white/10 bg-black/20
                    hover:border-nl-secondary/40 transition
                    hover:scale-[1.01] will-change-transform
                  "
                >
                  {/* Taller rectangle so it reads like a story */}
                  <div className="relative h-56 sm:h-64 md:h-72 lg:h-80 xl:h-96">
                    {hasImg ? (
                      <Image
                        src={ad.imageUrl}
                        alt="Anuncio"
                        fill
                        sizes="(max-width: 640px) 70vw, (max-width: 768px) 52vw, (max-width: 1024px) 42vw, 34vw"
                        className="object-cover"
                        priority={displayIndex === (cloneCount || 0)}
                      />
                    ) : (
                      <Image
                        src="/assets/ad-placeholder.svg"
                        alt="Anuncio"
                        fill
                        sizes="(max-width: 640px) 70vw, (max-width: 768px) 52vw, (max-width: 1024px) 42vw, 34vw"
                        className="object-cover"
                        priority={displayIndex === (cloneCount || 0)}
                      />
                    )}

                    {/* Bottom banner: only when ad has redirect (clickable) */}
                    {clickable && (
                      <div
                        className="
                          absolute inset-x-0 bottom-2 flex justify-center
                        "
                        aria-hidden="true"
                      >
                        <div
                          className="
                            rounded-full bg-black/60 backdrop-blur px-3 py-1 text-xs
                            text-white/85 ring-1 ring-white/15
                            group-hover:bg-black/70 group-hover:text-white
                          "
                          title="Ir al anuncio"
                        >
                          {/* arrow only (minimal); sr-only label for a11y */}
                          <span aria-hidden="true">→</span>
                          <span className="sr-only">Ir al anuncio</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
            );

            // IMPORTANT: the direct child of the track (Link/div) carries snap + width
            return clickable ? (
              <Link
                key={`${ad.id}::${displayIndex}`}
                href={href}
                role="listitem"
                data-real-index={realIndex}
                className={`${snapSizing} block h-full group`}
              >
                {Card}
              </Link>
            ) : (
              <div
                key={`${ad.id}::${displayIndex}`}
                role="listitem"
                data-real-index={realIndex}
                className={`${snapSizing} opacity-90`}
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
