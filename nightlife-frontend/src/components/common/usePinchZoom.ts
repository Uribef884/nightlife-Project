// src/components/common/usePinchZoom.ts
"use client";

/**
 * Minimal pinch-to-zoom + pan hook using Pointer Events.
 * - Two fingers: pinch to scale (1.0 .. maxScale), pan follows the midpoint.
 * - One finger while zoomed: pan.
 * - Does NOT return a `style` prop (to avoid duplicate style warnings).
 * - Consumer should set `touchAction: 'none'` on the zoom area so we receive multi-touch events.
 *
 * Notes:
 * - We intentionally don't clamp panning to edges; users can pan freely.
 * - You can clamp externally if desired by reading `offset` and container size.
 */

import * as React from "react";
import { useCallback, useRef, useState } from "react";

type Vec2 = { x: number; y: number };

export type PinchZoomOptions = {
  minScale?: number;     // default 1
  maxScale?: number;     // default 2.5
  disableWhile?: boolean; // reserved
};

export function usePinchZoom(opts: PinchZoomOptions = {}) {
  const minScale = opts.minScale ?? 1;
  const maxScale = opts.maxScale ?? 2.5;

  // Public state
  const [scale, setScale] = useState<number>(1);
  const [offset, setOffset] = useState<Vec2>({ x: 0, y: 0 });

  // Internal gesture refs
  const pointers = useRef<Map<number, Vec2>>(new Map());
  const startScale = useRef<number>(1);
  const startOffset = useRef<Vec2>({ x: 0, y: 0 });
  const pinchStartDist = useRef<number>(0);
  const pinchStartMid = useRef<Vec2>({ x: 0, y: 0 });
  const lastDragPos = useRef<Vec2 | null>(null);

  const getPointersArray = () => Array.from(pointers.current.values());

  function getDistance(a: Vec2, b: Vec2) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function getMidpoint(a: Vec2, b: Vec2): Vec2 {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!e.isPrimary && pointers.current.size === 0) return; // only track primary first
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = getPointersArray();
    if (pts.length === 2) {
      // Start pinch
      pinchStartDist.current = getDistance(pts[0], pts[1]);
      pinchStartMid.current = getMidpoint(pts[0], pts[1]);
      startScale.current = scale;
      startOffset.current = { ...offset };
      lastDragPos.current = null; // reset one-finger drag tracker
    } else if (pts.length === 1) {
      lastDragPos.current = { ...pts[0] };
      startOffset.current = { ...offset };
    }
  }, [scale, offset]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const pts = getPointersArray();

    if (pts.length === 2) {
      // Pinch in progress: scale around midpoint, pan following midpoint delta
      const dist = getDistance(pts[0], pts[1]);
      const ratio = dist / (pinchStartDist.current || 1);
      const nextScale = Math.min(maxScale, Math.max(minScale, startScale.current * ratio));

      // Pan by midpoint delta relative to pinch start
      const mid = getMidpoint(pts[0], pts[1]);
      const dx = mid.x - pinchStartMid.current.x;
      const dy = mid.y - pinchStartMid.current.y;

      setScale(nextScale);
      setOffset({ x: startOffset.current.x + dx, y: startOffset.current.y + dy });
      lastDragPos.current = null;
      return;
    }

    // One-finger drag while zoomed
    if (pts.length === 1 && scale > 1.02) {
      const p = pts[0];
      if (lastDragPos.current) {
        const dx = p.x - lastDragPos.current.x;
        const dy = p.y - lastDragPos.current.y;
        setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
      }
      lastDragPos.current = { ...p };
    }
  }, [scale, minScale, maxScale]);

  const onPointerUpOrCancel = useCallback((e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.delete(e.pointerId);
    }
    const pts = getPointersArray();
    if (pts.length < 2) {
      // End pinch
      pinchStartDist.current = 0;
      lastDragPos.current = pts.length === 1 ? { ...pts[0] } : null;
      // If scale is very close to 1, snap to 1 and reset offset (nice finish)
      if (scale < 1.01) {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }
    }
  }, [scale]);

  const reset = useCallback(() => {
    pointers.current.clear();
    setScale(1);
    setOffset({ x: 0, y: 0 });
    lastDragPos.current = null;
  }, []);

  return {
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerUpOrCancel,
      onPointerCancel: onPointerUpOrCancel,
      // IMPORTANT: add `style={{ touchAction: 'none' }}` on the element using this bind
      // so we receive proper multi-touch events for pinch gestures.
    },
    scale,
    offset,
    setScale, // expose for double-tap toggling
    reset,
  };
}
