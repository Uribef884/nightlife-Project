// src/components/domain/club/PdfMenu.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { detectDevice } from "@/lib/deviceDetection";

/**
 * Enhanced PDF viewer with device-specific rendering strategies
 * - Desktop: Iframe with minimal hash parameters for zoom control
 * - Mobile: Iframe with fallback to download/open options if rendering fails
 * - No duplicate controls, proper zoom functionality
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

  // Device detection
  const [deviceInfo, setDeviceInfo] = useState(() => detectDevice());
  
  // Zoom percentage mode (50–200) - used on both platforms
  const [zoom, setZoom] = useState<number>(100);
  
  // Loading state for better UX
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [renderError, setRenderError] = useState<boolean>(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  
  // Force refresh when URL changes
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Reset when URL changes
  useEffect(() => {
    setIsLoading(true);
    setRenderError(false);
    setRefreshKey(prev => prev + 1);
    
    // Re-detect device
    const newDeviceInfo = detectDevice();
    setDeviceInfo(newDeviceInfo);
  }, [url]);

  // Update device info on window resize
  useEffect(() => {
    const handleResize = () => {
      setDeviceInfo(detectDevice());
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function applyZoom(next: number) {
    const clamped = Math.max(50, Math.min(200, Math.round(next)));
    setZoom(clamped);
    
    // Reload iframe with new zoom parameter
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      const baseUrl = currentSrc.split('#')[0];
      const newSrc = `${baseUrl}#zoom=${clamped}`;
      iframeRef.current.src = newSrc;
    }
  }
  
  function fitPercent100() {
    setZoom(100);
    if (iframeRef.current) {
      const currentSrc = iframeRef.current.src;
      const baseUrl = currentSrc.split('#')[0];
      iframeRef.current.src = `${baseUrl}#zoom=100`;
    }
  }

  function refreshPdf() {
    setIsLoading(true);
    setRenderError(false);
    setRefreshKey(prev => prev + 1);
  }

  // Compute the viewer height
  const computedHeight: number | string = useMemo(() => {
    if (height !== "70vh") return height;
    return height;
  }, [height]);

  // Build viewer URL for iframe
  const iframeSrc = useMemo(() => {
    if (!safeUrl) return "";

    // Use our PDF proxy with iframe strategy
    const proxyUrl = `/api/pdf-proxy?url=${encodeURIComponent(safeUrl)}&strategy=iframe`;
    
    // Add only zoom parameter - remove problematic parameters that cause mobile issues
    const hash = `#zoom=${zoom}`;
    
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
      <div className="flex items-center gap-2 p-2 border-b border-white/10 justify-between">
        {/* Left side - Device indicator */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50 px-2 py-1 bg-white/5 rounded">
            {deviceInfo.isMobile ? "📱 Mobile" : "🖥️ Desktop"}
          </span>
          {deviceInfo.isMobile && (
            <span className="text-xs text-yellow-400 px-2 py-1 bg-yellow-400/10 rounded">
              Mobile PDF viewing may be limited
            </span>
          )}
        </div>

        {/* Right side - Zoom controls */}
        <div className="flex items-center gap-2">
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
      </div>

      {/* Viewer */}
      <div className="overflow-hidden rounded-b-xl relative" style={{ height: computedHeight }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
            <div className="text-white/70 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
              <div>Cargando PDF...</div>
            </div>
          </div>
        )}
        
        {/* Iframe Renderer for both platforms */}
        <iframe
          ref={iframeRef}
          key={refreshKey}
          src={iframeSrc}
          title={filename ?? "Menú PDF"}
          style={{ width: "100%", height: "100%" }}
          referrerPolicy="no-referrer"
          className="bg-white"
          allow="fullscreen"
          onLoad={() => {
            setIsLoading(false);
          }}
          onError={() => {
            setRenderError(true);
            setIsLoading(false);
          }}
        />

        {/* Error State with Download Link */}
        {renderError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-white/70 bg-black/90">
            <div className="text-6xl mb-4">📄</div>
            <div className="text-lg mb-2">No se pudo cargar el PDF</div>
            <div className="text-sm mb-4 text-white/50 text-center">
              El navegador no puede mostrar este PDF en la vista previa.
              <br />
              Puedes abrirlo en una nueva pestaña o descargarlo.
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
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
                href={safeUrl}
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
