// src/hooks/useKeyboardInsets.ts
"use client";

import { useEffect, useState } from "react";

/**
 * Hook to detect keyboard visibility and compute bottom inset for mobile devices.
 * Uses window.visualViewport API for accurate keyboard detection on iOS/Android.
 * 
 * @returns keyboardInset - The height of the keyboard in pixels (0 when closed)
 */
export function useKeyboardInsets(): number {
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    // Check if visualViewport is supported (modern mobile browsers)
    if (typeof window === "undefined" || !window.visualViewport) {
      return;
    }

    const updateKeyboardInset = () => {
      const visualViewport = window.visualViewport;
      if (!visualViewport) return;
      
      // Calculate keyboard height as the difference between window height and visual viewport height
      const keyboardHeight = Math.max(0, window.innerHeight - visualViewport.height);
      setKeyboardInset(keyboardHeight);
      
      // Set CSS custom property for global use
      document.documentElement.style.setProperty('--kb-inset', `${keyboardHeight}px`);
    };

    // Initial calculation
    updateKeyboardInset();

    // Listen for viewport changes (keyboard open/close)
    window.visualViewport.addEventListener('resize', updateKeyboardInset);

    // Cleanup
    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardInset);
      // Reset CSS custom property
      document.documentElement.style.setProperty('--kb-inset', '0px');
    };
  }, []);

  return keyboardInset;
}
