// src/components/domain/home/SearchBar.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export function SearchBar({
  defaultValue = "",
  onSearch,
  placeholder = "¿Dónde es la fiesta?",
  delay = 300,
}: {
  defaultValue?: string;
  onSearch: (q: string) => void;
  placeholder?: string;
  delay?: number;
}) {
  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // debounce search (used for regular typing)
  const debounced = useMemo(() => {
    let handle: any;
    return (next: string) => {
      clearTimeout(handle);
      handle = setTimeout(() => onSearch(next), delay);
    };
  }, [onSearch, delay]);

  // If we clear via the X, skip the debounced effect once
  const skipNextEffect = useRef(false);

  useEffect(() => {
    if (skipNextEffect.current) {
      skipNextEffect.current = false;
      return;
    }
    debounced(value);
  }, [value, debounced]);

  const showLabel = !focused && value.trim().length === 0;

  // Clear immediately, refocus the input, and skip the debounced effect
  const clearNow = () => {
    skipNextEffect.current = true;
    setValue("");
    onSearch(""); // immediate clear (no debounce)
    // refocus for quick new typing
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <div className="w-full">
      <div
        className="
          relative rounded-full h-12
          bg-white/10 border border-white/10
          ring-1 ring-transparent
          focus-within:ring-2 focus-within:ring-[#6B3FA0]
        "
      >
        {/* Red magnifying glass */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#F60800]"
          fill="currentColor"
        >
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16a6.471 6.471 0 0 0 4.23-1.57l.27.28v.79L20 21.5 21.5 20l-6-6Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.505 4.505 0 0 1 9.5 14Z" />
        </svg>

        {/* Input (top-biased text position) */}
        <input
          ref={inputRef}
          id="home-search"
          type="text"
          role="searchbox"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && value) {
              e.preventDefault();
              clearNow();
            }
          }}
          placeholder=" "                       /* real placeholder suppressed */
          aria-label={placeholder}
          className="
            w-full h-full rounded-full
            bg-transparent text-white/90
            text-[15px] leading-5
            pl-10 pr-10 pt-2 pb-3         
            outline-none focus:outline-none
            border-0 focus:border-0
            ring-0 focus:ring-0
            appearance-none
          "
        />

        {/* Non-floating label: only when not focused & empty */}
        {showLabel && (
          <label
            htmlFor="home-search"
            className="
              pointer-events-none absolute left-10 top-1/2 -translate-y-1/2
              text-white/75 font-semibold
            "
          >
            {placeholder}
          </label>
        )}

        {/* Conditional clear button (X) — shows only when there's text */}
        {value && (
          <button
            type="button"
            onClick={clearNow}
            aria-label="Limpiar búsqueda"
            title="Limpiar búsqueda"
            className="
              absolute right-2.5 top-1/2 -translate-y-1/2
              inline-flex h-6 w-6 items-center justify-center
              rounded-full text-white/70 hover:text-white
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6B3FA0]
            "
          >
            {/* Simple “×” SVG so it looks crisp at any scale */}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M6.4 5l5.6 5.6L17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4 6.4 5z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
