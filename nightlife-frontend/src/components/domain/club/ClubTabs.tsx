// src/components/domain/club/ClubTabs.tsx
"use client";

import { useEffect, useState } from "react";

type Tab = "general" | "reservas" | "carta";

type Props = {
  /** Optional: if you pass this, the component is controlled. If you omit it, it follows the URL hash. */
  current?: Tab;
  onChange?: (t: Tab) => void;
};

function readTabFromUrl(): Tab {
  const h = (window.location.hash || "").replace("#", "").toLowerCase();
  return (h === "reservas" || h === "carta" || h === "general" ? h : "general") as Tab;
}

export function ClubTabs({ current, onChange }: Props) {
  // Internal active state mirrors either the prop (controlled) or the URL hash (uncontrolled)
  const [active, setActive] = useState<Tab>("general");

  // Controlled mode: follow `current` prop
  useEffect(() => {
    if (current) setActive(current);
  }, [current]);

  // Uncontrolled mode: follow the URL hash
  useEffect(() => {
    if (current !== undefined) return; // parent controls it
    const apply = () => setActive(readTabFromUrl());
    apply(); // initial
    const onHash = () => setActive(readTabFromUrl());
    const onPop = () => setActive(readTabFromUrl());
    window.addEventListener("hashchange", onHash);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("hashchange", onHash);
      window.removeEventListener("popstate", onPop);
    };
  }, [current]);

  const handleChange = (t: Tab) => {
    // Always keep the URL in sync so deep links work and the indicator updates on button clicks.
    if (window.location.hash !== `#${t}`) window.location.hash = t;

    // Controlled parent can still react if it wants.
    onChange?.(t);

    // In uncontrolled mode, the hashchange listener sets state.
    if (current !== undefined) setActive(t);
  };

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "general", label: "General" },
    { key: "reservas", label: "Reservas" },
    { key: "carta", label: "Carta" },
  ];

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
    </nav>
  );
}
