"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveAdCTA } from "@/services/ads.service";

/**
 * Minimal shape for an Ad, based on your JSON example.
 * If your Ad type already exists, replace this with your import.
 */
export type AdDTO = {
  id: string;
  clubId: string | null;     // ads can be global, so this might be null
  imageUrl: string;
  imageBlurhash?: string | null;
  priority: number;
  isVisible: boolean;
  targetType: "ticket" | "event" | null;
  targetId: string | null;
  label?: string | null;
  link?: string | null;
};

type CTA = {
  label: string; // ex: "Ir a Reservas – 2025-09-12"
  href: string;  // ex: /clubs/<clubId>?tab=reservas&date=YYYY-MM-DD&focusTicket=<id?>
};

type Props = {
  open: boolean;
  onClose: () => void;
  ad: AdDTO | null;
};

/**
 * Full-screen lightbox for viewing an ad poster.
 * - Locks background scroll
 * - Closes on X, backdrop, or Esc
 * - If ad has a linked ticket/event, shows a CTA button to go to reservas on the right date
 */
export default function AdLightbox({ open, onClose, ad }: Props) {
  const router = useRouter();
  const [cta, setCta] = useState<CTA | null>(null);
  const [loadingCTA, setLoadingCTA] = useState(false);

  // Lock scroll while open
  useEffect(() => {
    if (!open) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Resolve CTA when ad changes
  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!open || !ad) {
        setCta(null);
        return;
      }
      setLoadingCTA(true);
      try {
        const res = await resolveAdCTA(ad);
        if (!cancel) setCta(res);
      } catch {
        if (!cancel) setCta(null);
      } finally {
        if (!cancel) setLoadingCTA(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, ad]);

  if (!open || !ad) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85"
      onClick={onClose} // backdrop click closes
    >
      {/* CONTENT WRAPPER: stop propagation so clicks inside don't close */}
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

        {/* Image */}
        <div className="w-full h-full flex items-center justify-center p-4">
          {/* The image scales to fit view without distortion */}
          {/* Use loading=lazy to avoid layout jank */}
          <img
            src={ad.imageUrl}
            alt={ad.label ?? "Publicidad"}
            className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
            loading="lazy"
          />
        </div>

        {/* CTA Banner (conditional) */}
        {cta ? (
          <div className="absolute bottom-0 left-0 right-0 bg-white/10 backdrop-blur border-t border-white/15 p-4 flex justify-center">
            <button
              onClick={() => router.push(cta.href)}
              className="px-4 py-2 rounded-2xl bg-white text-black font-semibold hover:opacity-90 transition"
            >
              {cta.label}
            </button>
          </div>
        ) : (
          // Small status if target exists but still loading resolution
          ad.targetType && loadingCTA ? (
            <div className="absolute bottom-0 left-0 right-0 bg-white/5 text-white/80 text-center text-sm py-2">
              Preparando redirección…
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
