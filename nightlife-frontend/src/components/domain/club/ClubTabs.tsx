// src/components/domain/club/ClubTabs.tsx
"use client";
type Props = { current: "general" | "reservas" | "carta"; onChange: (t: Props["current"]) => void };

export function ClubTabs({ current, onChange }: Props) {
  const tabs: Array<{ key: Props["current"]; label: string }> = [
    { key: "general", label: "General" },
    { key: "reservas", label: "Reservas" },
    { key: "carta", label: "Carta" },
  ];
  return (
    <nav className="flex items-center gap-6 px-4 pt-4">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`pb-3 text-sm font-semibold ${
            current === t.key ? "text-white border-b-2 border-white" : "text-white/70 hover:text-white"
          }`}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
