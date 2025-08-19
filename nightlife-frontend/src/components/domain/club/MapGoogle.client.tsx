// src/components/domain/club/MapGoogle.client.tsx
"use client";
import Script from "next/script";

export function MapGoogle({
  latitude,
  longitude,
  googleMapsUrl,
  name,
}: {
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string | null;
  name: string;
}) {
  const canInit = typeof window !== "undefined" && typeof google !== "undefined" && latitude != null && longitude != null;

  // Render simple link if we don't have coords (avoids the "Oops" pane)
  if (latitude == null || longitude == null) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-white/70 text-sm">Abrir en Google Maps</p>
        {googleMapsUrl && (
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 text-sm text-white">
            Abrir ↗
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Load Maps JS SDK once */}
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
        strategy="afterInteractive"
      />
      <div
        id="club-google-map"
        className="h-56 w-full rounded-xl overflow-hidden"
        ref={(el) => {
          if (!el) return;
          const tryInit = () => {
            // @ts-ignore
            if (typeof google === "undefined" || !google?.maps) {
              setTimeout(tryInit, 300);
              return;
            }
            // @ts-ignore
            const center = new google.maps.LatLng(latitude!, longitude!);
            // @ts-ignore
            const map = new google.maps.Map(el, { center, zoom: 15, disableDefaultUI: true });
            // @ts-ignore
            new google.maps.Marker({ position: center, map, title: name });
          };
          tryInit();
        }}
      />
      {googleMapsUrl && (
        <div className="absolute right-2 bottom-2">
          <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#7A48D3] hover:bg-[#6B3FA0] text-white px-3 py-1.5 text-xs font-semibold shadow">
            Abrir en Google Maps
          </a>
        </div>
      )}
    </div>
  );
}
