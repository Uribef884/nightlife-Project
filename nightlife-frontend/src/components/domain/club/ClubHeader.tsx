// src/components/domain/club/ClubHeader.tsx
"use client";

import Image from "next/image";
import { isOpenNow } from "@/lib/openStatus";
import { ClubSchedule } from "@/components/domain/club/ClubSchedule";

export type ClubHeaderDTO = {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  city: string;
  profileImageUrl?: string | null;
  googleMaps?: string | null;

  dressCode?: string | null;
  minimumAge?: number | null;
  extraInfo?: string | null;
  musicType?: string[] | null;
  openDays?: string[] | null;
  openHours?: Array<{ day: string; open: string; close: string }> | null;
};

type Props = {
  club: ClubHeaderDTO;
  onReservarClick?: () => void; // kept for compatibility
};

/* Helpers */
const title = (s?: string | null) =>
  (s ?? "").trim().toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const dayShortEs: Record<string, string> = {
  sunday: "Dom",
  monday: "Lun",
  tuesday: "Mar",
  wednesday: "Mié",
  thursday: "Jue",
  friday: "Vie",
  saturday: "Sáb",
};

function getTodayHours(
  hours: Array<{ day: string; open: string; close: string }> | null | undefined
) {
  if (!hours || hours.length === 0) return null;
  const jsDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
  return hours.find((h) => (h.day ?? "").toLowerCase() === jsDay.toLowerCase()) ?? null;
}

/* ========================== Icons ========================== */

// Solid T-shirt (sleeves down)
const TshirtIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" {...p}>
    <path fill="currentColor" d="M9 4 L7 6 L4 8 L7 10 V20 H17 V10 L20 8 L17 6 L15 4 L13 6 H11 L9 4 Z" />
  </svg>
);

// Share (arrow out of box, iOS-style)
const ShareIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
    <path d="M12 14V4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M8.5 7.5L12 4l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="5" y="10" width="14" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

const IdCardIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
    <rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="9" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M13.5 10h5M13.5 12h5M13.5 14h3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const CalendarIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);
const ClockIcon = (p: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/* ======================== Component ======================== */

export function ClubHeader({ club }: Props) {
  const open = isOpenNow(club.openHours ?? []);
  const today = getTodayHours(club.openHours);

  const ageText =
    typeof club.minimumAge === "number" && !Number.isNaN(club.minimumAge) ? `+${club.minimumAge}` : null;

  const music = (club.musicType ?? []).map((m) => title(m)).filter(Boolean);
  const openDays = (club.openDays ?? [])
    .map((d) => dayShortEs[d?.toLowerCase?.() ?? ""] || title(d))
    .filter(Boolean);

  return (
    <div className="rounded-2xl bg-[#101423]/80 ring-1 ring-white/10 p-4 sm:p-5">
      {/* ── Top row: avatar + (title/share + mobile pill + address) + desktop pill ── */}
      <div className="flex items-start gap-4">
        {/* Avatar with purple ring */}
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl ring-2 ring-nl-secondary/60 ring-offset-2 ring-offset-[#0B0F1A] bg-[#14192a]">
          {club.profileImageUrl ? (
            <Image
              src={club.profileImageUrl}
              alt={club.name}
              fill
              className="object-cover"
              sizes="80px"
              onError={(e) => {
                const el = (e.currentTarget as HTMLImageElement).parentElement as HTMLElement | null;
                if (el) {
                  el.innerHTML = `<div class="w-full h-full flex items-center justify-center
                    bg-gradient-to-br from-[#6B3FA0]/20 to-[#1C1F33]/60 text-white/70
                    font-semibold text-xl select-none">${
                      (club.name ?? "CL").trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase()
                    }</div>`;
                }
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-[#14192a] text-white/70 font-semibold text-xl select-none">
              {(club.name ?? "CL").trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
            </div>
          )}
        </div>

        {/* Middle: name + share, mobile pill under, address 2-line clamp */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 min-w-0">
            <h1 className="flex-1 min-w-0 text-lg sm:text-xl font-semibold text-white leading-tight break-words">
              {club.name}
            </h1>
            {/* Share icon next to the name */}
            <button
              type="button"
              aria-label="Compartir"
              title="Compartir"
              onClick={async () => {
                const shareData = {
                  title: club.name,
                  text: `Mira ${club.name} en NightLife`,
                  url: typeof window !== "undefined" ? window.location.href : "",
                };
                if (navigator.share && typeof navigator.share === "function") {
                  try {
                    await navigator.share(shareData as ShareData);
                  } catch {}
                } else {
                  try {
                    await navigator.clipboard.writeText(shareData.url);
                  } catch {}
                }
              }}
              className="shrink-0 p-1.5 rounded-md hover:bg-white/10 text-white/80 hover:text-white"
            >
              <ShareIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Mobile-only status pill under the name */}
          <div className="mt-1 sm:hidden">
            <span
              className={[
                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
                open
                  ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                  : "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
              ].join(" ")}
            >
              {open ? "Abierto" : "Cerrado"}
            </span>
          </div>

          {/* Address — clamp to 2 lines on mobile, 1 on >= sm */}
          <p className="mt-1 text-white/70 text-sm break-words line-clamp-2 sm:line-clamp-1">
            {club.address} · {club.city}
          </p>
        </div>

        {/* Desktop-only status pill on the right */}
        <div className="ml-auto hidden sm:block">
          <span
            className={[
              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
              open
                ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
            ].join(" ")}
          >
            {open ? "Abierto" : "Cerrado"}
          </span>
        </div>
      </div>

      {/* ── Información (grid so icons never shrink) ── */}
      {(club.dressCode || ageText || club.extraInfo) && (
        <div className="mt-5 rounded-xl bg-white/[0.03] p-4 ring-1 ring-white/10">
          <div className="text-white font-semibold mb-3">Información:</div>

          <div className="space-y-3">
            {club.dressCode && (
              <div className="grid grid-cols-[1.5rem,1fr] gap-3 items-start">
                <TshirtIcon className="h-6 w-6 mt-0.5 text-nl-accent" />
                <div>
                  <div className="text-white font-medium">Código de vestimenta:</div>
                  <div className="text-white/80">{club.dressCode}</div>
                </div>
              </div>
            )}

            {ageText && (
              <div className="grid grid-cols-[1.5rem,1fr] gap-3 items-start">
                <IdCardIcon className="h-6 w-6 mt-0.5 text-nl-accent" />
                <div>
                  <div className="text-white font-medium">Requisitos de edad:</div>
                  <div className="text-white/80">{ageText}</div>
                </div>
              </div>
            )}


            {club.extraInfo && (
              <div className="grid grid-cols-[1.5rem,1fr] gap-3 items-start">
                <CalendarIcon className="h-6 w-6 mt-0.5 text-nl-accent" />
                <div>
                  <div className="text-white font-medium">Info adicional:</div>
                  <div className="text-white/80">{club.extraInfo}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Compact weekly schedule ── */}
      <div className="mt-4">
        <ClubSchedule openDays={club.openDays} openHours={club.openHours} />
      </div>

      {/* Chips: music + open days (converted to inline-grid so icons never shrink) + today's hours */}
      {(music.length || openDays.length || today) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {music.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {music.map((genre, index) => (
                <span
                  key={index}
                  className="
                    inline-flex items-center
                    rounded-full border border-white/10 bg-white/[0.06]
                    px-2 py-1 text-xs text-white/90
                  "
                >
                  <span className="leading-snug">{genre}</span>
                </span>
              ))}
            </div>
          )}

          {openDays.length > 0 && (
            <span
              className="
                inline-grid grid-cols-[1.25rem,1fr] items-start gap-1
                rounded-full border border-white/10 bg-white/[0.06]
                px-2 py-1 text-xs text-white/90
              "
            >
              <CalendarIcon className="h-5 w-5 text-nl-accent" />
              <span className="leading-snug break-words">{openDays.join(" – ")}</span>
            </span>
          )}

          {today && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-xs text-white/90">
              <ClockIcon className="h-5 w-5 text-nl-accent" /> Hoy: {today.open}–{today.close}
            </span>
          )}
        </div>
      )}

      {club.description && <p className="mt-4 text-white/80 whitespace-pre-line">{club.description}</p>}
    </div>
  );
}
