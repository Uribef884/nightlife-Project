// src/components/domain/home/ClubGrid.tsx
"use client";

import { useEffect, useState } from "react";
import { Club, getClubs } from "@/lib/apiClient"; // ✅ fixed alias
import { ClubCard } from "./ClubCard";

export function ClubGrid({ city, q }: { city?: string; q?: string }) {
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    setClubs(null);

    getClubs({ city, q })
      .then((res: Club[]) => {           // ✅ typed
        if (!alive) return;
        setClubs(res);
      })
      .catch((e: unknown) => {           // ✅ typed
        if (!alive) return;
        const message =
          typeof e === "object" && e && "message" in e ? String((e as Record<string, unknown>).message) : "Error cargando clubes";
        setError(message);
      });

    return () => {
      alive = false;
    };
  }, [city, q]);

  if (error) {
    return (
      <div className="text-red-400 bg-red-500/10 border border-red-500/30 p-3 rounded-2xl">
        {error}
      </div>
    );
  }

  if (!clubs) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden border border-white/10 bg-black/30 animate-pulse h-48"
          />
        ))}
      </div>
    );
  }

  if (clubs.length === 0) {
    return <div className="text-white/70">No hay clubes para esta búsqueda.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {clubs.map((club) => (
        <ClubCard key={club.id} club={club} />
      ))}
    </div>
  );
}
