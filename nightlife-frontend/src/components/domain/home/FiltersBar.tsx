// src/components/domain/home/FiltersBar.tsx
"use client";

/**
 * Compact, pill-shaped city selector (native <select>) with:
 * - 32px control height (h-8)
 * - larger "Ciudad" label
 * - no UA/red focus outline (focus ring on wrapper)
 * - dark dropdown where supported (color-scheme + option fallback)
 * - custom chevron aligned right
 */
export function FiltersBar({
  cities,
  selectedCity,
  onCityChange,
  label = "Ciudad",
}: {
  cities: string[];
  selectedCity?: string;
  onCityChange: (city?: string) => void;
  label?: string;
}) {
  // Fallback colors for <option> elements
  const optionStyle = { backgroundColor: "#000117", color: "#E5E7EB" }; // dark bg + slate-200

  return (
    <div className="flex items-center gap-3">
      {/* Bigger label */}
      <label htmlFor="city-select" className="text-base font-medium text-white/80">
        {label}
      </label>

      {/* Wrapper owns focus ring; control is compact (32px) */}
      <div
        className="
          relative h-8 min-w-[110px]
          rounded-full bg-white/10 border border-white/10
          ring-1 ring-transparent
          focus-within:ring-2 focus-within:ring-[#6B3FA0]
        "
      >
        <select
          id="city-select"
          value={selectedCity ?? ""}
          onChange={(e) => onCityChange(e.target.value || undefined)}
          className="
            peer h-8 w-full
            rounded-full bg-transparent
            text-[13px] text-white/90
            pl-3 pr-7
            appearance-none
            outline-none focus:outline-none
            border-0 focus:border-0
            ring-0 focus:ring-0
            cursor-pointer
            [color-scheme:dark]
          "
          aria-label="Seleccionar ciudad"
          title="Seleccionar ciudad"
        >
          <option value="" style={optionStyle}>Todas</option>
          {cities.map((c) => (
            <option key={c} value={c} style={optionStyle}>
              {c}
            </option>
          ))}
        </select>

        {/* Smaller chevron, tightly aligned */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="
            pointer-events-none
            absolute right-2.5 top-1/2 -translate-y-1/2
            h-3 w-3 text-white/85
          "
          fill="currentColor"
        >
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </div>
    </div>
  );
}
