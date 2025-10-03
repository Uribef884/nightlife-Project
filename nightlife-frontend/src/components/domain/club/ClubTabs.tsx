// src/components/domain/club/ClubTabs.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Tab = "general" | "reservas" | "carta";

type Props = {
  /** Optional controlled mode. If omitted, follows the URL hash. */
  current?: Tab;
  onChange?: (t: Tab) => void;

  /**
   * Optional override:
   *  - true  => force show "Carta"
   *  - false => force hide "Carta"
   *  - undefined => auto-detect from <html data-club-menu="...">
   */
  showCarta?: boolean;
};

/** Read the desired tab from the URL hash and normalize when Carta is not allowed. */
function readTabFromUrl(allowCarta: boolean): Tab {
  const h = (window.location.hash || "").replace("#", "").toLowerCase();
  const raw = (h === "reservas" || h === "carta" || h === "general" ? h : "general") as Tab;
  return !allowCarta && raw === "carta" ? "general" : raw;
}

/** Parse a CSS var like "56px" -> 56 (fallback if not set). */
function readPxVar(root: HTMLElement, name: string, fallback = 56): number {
  try {
    const v = getComputedStyle(root).getPropertyValue(name).trim();
    const n = parseFloat(v.replace("px", ""));
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function ClubTabs({ current, onChange, showCarta }: Props) {
  // Auto-detected allowance based on <html data-club-menu>; default to true.
  const [autoAllowCarta, setAutoAllowCarta] = useState<boolean>(true);
  const allowCarta = showCarta ?? autoAllowCarta;

  // Render counter for debugging rapid re-renders
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  // Debug logging for PDF mode flashing issue - REMOVED to prevent infinite re-renders
  // useEffect(() => {
  //   console.log('🔍 ClubTabs Debug - Component mounted/updated:', {
  //     renderCount: renderCountRef.current,
  //     showCarta,
  //     autoAllowCarta,
  //     allowCarta,
  //     current,
  //     timestamp: new Date().toISOString(),
  //     userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
  //     isMobile: typeof window !== 'undefined' && window.innerWidth < 768,
  //     dataClubMenu: typeof document !== 'undefined' ? document.documentElement.getAttribute('data-club-menu') : 'SSR'
  //   });
  // });

  // 🔧 measure this nav height and publish --nl-sticky-top on :root
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!navRef.current || typeof window === "undefined") return;
    const root = document.documentElement;

    // More aggressive throttling for mobile PDF mode
    let timeoutId: NodeJS.Timeout | null = null;
    let rafId: number | null = null;
    
    const throttleApply = (callback: () => void, delay = 100) => { // Increased delay for mobile
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          callback();
          timeoutId = null;
          rafId = null;
        });
      }, delay);
    };

    let lastValues = { navbarH: 0, tabsH: 0, stickyTop: 0 };
    let stableCount = 0; // Track consecutive stable measurements
    
    const apply = () => {
      const navbarH = readPxVar(root, "--nl-navbar-h", 56);
      const tabsH = navRef.current?.offsetHeight ?? 0;
      const stickyTop = Math.max(0, navbarH + tabsH);

      // Only update if values actually changed significantly (> 1px)
      const navbarChanged = Math.abs(lastValues.navbarH - navbarH) > 1;
      const tabsChanged = Math.abs(lastValues.tabsH - tabsH) > 1;
      
      if (navbarChanged || tabsChanged) {
        stableCount = 0;
        console.log('🔍 ClubTabs Debug - ResizeObserver values changed:', {
          navbarH,
          tabsH,
          stickyTop,
          previousValues: lastValues,
          navbarChanged,
          tabsChanged,
          timestamp: new Date().toISOString(),
          isMobile: typeof window !== "undefined" && window.innerWidth < 768,
          dataClubMenu: typeof document !== "undefined" ? document.documentElement.getAttribute('data-club-menu') : 'SSR'
        });

        root.style.setProperty("--nl-sticky-top", `${stickyTop}px`);
        root.style.setProperty("--nl-sticky-scroll-margin", `${stickyTop + 8}px`);
        
        lastValues = { navbarH, tabsH, stickyTop };
      } else {
        stableCount++;
        // Log only every 10th stable measurement to reduce noise
        if (stableCount % 10 === 0) {
          console.log('🔍 ClubTabs Debug - Stable measurements:', {
            stableCount,
            navbarH,
            tabsH,
            stickyTop,
            timestamp: new Date().toISOString()
          });
        }
      }
    };

    apply();
    
    // More conservative ResizeObserver with better filtering
    const ro = new ResizeObserver((entries) => {
      // Filter out entries that are likely from image loading
      const relevantEntries = entries.filter(entry => {
        const target = entry.target as HTMLElement;
        // Skip if it's an image or image container
        if (target.tagName === 'IMG' || target.closest('img')) return false;
        // Skip if it's inside the PDF menu area
        if (target.closest('[data-tab="carta"]')) return false;
        return true;
      });

      if (relevantEntries.length > 0) {
        console.log('🔍 ClubTabs Debug - ResizeObserver entries (filtered):', {
          totalEntries: entries.length,
          relevantEntries: relevantEntries.length,
          entries: relevantEntries.map(e => ({
            target: e.target.tagName,
            contentRect: e.contentRect,
            borderBoxSize: e.borderBoxSize
          })),
          timestamp: new Date().toISOString()
        });
        throttleApply(apply, 100); // More conservative throttling
      }
    });
    
    ro.observe(navRef.current);
    
    const onResize = () => {
      console.log('🔍 ClubTabs Debug - Window resize event (throttled):', {
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        timestamp: new Date().toISOString()
      });
      throttleApply(apply, 100);
    };
    
    window.addEventListener("resize", onResize);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Auto-detect from <html data-club-menu="...">
  useEffect(() => {
    if (showCarta !== undefined) return; // consumer controls it
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const compute = () => {
      const mt = (root.getAttribute("data-club-menu") || "unknown").toLowerCase();
      const result = mt === "structured" || mt === "pdf";
      console.log('🔍 ClubTabs Debug - Menu type detection:', {
        menuType: mt,
        isPdfMode: mt === "pdf",
        result,
        timestamp: new Date().toISOString(),
        previousValue: autoAllowCarta
      });
      return result;
    };

    setAutoAllowCarta(compute()); // initial
    const obs = new MutationObserver((mutations) => {
      console.log('🔍 ClubTabs Debug - MutationObserver triggered:', {
        mutations: mutations.map(m => ({
          type: m.type,
          attributeName: m.attributeName,
          oldValue: m.oldValue,
          target: m.target
        })),
        timestamp: new Date().toISOString()
      });
      setAutoAllowCarta(compute());
    });
    obs.observe(root, { attributes: true, attributeFilter: ["data-club-menu"] });
    return () => obs.disconnect();
  }, [showCarta, autoAllowCarta]);

  // Internal active state mirrors either the prop (controlled) or the URL hash (uncontrolled)
  const [active, setActive] = useState<Tab>("general");

  // Debug logging for active state changes - REMOVED to prevent infinite re-renders
  // useEffect(() => {
  //   console.log('🔍 ClubTabs Debug - Active state changed:', {
  //     active,
  //     current,
  //     timestamp: new Date().toISOString()
  //   });
  // }, [active, current]);

  // Controlled mode: follow `current` prop
  useEffect(() => {
    if (current && current !== active) {
      console.log('🔍 ClubTabs Debug - Setting active from prop:', {
        current,
        previousActive: active,
        timestamp: new Date().toISOString()
      });
      setActive(current);
    }
  }, [current, active]);

  // Uncontrolled mode: follow URL hash and normalize based on allowCarta
  useEffect(() => {
    if (current !== undefined) return; // parent controls it
    const apply = () => {
      const newTab = readTabFromUrl(allowCarta);
      // Only update if the tab actually changed
      if (newTab !== active) {
        console.log('🔍 ClubTabs Debug - URL hash change detected:', {
          hash: window.location.hash,
          allowCarta,
          newTab,
          previousActive: active,
          timestamp: new Date().toISOString()
        });
        setActive(newTab);
      }
    };
    apply();
    const onHash = () => {
      console.log('🔍 ClubTabs Debug - Hash change event:', {
        hash: window.location.hash,
        allowCarta,
        timestamp: new Date().toISOString()
      });
      const newTab = readTabFromUrl(allowCarta);
      if (newTab !== active) {
        setActive(newTab);
      }
    };
    const onPop = () => {
      console.log('🔍 ClubTabs Debug - Pop state event:', {
        hash: window.location.hash,
        allowCarta,
        timestamp: new Date().toISOString()
      });
      const newTab = readTabFromUrl(allowCarta);
      if (newTab !== active) {
        setActive(newTab);
      }
    };
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onPop);
    };
  }, [current, allowCarta, active]);

  // If Carta becomes disallowed while on it, normalize to General and update URL
  useEffect(() => {
    if (!allowCarta && active === "carta") {
      console.log('🔍 ClubTabs Debug - Normalizing carta to general:', {
        allowCarta,
        active,
        currentHash: typeof window !== "undefined" ? window.location.hash : 'SSR',
        timestamp: new Date().toISOString()
      });
      if (typeof window !== "undefined" && window.location.hash !== "#general") {
        window.location.hash = "general";
      }
      setActive("general");
      onChange?.("general");
    }
  }, [allowCarta, active, onChange]);

  const handleChange = (t: Tab) => {
    const originalTab = t;
    if (!allowCarta && t === "carta") t = "general";
    
    // Prevent unnecessary updates if already on the target tab
    if (active === t) {
      console.log('🔍 ClubTabs Debug - Tab change skipped (already active):', {
        originalTab,
        finalTab: t,
        active,
        currentHash: typeof window !== "undefined" ? window.location.hash : 'SSR',
        timestamp: new Date().toISOString()
      });
      return;
    }
    
    console.log('🔍 ClubTabs Debug - Tab change initiated:', {
      originalTab,
      finalTab: t,
      allowCarta,
      active,
      currentHash: typeof window !== "undefined" ? window.location.hash : 'SSR',
      isControlled: current !== undefined,
      timestamp: new Date().toISOString()
    });

    // Only update hash if it's actually different
    const targetHash = `#${t}`;
    if (typeof window !== "undefined" && window.location.hash !== targetHash) {
      console.log('🔍 ClubTabs Debug - Updating URL hash:', {
        from: window.location.hash,
        to: targetHash,
        timestamp: new Date().toISOString()
      });
      window.location.hash = t;
    }
    
    onChange?.(t);
    if (current !== undefined) setActive(t);
  };

  const tabs = useMemo(
    () =>
      [
        { key: "general" as Tab, label: "General" },
        { key: "reservas" as Tab, label: "Reservas" },
      ] as Array<{ key: Tab; label: string }>,
    []
  );

  return (
    <nav
      ref={navRef}
      className="w-full p-0 flex items-center justify-center gap-6"
      role="tablist"
      aria-orientation="horizontal"
      aria-label="Secciones del club"
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={active === t.key}
          tabIndex={active === t.key ? 0 : -1}
          onClick={() => handleChange(t.key)}
          className={`pb-2 text-sm font-semibold ${
            active === t.key
              ? "text-white border-b-2 border-white"
              : "text-white/70 hover:text-white"
          }`}
        >
          {t.label}
        </button>
      ))}

      {allowCarta && (
        <button
          role="tab"
          aria-selected={active === "carta"}
          tabIndex={active === "carta" ? 0 : -1}
          onClick={() => handleChange("carta")}
          className={`pb-2 text-sm font-semibold ${
            active === "carta"
              ? "text-white border-b-2 border-white"
              : "text-white/70 hover:text-white"
          }`}
        >
          Carta
        </button>
      )}
    </nav>
  );
}
