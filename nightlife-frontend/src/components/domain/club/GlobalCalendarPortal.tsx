// src/components/domain/club/GlobalCalendarPortal.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ClubCalendar } from "@/components/domain/club/ClubCalendar";

/**
 * Single calendar instance that portals into whichever host is active.
 * If the host isn't mounted yet (e.g., tab transition animations),
 * we temporarily render into an off-screen parking node and
 * keep polling for the host for a short time.
 */
type Props = {
  hostId: string | null; // "calendar-host-reservas" | "calendar-host-carta" | null
  eventDates: Set<string>;
  freeDates: Set<string>;
  openDays: Set<string>;
  selectedDate: string | null;
  onSelect: (iso: string) => void;
};

export default function GlobalCalendarPortal({
  hostId,
  eventDates,
  freeDates,
  openDays,
  selectedDate,
  onSelect,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);

  const parkingRef = useRef<HTMLDivElement | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const lastSetElRef = useRef<HTMLElement | null>(null); // avoid setState if element unchanged

  // Ensure we have a parking element that lives for the page lifetime.
  useEffect(() => {
    if (typeof document === "undefined") return;
    let el = document.getElementById("calendar-portal-parking") as HTMLDivElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = "calendar-portal-parking";
      Object.assign(el.style, {
        position: "fixed",
        left: "-99999px",
        top: "-99999px",
        width: "0px",
        height: "0px",
        overflow: "hidden",
      });
      document.body.appendChild(el);
    }
    parkingRef.current = el;
    setMounted(true);

    // Only set if different (prevents a useless render on mount)
    if (lastSetElRef.current !== el) {
      lastSetElRef.current = el;
      setTargetEl(el);
    }
    return () => {
      // Keep parking node around; we only clear refs.
      parkingRef.current = null;
    };
  }, []);

  // Whenever hostId changes, try to lock onto the new host.
  // We poll for a short window because AnimatePresence may mount it a bit later.
  useEffect(() => {
    if (!mounted) return;

    // Clear any existing poller
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    // Helper that sets element only when it actually changed
    const setElIfChanged = (el: HTMLElement | null) => {
      if (el && lastSetElRef.current !== el) {
        lastSetElRef.current = el;
        setTargetEl(el);
      } else if (!el && targetEl !== null) {
        lastSetElRef.current = null;
        setTargetEl(null);
      }
    };

    // If no host requested, park.
    if (!hostId) {
      setElIfChanged(parkingRef.current);
      return;
    }

    // Try immediately…
    const tryAttach = () => {
      const host = document.getElementById(hostId) as HTMLElement | null;
      if (host) {
        setElIfChanged(host);
        return true;
      }
      return false;
    };

    if (tryAttach()) return;

    // …or poll briefly (max ~800ms)
    let elapsed = 0;
    const step = 50;
    pollTimerRef.current = window.setInterval(() => {
      elapsed += step;
      if (tryAttach() || elapsed >= 800) {
        if (pollTimerRef.current) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        if (elapsed >= 800 && !document.getElementById(hostId)) {
          // Couldn’t find host in time; keep parked (preserves state)
          setElIfChanged(parkingRef.current);
        }
      }
    }, step);

    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [hostId, mounted, targetEl]);

  if (!mounted || !targetEl) return null;

  return createPortal(
    <ClubCalendar
      monthOffset={0}
      eventDates={eventDates}
      freeDates={freeDates}
      openDays={openDays}
      selectedDate={selectedDate}
      onSelect={onSelect}
    />,
    targetEl
  );
}
