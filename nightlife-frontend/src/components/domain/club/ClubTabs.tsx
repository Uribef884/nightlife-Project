// src/components/domain/club/ClubTabs.tsx
"use client";

type Props = {
  current: "general" | "reservas" | "carta";
  onChange: (t: Props["current"]) => void;
};

export function ClubTabs({ current, onChange }: Props) {
  const tabs: Array<{ key: Props["current"]; label: string }> = [
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
          aria-selected={current === t.key}
          tabIndex={current === t.key ? 0 : -1}
          onClick={() => onChange(t.key)}
          className={`pb-3 text-sm font-semibold ${
            current === t.key
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
