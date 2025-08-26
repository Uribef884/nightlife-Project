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

  // 🔧 measure this nav height and publish --nl-sticky-top on :root
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!navRef.current || typeof window === "undefined") return;
    const root = document.documentElement;

    const apply = () => {
      const navbarH = readPxVar(root, "--nl-navbar-h", 56);
      const tabsH = navRef.current?.offsetHeight ?? 0;

      // ⬇️ CHANGE: remove extra 8px padding so the category bar sits flush
      const stickyTop = Math.max(0, navbarH + tabsH);

      root.style.setProperty("--nl-sticky-top", `${stickyTop}px`);
      // Keep a tiny cushion for section headings only (does NOT affect the gap)
      root.style.setProperty("--nl-sticky-scroll-margin", `${stickyTop + 8}px`);
    };

    apply();
    const ro = new ResizeObserver(() => apply());
    ro.observe(navRef.current);
    const onResize = () => apply();
    window.addEventListener("resize", onResize);
    return () => {
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
      return mt === "structured" || mt === "pdf";
    };

    setAutoAllowCarta(compute()); // initial
    const obs = new MutationObserver(() => setAutoAllowCarta(compute()));
    obs.observe(root, { attributes: true, attributeFilter: ["data-club-menu"] });
    return () => obs.disconnect();
  }, [showCarta]);

  // Internal active state mirrors either the prop (controlled) or the URL hash (uncontrolled)
  const [active, setActive] = useState<Tab>("general");

  // Controlled mode: follow `current` prop
  useEffect(() => {
    if (current) setActive(current);
  }, [current]);

  // Uncontrolled mode: follow URL hash and normalize based on allowCarta
  useEffect(() => {
    if (current !== undefined) return; // parent controls it
    const apply = () => setActive(readTabFromUrl(allowCarta));
    apply();
    const onHash = () => setActive(readTabFromUrl(allowCarta));
    const onPop = () => setActive(readTabFromUrl(allowCarta));
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onPop);
    };
  }, [current, allowCarta]);

  // If Carta becomes disallowed while on it, normalize to General and update URL
  useEffect(() => {
    if (!allowCarta && active === "carta") {
      if (typeof window !== "undefined" && window.location.hash !== "#general") {
        window.location.hash = "general";
      }
      setActive("general");
      onChange?.("general");
    }
  }, [allowCarta, active, onChange]);

  const handleChange = (t: Tab) => {
    if (!allowCarta && t === "carta") t = "general";
    if (typeof window !== "undefined" && window.location.hash !== `#${t}`) {
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
