// src/components/domain/club/PdfMenu.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * PDF viewer with enhanced iframe rendering for all devices
 * - Uses iframe with PDF proxy for consistent behavior
 * - Zoom controls work through URL parameters
 * - Fallback options for compatibility
 * - Mobile-optimized rendering
 */
export function PdfMenu({
  url,
  filename,
  height = "70vh",
  className = "",
}: {
  url: string;
  filename?: string | null;
  height?: number | string;
  className?: string;
}) {
  // Only allow http/https URLs to avoid javascript: or data: injections
  const safeUrl = useMemo(() => {
    try {
      const u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch {}
    return ""; // invalid
  }, [url]);

  // Zoom percentage mode (50–200)
  const [zoom, setZoom] = useState<number>(100);
  
  // Loading state for better UX
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Rendering mode state
  const [renderMode, setRenderMode] = useState<"iframe" | "object" | "embed">("iframe");
  const [renderError, setRenderError] = useState<boolean>(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  
  // Force refresh when URL changes
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Reset when URL changes
  useEffect(() => {
    setIsLoading(true);
    setRenderError(false);
    setRenderMode("iframe");
    setRefreshKey(prev => prev + 1);
  }, [url]);

  function applyZoom(next: number) {
    const clamped = Math.max(50, Math.min(200, Math.round(next)));
    setZoom(clamped);
  }
  
  function fitPercent100() {
    setZoom(100);
  }

  function refreshPdf() {
    setIsLoading(true);
    setRenderError(false);
    setRenderMode("iframe");
    setRefreshKey(prev => prev + 1);
  }

  function tryNextRenderMode() {
    if (renderMode === "iframe") {
      setRenderMode("object");
    } else if (renderMode === "object") {
      setRenderMode("embed");
    } else {
      setRenderError(true);
    }
    setIsLoading(true);
    setRefreshKey(prev => prev + 1);
  }

  // Compute the iframe height
  const computedHeight: number | string = useMemo(() => {
    if (height !== "70vh") return height;
    return height;
  }, [height]);

  // Build viewer URL for iframe (all devices)
  const iframeSrc = useMemo(() => {
    if (!safeUrl) return "";

    // Use our PDF proxy to avoid CSP issues - must be same-origin
    const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(safeUrl)}`;
    
    // Add hash parameters to hide browser's native PDF toolbar and apply zoom
    const hash = `#toolbar=0&navpanes=0&scrollbar=0&statusbar=0&messages=0&view=FitH&zoom=${zoom}`;
    
    // Combine proxy URL with hash parameters
    const finalUrl = `${proxyUrl}${hash}`;
    
    // Ensure absolute URL to avoid relative resolution issues
    if (typeof window !== "undefined") {
      return new URL(finalUrl, window.location.origin).href;
    }
    return finalUrl;
  }, [safeUrl, zoom]);

  if (!safeUrl) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70">
        No se pudo cargar el PDF del menú.
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className={["rounded-xl border border-white/10 bg-white/5", className].join(" ")}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b border-white/10 justify-end">
        <button
          type="button"
          className="h-9 min-w-9 rounded-md bg-white/10 px-3 text-white hover:bg-white/15"
          onClick={() => applyZoom(zoom - 10)}
          aria-label="Disminuir zoom"
          title="Disminuir zoom"
        >
          −
        </button>
        <div className="w-14 text-center text-white/80 text-sm tabular-nums">
          {zoom}%
        </div>
        <button
          type="button"
          className="h-9 min-w-9 rounded-md bg-white/10 px-3 text-white hover:bg-white/15"
          onClick={() => applyZoom(zoom + 10)}
          aria-label="Aumentar zoom"
          title="Aumentar zoom"
        >
          +
        </button>
        <button
          type="button"
          className="h-9 min-w-9 rounded-md bg-white/10 px-3 text-white hover:bg-white/15"
          onClick={fitPercent100}
          aria-label="Ajustar a 100%"
          title="Ajustar a 100%"
        >
          100%
        </button>
        <button
          type="button"
          className="h-9 rounded-md bg-white/10 px-3 text-white hover:bg-white/15"
          onClick={refreshPdf}
          aria-label="Recargar PDF"
          title="Recargar PDF"
        >
          ↻
        </button>
      </div>

      {/* Viewer */}
      <div className="overflow-hidden rounded-b-xl relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
            <div className="text-white/70 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <div>Cargando PDF...</div>
            </div>
          </div>
        )}
        
        {/* Iframe Renderer (All Devices) */}
        {renderMode === "iframe" && (
          <iframe
            key={refreshKey}
            src={iframeSrc}
            title={filename ?? "Menú PDF"}
            style={{ width: "100%", height: computedHeight }}
            referrerPolicy="no-referrer"
            className="bg-white"
            allow="fullscreen"
            onLoad={() => {
              setIsLoading(false);
            }}
            onError={() => {
              tryNextRenderMode();
            }}
          />
        )}

        {/* Object Tag Renderer */}
        {renderMode === "object" && (
          <object
            key={refreshKey}
            data={iframeSrc}
            type="application/pdf"
            style={{ width: "100%", height: computedHeight }}
            onLoad={() => {
              setIsLoading(false);
            }}
            onError={() => {
              tryNextRenderMode();
            }}
          >
            <p>PDF no disponible en este navegador.</p>
          </object>
        )}

        {/* Embed Tag Renderer */}
        {renderMode === "embed" && (
          <embed
            key={refreshKey}
            src={iframeSrc}
            type="application/pdf"
            style={{ width: "100%", height: computedHeight }}
            onLoad={() => {
              setIsLoading(false);
            }}
            onError={() => {
              setRenderError(true);
              setIsLoading(false);
            }}
          />
        )}

        {/* Error State with Download Link */}
        {renderError && (
          <div className="flex flex-col items-center justify-center p-8 text-white/70">
            <div className="text-6xl mb-4">📄</div>
            <div className="text-lg mb-2">No se pudo cargar el PDF</div>
            <div className="text-sm mb-4 text-white/50 text-center">
              El navegador no puede mostrar este PDF en la vista previa.
              <br />
              Puedes abrirlo en una nueva pestaña o descargarlo.
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setRenderError(false);
                  refreshPdf();
                }}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-md"
              >
                Intentar de nuevo
              </button>
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-white"
              >
                🔗 Abrir en nueva pestaña
              </a>
              <a
                href={iframeSrc}
                download={filename || "menu.pdf"}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-white"
              >
                📥 Descargar PDF
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
