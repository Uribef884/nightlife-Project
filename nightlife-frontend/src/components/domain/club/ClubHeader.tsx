// src/components/domain/club/ClubHeader.tsx
"use client";
import Image from "next/image";
import { isOpenNow } from "@/lib/openStatus";

export type ClubHeaderDTO = {
  id: string;
  name: string;
  description?: string | null;
  address: string;
  city: string;
  profileImageUrl?: string | null;
  openHours?: Array<{ day: string; open: string; close: string }>;
  googleMaps?: string | null;
};

export function ClubHeader({
  club,
  onReservarClick,
}: {
  club: ClubHeaderDTO;
  onReservarClick: () => void;
}) {
  const open = isOpenNow(club.openHours ?? []);
  return (
    <div className="rounded-2xl border border-white/10 p-4 bg-white/5">
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full bg-white/10">
          {club.profileImageUrl ? (
            <Image src={club.profileImageUrl} alt={club.name} fill className="object-cover" />
          ) : (
            <div className="h-full w-full grid place-items-center text-white/50">N</div>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{club.name}</h1>
          <p className="text-white/70 text-sm">{club.address} • {club.city}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full ${open ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-200"}`}>
          {open ? "Abierto ahora" : "Cerrado"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {club.googleMaps && (
          <a
            href={club.googleMaps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 text-sm text-white"
          >
            <span>¿Cómo llegar?</span>
            <span className="opacity-80">↗</span>
          </a>
        )}
        <button
          onClick={onReservarClick}
          className="rounded-full bg-[#7A48D3] hover:bg-[#6B3FA0] text-white px-4 py-1.5 text-sm font-semibold"
        >
          Reservar
        </button>
        <button
          onClick={() => {
            const shareData = { title: club.name, text: club.name, url: typeof window !== "undefined" ? window.location.href : "" };
            if (navigator.share) navigator.share(shareData).catch(() => {});
            else navigator.clipboard.writeText(shareData.url).catch(() => {});
          }}
          className="rounded-full bg-white/10 hover:bg-white/15 text-white px-3 py-1.5 text-sm"
        >
          Compartir
        </button>
      </div>

      {club.description && (
        <p className="mt-4 text-white/80 whitespace-pre-line">{club.description}</p>
      )}
    </div>
  );
}
