// src/components/domain/club/ClubTabs.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

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

export function ClubTabs({ current, onChange, showCarta }: Props) {
  // Auto-detected allowance based on <html data-club-menu>; default to true.
  const [autoAllowCarta, setAutoAllowCarta] = useState<boolean>(true);
  
  // Final decision: explicit prop wins; otherwise use auto-detect
  const allowCarta = showCarta ?? autoAllowCarta;

  // Auto-detect from <html data-club-menu="...">
  useEffect(() => {
    if (showCarta !== undefined) return; // consumer controls it
    if (typeof document === "undefined") return;

    const root = document.documentElement;

    const compute = () => {
      const mt = (root.getAttribute("data-club-menu") || "unknown").toLowerCase();
      // Show ONLY when menuType is "structured" or "pdf"
      const allow = mt === "structured" || mt === "pdf";
      return allow;
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

    // In controlled mode, parent will update `current`. Otherwise update internal state.
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
          className={`pb-3 text-sm font-semibold ${
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
          className={`pb-3 text-sm font-semibold ${
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
