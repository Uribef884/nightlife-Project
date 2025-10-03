// src/components/domain/home/clubCard.tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { ClubListItem } from "@/services/clubs.service";
import type { Club as ApiClub } from "@/lib/apiClient";
import { getClubByIdCSR } from "@/services/clubs.service";
import { ImageSpinner } from "@/components/common/Spinner";

/**
 * Accept either our list DTO (ClubListItem) or the broader API `Club` type.
 * This keeps the component working regardless of which caller you use.
 */
type CardClub = ClubListItem | ApiClub;

/* ────────────── Small per-tab cache to avoid re-fetching cities ───────────── */
const CITY_CACHE = new Map<string, string>();
const CITY_INFLIGHT = new Map<string, Promise<string | null>>();

async function resolveCity(clubId: string): Promise<string | null> {
  if (CITY_CACHE.has(clubId)) return CITY_CACHE.get(clubId)!;

  const existing = CITY_INFLIGHT.get(clubId);
  if (existing) return existing;

  const p = (async () => {
    try {
      const detail = await getClubByIdCSR(clubId);
      const c = detail?.city?.trim() || null;
      if (c) CITY_CACHE.set(clubId, c);
      return c;
    } catch {
      return null;
    } finally {
      CITY_INFLIGHT.delete(clubId);
    }
  })();

  CITY_INFLIGHT.set(clubId, p);
  return p;
}

// Helper: initials when we have no image AND you later remove the svg
function initials(name: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

export function ClubCard({ club }: { club: CardClub }) {
  // Defensive access for profile image across both shapes
  const profileImageUrl =
    (club as Record<string, unknown>).profileImageUrl ?? (club as Record<string, unknown>).imageUrl ?? null;

  const hasImage =
    typeof profileImageUrl === "string" && profileImageUrl.trim().length > 0;

  // Base city from the list row (may be missing)
  const cityProp: string =
    "city" in club && typeof (club as Record<string, unknown>).city === "string" ? (club as Record<string, unknown>).city as string : "";

  // If city is missing, we lazy-fetch the detail and cache it
  const [cityResolved, setCityResolved] = useState<string>("");
  const [imageLoading, setImageLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!cityProp && club.id) {
      resolveCity(String(club.id)).then((c) => {
        if (!cancelled && c) setCityResolved(c);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [cityProp, club.id]);

  const cityToShow = (cityProp || cityResolved || "").trim();
  const showCityRow = cityToShow.length > 0;

  return (
    <Link
      href={`/clubs/${club.id}`}
      aria-label={`Abrir ${club.name}`}
      className="
        group flex items-center gap-3 w-full
        rounded-xl border border-nl-secondary/30 bg-nl-card shadow-soft
        hover:border-nl-secondary/60 transition
        px-3 py-2.5 sm:px-4 sm:py-3
      "
    >
      {/* Left: square image with purple outline; falls back to svg placeholder */}
      <div
        className="
          relative w-16 h-16 sm:w-18 sm:h-18 lg:w-20 lg:h-20 shrink-0
          rounded-xl sm:rounded-2xl overflow-hidden
          ring-1 sm:ring-2 ring-nl-secondary/60
          bg-black/20
        "
      >
        {hasImage ? (
          <>
            <Image
              src={profileImageUrl!}
              alt={club.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 64px, (max-width: 1024px) 72px, 80px"
              onLoad={() => setImageLoading(false)}
              onError={() => setImageLoading(false)}
            />
            {imageLoading && <ImageSpinner />}
          </>
        ) : (
          <Image
            src="/assets/club-placeholder.svg"
            alt={`${club.name} (sin imagen)`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 64px, (max-width: 1024px) 72px, 80px"
            onLoad={() => setImageLoading(false)}
            onError={(e) => {
              setImageLoading(false);
              const el = (e.currentTarget as HTMLImageElement).parentElement as HTMLElement | null;
              if (el) {
                el.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#6B3FA0]/20 to-black/60"><span class="text-white/80 font-semibold text-base sm:text-lg lg:text-xl">${initials(
                  club.name
                )}</span></div>`;
              }
            }}
          />
        )}
      </div>

      {/* Middle: title + address (with red pin) */}
      <div className="min-w-0 flex-1">
        <h3 className="text-white/90 font-semibold text-base sm:text-lg lg:text-xl leading-tight line-clamp-2">
          {club.name}
        </h3>

        {/* Address row (always render if present in list payload) */}
        <div className="mt-1 flex items-start gap-1.5 sm:gap-2">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="mt-[2px] h-4 w-4 sm:h-4 sm:w-4 text-nl-accent flex-none"
            fill="currentColor"
          >
            <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z" />
          </svg>
          <p className="text-white/80 text-sm sm:text-sm leading-snug line-clamp-2 sm:line-clamp-3">
            {club.address}
          </p>
        </div>

        {/* City row (lazy-hydrated). Only render when we actually have a city. */}
        {showCityRow && (
          <div className="mt-1 flex items-start gap-1.5 sm:gap-2">
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="mt-[2px] h-4 w-4 sm:h-4 sm:w-4 text-nl-accent flex-none"
              fill="currentColor"
              focusable="false"
            >
              {/* Solid skyline silhouette designed to read at 16px */}
              {/* ground */}
              <path d="M2 21h20v1H2z" />
              {/* single building with pointed roof */}
              <path d="M12 5l4 4v12H8V9l4-4z" />
            </svg>
            <p className="text-white/80 text-sm sm:text-sm leading-snug">{cityToShow}</p>
          </div>
        )}
      </div>

      {/* Right: red chevron, purely decorative */}
      <div className="flex items-center justify-center">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-nl-accent transform transition-transform group-hover:translate-x-0.5"
          fill="currentColor"
        >
          <path d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41 0Z" />
        </svg>
      </div>
    </Link>
  );
}
