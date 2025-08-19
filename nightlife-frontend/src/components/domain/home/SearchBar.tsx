// src/components/domain/home/SearchBar.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type SearchBarProps = {
  defaultValue?: string;
  onSearch: (q: string) => void;
  placeholder?: string;
  delay?: number;       // debounce delay in ms (defaults to 300 to keep your current behavior)
  minLength?: number;   // minimum chars before firing (defaults to 2; empty string is always allowed)
};

export function SearchBar({
  defaultValue = "",
  onSearch,
  placeholder = "¿Dónde es la fiesta?",
  delay = 300,
  minLength = 2,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // --- WHY these refs? ---
  // 1) timerRef keeps a single timeout across renders (stable debounce).
  // 2) onSearchRef always points to the latest onSearch without recreating the debouncer.
  // 3) lastSentRef prevents duplicate calls when the normalized query hasn't changed.
  // 4) skipNextEffect mirrors your existing "clearNow" behavior to avoid an extra debounced call.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearchRef = useRef(onSearch);
  const lastSentRef = useRef<string>("");
  const skipNextEffect = useRef(false);

  // Keep the latest onSearch without invalidating debounce
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  // Normalize user input: trim, collapse spaces, and lowercase for dedupe fairness
  const normalize = (q: string) =>
    q
      .trim()
      .replace(/\s+/g, " ")
      // If your backend is case-insensitive, normalize to lower for dedupe only:
      .toLowerCase();

  // Core debounced effect
  useEffect(() => {
    if (skipNextEffect.current) {
      // One-shot skip used by clearNow()
      skipNextEffect.current = false;
      return;
    }

    // Always clear the previous timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const normalized = normalize(value);

    // Guardrail: only fire if empty OR long enough
    const shouldFire =
      normalized.length === 0 || normalized.length >= minLength;

    if (!shouldFire) return;

    // Debounce
    timerRef.current = setTimeout(() => {
      // Dedupe: only call if changed since last emission
      if (normalized !== lastSentRef.current) {
        onSearchRef.current(normalized);
        lastSentRef.current = normalized;
      }
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, delay, minLength]);

  const showLabel = !focused && value.trim().length === 0;

  // Clear immediately, refocus the input, and skip the debounced effect
  const clearNow = () => {
    // Cancel any pending debounce
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    skipNextEffect.current = true;
    setValue("");
    lastSentRef.current = "";           // keep dedupe in sync
    onSearchRef.current("");            // immediate clear (no debounce)
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  // Flush immediately on Enter (skips debounce)
  const flushNow = () => {
    const normalized = normalize(value);
    const shouldFire =
      normalized.length === 0 || normalized.length >= minLength;

    if (!shouldFire) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (normalized !== lastSentRef.current) {
      onSearchRef.current(normalized);
      lastSentRef.current = normalized;
    }
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
            } else if (e.key === "Enter") {
              // Flush immediately on Enter (no debounce)
              e.preventDefault();
              flushNow();
            }
          }}
          placeholder=" " /* real placeholder suppressed */
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
