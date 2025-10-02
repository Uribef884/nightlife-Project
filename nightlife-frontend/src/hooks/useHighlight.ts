// nightlife-frontend/src/hooks/useHighlight.ts
"use client";

import { useEffect, useRef } from 'react';
import { parseHighlightFromURL, highlightItem, type HighlightInfo } from '@/utils/highlight';

/**
 * Hook to handle highlighting of shared items
 */
export function useHighlight() {
  const highlightProcessed = useRef(false);

  useEffect(() => {
    // Only process highlight once per page load
    if (highlightProcessed.current) return;
    
    const highlightInfo = parseHighlightFromURL();
    
    if (highlightInfo) {
      console.log('Highlight info found:', highlightInfo);
      
      // Wait a bit for the page to load and render
      const timer = setTimeout(() => {
        const success = highlightItem(highlightInfo);
        console.log('Highlight attempt result:', success);
        
        if (success) {
          highlightProcessed.current = true;
        }
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

  return {
    highlightProcessed: highlightProcessed.current
  };
}
