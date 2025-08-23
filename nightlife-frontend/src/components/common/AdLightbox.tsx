"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveAdCTA } from "@/services/ads.service";

export type AdLike = {
  id: string;
  imageUrl: string;
  targetType?: "ticket" | "event" | "club" | null;
  targetId?: string | null;
  clubId?: string | null;
  resolvedDate?: string | null;
  link?: string | null; // optional fallback URL (internal/external)
};

type CTA = { label: string; href: string };

function safeHref(url?: string | null): string | null {
  if (!url) return null;
  try {
    if (url.startsWith("/")) return url;
    const u = new URL(url);
    if (u.protocol === "https:" || u.protocol === "http:") return u.toString();
    return null;
  } catch {
    return null;
  }
}

/** Shared helper to switch to reservas tab on the SAME page */
function goToReservasFromHref(href: string) {
  if (typeof window === "undefined") return false;
  try {
    const u = new URL(href, window.location.origin);
    if (u.pathname !== window.location.pathname) return false;

    const date = u.searchParams.get("date") ?? undefined;

    const url = new URL(window.location.href);
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      url.searchParams.set("date", date);
    }
    const next = `${url.pathname}${url.search ? `?${url.searchParams.toString()}` : ""}#reservas`;

    if (next !== window.location.href) {
      history.pushState({}, "", next);
    }
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.dispatchEvent(new PopStateEvent("popstate"));
    return true;
  } catch {
    return false;
  }
}

export function AdLightbox({
  open,
  onClose,
  ad,
}: {
  open: boolean;
  onClose: () => void;
  ad: AdLike | null;
}) {
  const router = useRouter();
  const [cta, setCta] = useState<CTA | null>(null);
  const [loading, setLoading] = useState(false);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Resolve CTA whenever we open with a given ad
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!open || !ad) {
        setCta(null);
        return;
      }
      setLoading(true);
      try {
        const res = await resolveAdCTA(ad);
        if (!cancelled) setCta(res);
      } catch {
        if (!cancelled) setCta(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, ad]);

  if (!open || !ad) return null;

  const fallbackHref = !cta ? safeHref(ad.link) : null;
  const isInternalFallback = !!fallbackHref && fallbackHref.startsWith("/");

  const handleCta = (href: string) => {
    // If href points to the same club page, switch tab/date in-place.
    if (goToReservasFromHref(href)) {
      onClose();
      return;
    }
    // Otherwise, navigate normally.
    router.push(href);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full max-w-4xl mx-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close (X) */}
        <button
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute left-4 top-4 text-white text-3xl font-bold"
        >
          ×
        </button>

        {/* Poster image */}
        <div className="w-full h-full flex items-center justify-center p-4">
          <img
            src={ad.imageUrl}
            alt="Anuncio"
            className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
            loading="lazy"
          />
        </div>

        {/* CTA zone */}
        {cta ? (
          <div className="absolute bottom-0 left-0 right-0 bg-white/10 backdrop-blur border-t border-white/15 p-4 flex justify-center">
            <button
              onClick={() => handleCta(cta.href)}
              className="px-4 py-2 rounded-2xl bg-white text-black font-semibold hover:opacity-90 transition"
            >
              {cta.label}
            </button>
          </div>
        ) : fallbackHref ? (
          <div className="absolute bottom-0 left-0 right-0 bg-white/10 backdrop-blur border-t border-white/15 p-4 flex justify-center">
            {isInternalFallback ? (
              <button
                onClick={() => handleCta(fallbackHref)}
                className="px-4 py-2 rounded-2xl bg-white text-black font-semibold hover:opacity-90 transition"
              >
                Abrir enlace
              </button>
            ) : (
              <a
                href={fallbackHref}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-2xl bg-white text-black font-semibold hover:opacity-90 transition"
              >
                Abrir enlace
              </a>
            )}
          </div>
        ) : ad.targetType || ad.link ? (
          <div className="absolute bottom-0 left-0 right-0 bg-white/5 text-white/80 text-center text-sm py-2">
            {loading ? "Preparando redirección…" : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default AdLightbox;
