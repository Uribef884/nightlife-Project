// src/components/common/useSwipe.ts
"use client";

/**
 * Lightweight swipe/drag helper for horizontal carousels.
 * - Pointer Events (mouse + touch)
 * - Ignores vertical gestures so page can scroll
 * - Returns only event handlers (NO style) to avoid duplicate `style` props
 */
import * as React from "react";
import { useCallback, useRef, useState } from "react";

export type SwipeOptions = {
  onSwipeLeft?: () => void;   // go to next
  onSwipeRight?: () => void;  // go to prev
  minDistance?: number;       // px threshold to trigger swipe
  maxAngleDeg?: number;       // reject if |angle| exceeds threshold (avoid vertical)
};

export function useSwipe(opts: SwipeOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    minDistance = 48,
    maxAngleDeg = 35,
  } = opts;

  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const [dragX, setDragX] = useState(0);

  const reset = useCallback(() => {
    dragging.current = false;
    setDragX(0);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.isPrimary === false) return;
    dragging.current = true;
    startX.current = e.clientX;
    startY.current = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * (180 / Math.PI);
    if (angle > maxAngleDeg) {
      // Looks like vertical scroll; stop tracking
      reset();
      return;
    }
    setDragX(dx);
  }, [maxAngleDeg, reset]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startX.current;
    dragging.current = false;

    if (Math.abs(dx) >= minDistance) {
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    }
    setDragX(0);
  }, [minDistance, onSwipeLeft, onSwipeRight]);

  return {
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      // NOTE: we purposefully DO NOT return a `style` prop here
      // to avoid "style is specified more than once" conflicts.
    },
    dragX,
    reset,
  };
}
