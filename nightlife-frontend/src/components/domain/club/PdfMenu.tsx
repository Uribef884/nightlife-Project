// src/components/domain/club/PdfMenu.tsx
"use client";

/**
 * Desktop  → IFRAME (native PDF controls), keeps `height` prop.
 * Mobile   → IMAGES (manifest) with swipe + pinch-to-zoom + double-tap zoom.
 *            No black letterboxing: image is width: 100%, height: auto.
 *            Bottom pill (← 1 / N →) + dots BELOW the image (not overlay).
 *            When zoomed (>1.02), page-swipe is disabled and user can pan.
 *
 * Deps:
 *  - detectDevice() from "@/lib/deviceDetection"
 *  - useSwipe() from "@/components/common/useSwipe"
 *  - usePinchZoom() from "@/components/common/usePinchZoom"
 */

import * as React from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { detectDevice } from "@/lib/deviceDetection";
import { useSwipe } from "@/components/common/useSwipe";
import { usePinchZoom } from "@/components/common/usePinchZoom";

// ---------------- Types ----------------
interface PageImage {
  url: string;
  w: number;
  h: number;
  bytes: number;
}
interface Thumbnail {
  url: string;
  w: number;
  h: number;
}
interface MenuManifest {
  pageCount: number;
  format: "webp";
  width: number;
  height: number;
  pages: PageImage[];
  thumbs: Thumbnail[];
  createdAt: string;
}

// ---------------- Component ----------------
export function PdfMenu({
  url,
  filename,
  height = "70vh",
  className = "",
  clubId,
  menuId,
}: {
  url: string;
  filename?: string | null;
  height?: number | string;
  className?: string;
  clubId?: string;
  menuId?: string;
}) {
  // Security: allow only http/https schemes
  const safeUrl = useMemo(() => {
    try {
      const u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch {}
    return "";
  }, [url]);

  // Device flags
  const [deviceInfo, setDeviceInfo] = useState(() => detectDevice());
  const isMobile = deviceInfo.isMobile;
  const isDesktop = !isMobile;

  // Common loading
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // ---------- Desktop iframe controls ----------
  const [renderError, setRenderError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [zoomDesktop, setZoomDesktop] = useState(100);
  const [refreshKey, setRefreshKey] = useState(0);

  // ---------- Mobile image viewer state ----------
  const [manifest, setManifest] = useState<MenuManifest | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [page, setPage] = useState(0); // 0-based index
  const [slideDir, setSlideDir] = useState<"left" | "right" | null>(null);
  const [enterKey, setEnterKey] = useState(0);
  const pageCount = manifest?.pageCount ?? 0;

  // Re-detect on resize (helps with orientation change)
  useEffect(() => {
    const fn = () => setDeviceInfo(detectDevice());
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // ---------- Load manifest ONLY on mobile ----------
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!isMobile) {
        // Desktop: show iframe only
        setIsLoading(false);
        setManifest(null);
        setManifestError(false);
        return;
      }

      setIsLoading(true);
      setManifest(null);
      setManifestError(false);
      setPage(0);

      if (!clubId || !menuId) {
        setManifestError(true);
        setIsLoading(false);
        return;
      }

      try {
        const resp = await fetch(
          `/api/menu-manifest?clubId=${encodeURIComponent(
            clubId
          )}&menuId=${encodeURIComponent(menuId)}`
        );
        if (!resp.ok) {
          if (!cancelled) {
            setManifestError(true);
            setIsLoading(false);
          }
          return;
        }
        const data: MenuManifest = await resp.json();
        if (cancelled) return;

        setManifest(data);
        setIsLoading(false);
        queueMicrotask(() => preloadNeighbors(0, data));
      } catch {
        if (!cancelled) {
          setManifestError(true);
          setIsLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isMobile, clubId, menuId]);

  // ---------- Desktop: Ctrl/Cmd + wheel zoom (updates iframe hash) ----------
  useEffect(() => {
    if (!isDesktop) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -Math.sign(e.deltaY) * 10;
        const nz = Math.max(50, Math.min(200, zoomDesktop + delta));
        setZoomDesktop(nz);

        if (iframeRef.current) {
          const currentSrc = iframeRef.current.src;
          const baseUrl = currentSrc.split("#")[0];
          iframeRef.current.src = `${baseUrl}#zoom=${nz}`;
        }
      }
    };

    // Note: passive: false is required here because we need to call preventDefault()
    // for Ctrl/Cmd + wheel zoom functionality
    document.addEventListener("wheel", onWheel, { passive: false });
    return () => document.removeEventListener("wheel", onWheel); // cleanup
  }, [isDesktop, zoomDesktop]);

  // ---------- Mobile interactions: pinch + swipe ----------
  // Pinch-to-zoom (two fingers) + pan (one finger while zoomed)
  const {
    bind: pinchBind,
    scale,
    offset,
    setScale,
    reset: resetPinch,
  } = usePinchZoom({ minScale: 1, maxScale: 2.5 });

  // Enable page swipe only when not zoomed-in
  const swipeEnabled = scale <= 1.02;

  const {
    bind: swipeBind,
    dragX,
    reset: resetSwipe,
  } = useSwipe({
    onSwipeLeft: () => swipeEnabled && goNext("left"),
    onSwipeRight: () => swipeEnabled && goPrev("right"),
    minDistance: 48,
    maxAngleDeg: 35,
  });

  // Compose pointer handlers so pinch + swipe can coexist
  const composedHandlers = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      pinchBind.onPointerDown?.(e);
      if (swipeEnabled) swipeBind.onPointerDown?.(e);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      pinchBind.onPointerMove?.(e);
      if (swipeEnabled) swipeBind.onPointerMove?.(e);
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      pinchBind.onPointerUp?.(e);
      if (swipeEnabled) swipeBind.onPointerUp?.(e);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => {
      // pinch supports cancel; swipe doesn't need it
      pinchBind.onPointerCancel?.(e);
    },
  };

  // ---------- Helpers ----------
  function preloadNeighbors(index: number, man: MenuManifest = manifest!) {
    const urls: string[] = [];
    if (index + 1 < man.pageCount) urls.push(man.pages[index + 1].url);
    if (index - 1 >= 0) urls.push(man.pages[index - 1].url);
    urls.forEach((u) => {
      const img = new Image();
      img.src = u;
    });
  }

  const goTo = useCallback(
    (nextIndex: number, dir: "left" | "right" | null = null) => {
      if (!manifest) return;

      // Out of bounds → small pulse on current page
      if (nextIndex < 0 || nextIndex >= manifest.pageCount) {
        setSlideDir(null);
        setEnterKey((k) => k + 1);
        return;
      }

      setSlideDir(dir);
      setPage(nextIndex);
      setEnterKey((k) => k + 1);
      preloadNeighbors(nextIndex);

      // Reset gestures between pages
      resetSwipe();
      resetPinch();
    },
    [manifest, resetSwipe, resetPinch]
  );

  const goNext = useCallback(
    (dir: "left" | null = "left") => goTo(page + 1, dir ?? "left"),
    [page, goTo]
  );
  const goPrev = useCallback(
    (dir: "right" | null = "right") => goTo(page - 1, dir ?? "right"),
    [page, goTo]
  );

  // Mobile: double-tap to toggle zoom (center area) when not zoomed
  const lastTap = useRef<number>(0);
  const onMobileClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!swipeEnabled) return; // ignore while zoomed (user is panning)

    const bounds = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - bounds.left;

    // Edge taps (25%) navigate pages
    if (x < bounds.width * 0.25) {
      goPrev();
      return;
    }
    if (x > bounds.width * 0.75) {
      goNext();
      return;
    }

    // Double-tap toggle 1x/1.5x
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setScale(scale === 1 ? 1.5 : 1);
    }
    lastTap.current = now;
  };

  // Desktop iframe URL
  const iframeSrc = useMemo(() => {
    if (!safeUrl) return "";
    const proxy = `/api/pdf-proxy?url=${encodeURIComponent(
      safeUrl
    )}&strategy=iframe`;
    const hash = `#zoom=${zoomDesktop}`;
    if (typeof window !== "undefined") {
      return new URL(`${proxy}${hash}`, window.location.origin).href;
    }
    return `${proxy}${hash}`;
  }, [safeUrl, zoomDesktop]);

  // Guard
  if (!safeUrl) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">
        No se pudo cargar el PDF del menú.
      </div>
    );
  }

  // Height policy: desktop uses provided height, mobile auto
  const computedHeight: number | string = height;
  const showMobileImages = isMobile && !!manifest && !manifestError;

  // ---------------- Render ----------------
  return (
    <div
      className={[
        "relative rounded-2xl border border-white/10 bg-white/5 shadow-lg",
        className,
      ].join(" ")}
      style={{ height: isDesktop ? computedHeight : undefined }}
    >
      {/* ======= DESKTOP (native PDF iframe) ======= */}
      {isDesktop && (
        <div className="h-full w-full overflow-hidden rounded-2xl">
          {isLoading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70">
              <div className="text-center text-white/70">
                <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
                <div>Cargando PDF...</div>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            key={refreshKey}
            src={iframeSrc}
            title={filename ?? "Menú PDF"}
            className="h-full w-full bg-white"
            referrerPolicy="no-referrer"
            allow="fullscreen"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setRenderError(true);
              setIsLoading(false);
            }}
          />

          {renderError && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 p-8 text-white/70">
              <div className="mb-4 text-6xl">📄</div>
              <div className="mb-2 text-lg">No se pudo cargar el PDF</div>
              <div className="mb-4 text-center text-sm text-white/50">
                El navegador no puede mostrar este PDF en la vista previa.
                <br />
                Puedes abrirlo en una nueva pestaña o descargarlo.
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => {
                    setRenderError(false);
                    setRefreshKey((k) => k + 1);
                  }}
                  className="rounded-md bg-white/10 px-4 py-2 hover:bg-white/15"
                >
                  Intentar de nuevo
                </button>
                <a
                  href={safeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  🔗 Abrir en nueva pestaña
                </a>
                <a
                  href={safeUrl}
                  download={filename || "menu.pdf"}
                  className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                >
                  📥 Descargar PDF
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======= MOBILE (images with swipe + pinch) ======= */}
      {isMobile && (
        <div className="w-full">
          {/* Viewer: no fixed height, no letterboxing; handlers composed for pinch+swipe */}
          <div
            className="relative w-full overflow-hidden rounded-2xl bg-transparent"
            style={{ touchAction: "none" as const }}
            onClick={onMobileClick}
            onPointerDown={composedHandlers.onPointerDown}
            onPointerMove={composedHandlers.onPointerMove}
            onPointerUp={composedHandlers.onPointerUp}
            onPointerCancel={composedHandlers.onPointerCancel}
          >
            {isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
                <div className="text-center text-white/80">
                  <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-white" />
                  <div>Cargando menú...</div>
                </div>
              </div>
            )}

            {/* Success: render current page */}
            {showMobileImages && (
              <AnimatedMobilePage
                key={enterKey}
                src={manifest!.pages[page].url}
                alt={`Página ${page + 1} de ${filename || "Menú"}`}
                // Combine transforms: swipe drag (when unzoomed) + pinch pan + pinch scale
                tx={(swipeEnabled ? dragX : 0) + offset.x}
                ty={offset.y}
                scale={scale}
                slideDir={slideDir}
              />
            )}

            {/* Fallback (no manifest on mobile) */}
            {!isLoading && !showMobileImages && (
              <div className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl bg-black/30 p-6 text-center text-white/80">
                <div>
                  <div className="mb-2 text-lg">Menú disponible como PDF</div>
                  <div className="mb-4 text-sm text-white/60">
                    Aún no hay imágenes del menú. Puedes abrir o descargar el PDF.
                  </div>
                  <div className="flex justify-center gap-3">
                    <a
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      🔗 Abrir PDF
                    </a>
                    <a
                      href={safeUrl}
                      download={filename || "menu.pdf"}
                      className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                    >
                      📥 Descargar
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pill + dots BELOW the image */}
          {manifest && pageCount > 0 && (
            <div className="mt-2 flex w-full flex-col items-center justify-center gap-1">
              <div className="flex items-center gap-4 rounded-full bg-black/60 px-4 py-1.5 text-white backdrop-blur">
                <button
                  onClick={() => goPrev()}
                  className="rounded-md px-1.5 py-0.5 text-base hover:bg-white/10 disabled:opacity-40"
                  aria-label="Anterior"
                  disabled={page === 0}
                >
                  ←
                </button>
                <div className="select-none text-sm tabular-nums">
                  {page + 1} / {pageCount}
                </div>
                <button
                  onClick={() => goNext()}
                  className="rounded-md px-1.5 py-0.5 text-base hover:bg-white/10 disabled:opacity-40"
                  aria-label="Siguiente"
                  disabled={page === pageCount - 1}
                >
                  →
                </button>
              </div>

              {pageCount > 1 && (
                <div className="flex items-center gap-1">
                  {Array.from({ length: pageCount }).map((_, i) => (
                    <div
                      key={i}
                      className={[
                        "h-1.5 w-1.5 rounded-full transition-opacity",
                        i === page
                          ? "bg-white opacity-100"
                          : "bg-white/50 opacity-60",
                      ].join(" ")}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --------------- Mobile page (animated) ---------------
function AnimatedMobilePage({
  src,
  alt,
  tx,
  ty,
  scale,
  slideDir,
}: {
  src: string;
  alt: string;
  tx: number;
  ty: number;
  scale: number;
  slideDir: "left" | "right" | null;
}) {
  const [enterOffset, setEnterOffset] = useState(0);

  useEffect(() => {
    // Subtle slide-in animation when page changes
    if (slideDir === "left") setEnterOffset(24);
    else if (slideDir === "right") setEnterOffset(-24);
    else setEnterOffset(0);

    const id = requestAnimationFrame(() => setEnterOffset(0));
    return () => cancelAnimationFrame(id);
  }, [slideDir]);

  return (
    <img
      src={src}
      alt={alt}
      // Natural height → no letterboxing; rounded is inherited from parent
      className="w-full select-none object-contain transition-transform duration-200 ease-out"
      style={{
        transform: `translate3d(${tx + enterOffset}px, ${ty}px, 0) scale(${scale})`,
        transformOrigin: "center center",
        willChange: "transform",
        userSelect: "none",
      }}
      draggable={false}
    />
  );
}
