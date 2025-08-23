// src/components/domain/club/MapGoogle.client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Script from "next/script";

type Props = {
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string | null;
  name: string;
  /** If the parent also renders an "Abrir en Google Maps" CTA, set this to false here */
  showOpenButton?: boolean;
  /** Enable instrumentation overlay & console logs */
  debug?: boolean;
  /** Optional map zoom (applies to JS + static). Clamped to [3,20]. */
  initialZoom?: number;
};

// Fallback centers when coords are missing
const FALLBACK_CENTERS = [
  { lat: 6.25184, lng: -75.56359, label: "Medellín" },
  { lat: 4.711, lng: -74.0721, label: "Bogotá" },
  { lat: 40.758, lng: -73.9855, label: "Times Square" },
];

type Status = "loading" | "waiting-google" | "ok-js" | "fallback";

/* ────────────────────────────── Theme color ──────────────────────────────── */
/** Nightlife secondary color from Tailwind (tailwind.config.js -> nl.secondary) */
const NL_SECONDARY_HEX = "#6B3FA0";         // for JS marker
const NL_SECONDARY_STATIC = "0x6B3FA0";     // for Google Static Maps `color:` param

/* ────────────────────────────── Debug helpers ────────────────────────────── */
type DebugEvent = { t: number; tag: string; data?: Record<string, any> };
function now() { return typeof performance !== "undefined" ? performance.now() : Date.now(); }
function mark(name: string) { try { performance.mark(name); } catch { /* no-op */ } }
function measure(name: string, start: string, end: string) {
  try { performance.measure(name, start, end); const m = performance.getEntriesByName(name).pop(); return m?.duration ?? 0; }
  catch { return 0; }
}
function useDebugEnabled(debugProp?: boolean) {
  const [debug, setDebug] = useState<boolean>(() => {
    if (debugProp) return true;
    if (process.env.NEXT_PUBLIC_NL_MAP_DEBUG === "1") return true;
    try {
      if (typeof window !== "undefined") {
        const sp = new URL(window.location.href).searchParams;
        if (sp.get("debugMap") === "1") return true;
        if (window.localStorage.getItem("nl.mapDebug") === "1") return true;
      }
    } catch {}
    return false;
  });

  useEffect(() => {
    const w = window as any;
    w.nlMapDebug = w.nlMapDebug || {};
    w.nlMapDebug.toggle = () => setDebug((d: boolean) => {
      try { window.localStorage.setItem("nl.mapDebug", (!d) ? "1" : "0"); } catch {}
      return !d;
    });
    w.nlMapDebug.on  = () => { try { window.localStorage.setItem("nl.mapDebug", "1"); } catch {}; setDebug(true); };
    w.nlMapDebug.off = () => { try { window.localStorage.setItem("nl.mapDebug", "0"); } catch {}; setDebug(false); };

    const onKey = (e: KeyboardEvent) => { if (e.altKey && (e.key === "d" || e.key === "D")) w.nlMapDebug.toggle(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return debug;
}

/* ───────────────────────────── Security helpers ──────────────────────────── */
/** Allow only https Google Maps hosts (share links etc.). Returns safe URL or null. */
function sanitizeGoogleMapsUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    const allow = [
      "google.com", "www.google.com", "maps.google.com",
      "maps.app.goo.gl", "goo.gl", "g.co",
    ];
    const ok = allow.some((h) => host === h || host.endsWith("." + h));
    return ok ? url.toString() : null;
  } catch { return null; }
}

/* ───────────────────────────────── Component ─────────────────────────────── */
export default function MapGoogle({
  latitude,
  longitude,
  googleMapsUrl,
  name,
  showOpenButton = true,
  debug: debugProp,
  initialZoom,
}: Props) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>(key ? "loading" : "fallback");
  const [scriptReady, setScriptReady] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [useOsmImage, setUseOsmImage] = useState(false);

  // Debug state
  const debug = useDebugEnabled(debugProp);
  const [events, setEvents] = useState<DebugEvent[]>([]);
  const [fallbackReason, setFallbackReason] = useState<string>("");
  const t0Ref = useRef<number>(now()); // mount time
  function log(tag: string, data?: Record<string, any>) {
    if (!debug) return;
    const entry = { t: now() - t0Ref.current, tag, data };
    setEvents((evts) => [...evts.slice(-11), entry]);
    // eslint-disable-next-line no-console
    console.log(`[MapDebug] ${tag}`, data || "");
  }

  // ── Coords / center ────────────────────────────────────────────────────────
  const hasCoords =
    latitude != null && longitude != null &&
    Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));

  const center = useMemo(() => {
    const c = hasCoords
      ? { lat: Number(latitude), lng: Number(longitude), label: name || "Club" }
      : FALLBACK_CENTERS[Math.floor(Math.random() * FALLBACK_CENTERS.length)];
    if (debug) log("center", { hasCoords, ...c });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCoords, latitude, longitude, name, debug]);

  // ── Zoom computation (applies to JS + static) ──────────────────────────────
  const zoom = useMemo(() => {
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
    // Defaults: street-level when we have coords; wider for city fallback.
    const def = hasCoords ? 16 : 12;
    const z = typeof initialZoom === "number" && Number.isFinite(initialZoom) ? initialZoom : def;
    const clamped = clamp(Math.round(z), 3, 20);
    if (debug) log("zoom", { requested: initialZoom, resolved: clamped, hasCoords });
    return clamped;
  }, [initialZoom, hasCoords, debug]);

  /* ── PRE-SCRIPT watchdog: if Script never loads, fall back quickly (~3.5s) ─ */
  useEffect(() => {
    if (!key) { setStatus("fallback"); setFallbackReason("no-key"); log("fallback", { reason: "no-key" }); return; }
    if (scriptReady) return;

    mark("script_wait_start"); log("script_wait_start");
    const t = setTimeout(() => {
      if (!scriptReady) {
        setStatus("fallback"); setFallbackReason("script-timeout");
        const dur = measure("script_wait_timeout", "script_wait_start", "script_wait_timeout");
        log("fallback", { reason: "script-timeout", durationMs: dur });
      }
    }, 3500);
    setTimeout(() => mark("script_wait_timeout"), 0);
    return () => clearTimeout(t);
  }, [key, scriptReady]);

  /* ── POST-SCRIPT boot: try to init google.maps; watchdog ~7s ─────────────── */
  useEffect(() => {
    if (!mapRef.current || !key || !scriptReady) return;

    setStatus("waiting-google"); mark("boot_start"); log("boot_start");
    let cancelled = false; let tries = 0;

    const watchdog = setTimeout(() => {
      if (!cancelled && status !== "ok-js") {
        setStatus("fallback"); setFallbackReason("boot-timeout");
        const dur = measure("boot_timeout", "boot_start", "boot_timeout");
        log("fallback", { reason: "boot-timeout", durationMs: dur });
      }
    }, 7000);
    setTimeout(() => mark("boot_timeout"), 0);

    const boot = () => {
      const g = (globalThis as any).google;
      if (!g?.maps) {
        if (tries++ < 30 && !cancelled) { setTimeout(boot, 100); }
        return;
      }

      try {
        mark("google_detected");
        const pos = new g.maps.LatLng(center.lat, center.lng);

        // ── Custom purple pin icon (matches Tailwind nl.secondary) ──────────
        const icon = {
          url:
            "data:image/svg+xml;utf8," +
            encodeURIComponent(
              `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
                 <path d="M18 2c-6.1 0-11 4.9-11 11 0 8.25 11 21 11 21s11-12.75 11-21c0-6.1-4.9-11-11-11z" fill="${NL_SECONDARY_HEX}"/>
                 <circle cx="18" cy="13" r="4" fill="white" fill-opacity=".9"/>
               </svg>`
            ),
          anchor: new g.maps.Point(18, 33),
          scaledSize: new g.maps.Size(36, 36),
        };

        const map = new g.maps.Map(mapRef.current!, {
          center: pos,
          zoom,
          disableDefaultUI: true,
          gestureHandling: "greedy",
        });

        new g.maps.Marker({ position: pos, map, title: center.label, icon });

        mark("map_ready");
        const durScript = measure("script_download", "script_wait_start", "script_ready");
        const durBoot   = measure("boot_google", "boot_start", "map_ready");
        log("ok-js", { scriptDownloadMs: durScript, bootMs: durBoot });
        if (!cancelled) setStatus("ok-js");
      } catch (e) {
        log("boot_error", { message: String(e) });
        if (!cancelled) { setStatus("fallback"); setFallbackReason("boot-error"); }
      } finally {
        clearTimeout(watchdog);
      }
    };

    boot();
    return () => { cancelled = true; clearTimeout(watchdog); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, key, center.lat, center.lng, zoom, reloadNonce]);

  /* ── Static IMAGE fallbacks (no iframes) ─────────────────────────────────── */
  const googleStaticUrl = useMemo(() => {
    if (!key) return "";
    const size = "800x300"; // larger, will be downscaled by CSS
    const marker = `color:${NL_SECONDARY_STATIC}|${center.lat},${center.lng}`; // <-- purple static pin
    return (
      `https://maps.googleapis.com/maps/api/staticmap?center=${center.lat},${center.lng}` +
      `&zoom=${zoom}&size=${size}&scale=2&maptype=roadmap` +
      `&markers=${encodeURIComponent(marker)}&key=${encodeURIComponent(key)}`
    );
  }, [key, center.lat, center.lng, zoom]);

  const osmStaticUrl = useMemo(() => {
    const size = "800x300";
    return (
      `https://staticmap.openstreetmap.de/staticmap.php?center=${center.lat},${center.lng}` +
      `&zoom=${zoom}&size=${size}&markers=${center.lat},${center.lng},violet-pushpin`
    );
  }, [center.lat, center.lng, zoom]);

  function handleRetry() {
    setReloadNonce((n) => n + 1);
    setScriptReady(false);
    setStatus(key ? "loading" : "fallback");
    setUseOsmImage(false);
    setFallbackReason("");
    log("retry");
  }

  const safeMapsUrl = sanitizeGoogleMapsUrl(googleMapsUrl);

  return (
    <div className="relative">
      {/* Load JS SDK immediately when we have a key (fast path). */}
      {!!key && status !== "ok-js" && (
        <Script
          key={reloadNonce}
          src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&_nl=${reloadNonce}`}
          strategy="afterInteractive"
          onReady={() => {
            setScriptReady(true);
            mark("script_ready");
            const dur = measure("script_insert_to_ready", "script_inserted", "script_ready");
            log("script_ready", { downloadMs: dur });
          }}
          onError={() => {
            setStatus("fallback");
            setFallbackReason("script-error");
            log("fallback", { reason: "script-error" });
          }}
          onLoad={() => {
            mark("script_inserted");
            log("script_inserted");
          }}
        />
      )}

      {/* JS map container */}
      <div
        ref={mapRef}
        className="h-56 w-full rounded-xl overflow-hidden bg-black/20 ring-1 ring-white/10"
        aria-label="Mapa de ubicación"
      />

      {/* Static image fallback (Google Static → OSM). Also used until JS boots when status === 'fallback' */}
      {status === "fallback" && (
        <img
          src={useOsmImage || !googleStaticUrl ? osmStaticUrl : googleStaticUrl}
          alt={`Mapa estático: ${center.label}`}
          className="absolute inset-0 h-full w-full object-cover rounded-xl pointer-events-none select-none ring-1 ring-white/10"
          referrerPolicy="no-referrer"
          draggable={false}
          onLoad={() => {
            mark("static_img_loaded");
            const dur = measure("static_img_time", "script_wait_start", "static_img_loaded");
            log("static_img_loaded", { fromScriptWaitMs: dur, provider: useOsmImage || !googleStaticUrl ? "OSM" : "Google" });
          }}
          onError={() => { log("static_img_error"); setUseOsmImage(true); }}
        />
      )}

      {/* Loading overlay (spinner only — no noisy text) */}
      {(status === "loading" || status === "waiting-google") && (
        <div className="absolute inset-0 grid place-items-center bg-black/20 z-10">
          <div
            className="inline-flex items-center justify-center rounded-full bg-black/70 px-3 py-2 ring-1 ring-white/15"
            role="status"
            aria-live="polite"
            aria-label="Cargando mapa"
          >
            <svg className="h-4 w-4 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
              <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" />
            </svg>
            <span className="text-white/90 text-xs">Cargando mapa…</span>
          </div>
        </div>
      )}

      {/* Retry (top-right) only when we fell back but have an API key */}
      {status === "fallback" && !!key && (
        <div className="absolute right-2 top-2 z-10">
          <button
            type="button"
            onClick={handleRetry}
            className="rounded-full bg-[#7A48D3] hover:bg-[#6B3FA0] text-white px-3 py-1.5 text-xs font-semibold shadow"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* External open-in-Maps button (bottom-right) — only when usable and if enabled; URL sanitized */}
      {showOpenButton && safeMapsUrl && (status === "ok-js" || status === "fallback") && (
        <div className="absolute right-2 bottom-2 z-10">
          <a
            href={safeMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-[#7A48D3] hover:bg-[#6B3FA0] text-white px-3 py-1.5 text-xs font-semibold shadow"
            title="Abrir en Google Maps"
          >
            Abrir en Google Maps
          </a>
        </div>
      )}

      {/* ── Debug overlay (only when debug is enabled) ─────────────────────── */}
      {debug && (
        <div className="absolute left-2 bottom-2 z-20 max-w-[70%]">
          <div className="rounded-lg bg-black/70 text-white/90 text-[11px] leading-snug p-2 ring-1 ring-white/15">
            <div className="font-semibold mb-1">Map Debug</div>
            <div className="grid grid-cols-2 gap-x-2">
              <div>Status:</div><div className="text-white">{status}</div>
              <div>Fallback reason:</div><div>{fallbackReason || "-"}</div>
              <div>Script ready:</div><div>{String(scriptReady)}</div>
              <div>Has key:</div><div>{String(!!key)}</div>
              <div>Coords:</div><div>{hasCoords ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}` : "fallback city"}</div>
              <div>Zoom:</div><div>{zoom}</div>
            </div>
            <div className="mt-2 opacity-90">Events:</div>
            <ul className="mt-1 max-h-28 overflow-auto space-y-0.5">
              {events.map((e, i) => (
                <li key={i} className="font-mono">
                  <span className="opacity-70">{e.t.toFixed(0)}ms</span>{" "}
                  <span className="text-white">{e.tag}</span>{" "}
                  {e.data ? <span className="opacity-80">{JSON.stringify(e.data)}</span> : null}
                </li>
              ))}
            </ul>
            <div className="mt-1 opacity-80">Toggle: Alt+D or <code>window.nlMapDebug.toggle()</code></div>
          </div>
        </div>
      )}
    </div>
  );
}
