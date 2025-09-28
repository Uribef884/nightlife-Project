'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface UseUnsavedChangesOptions {
  hasUnsavedChanges: boolean;
  onSave: () => Promise<void> | void;
  onDiscard?: () => void;
  shouldBlockNavigation?: (pathname: string) => boolean;
}

export function useUnsavedChanges({
  hasUnsavedChanges,
  onSave,
  onDiscard,
  shouldBlockNavigation = () => true,
}: UseUnsavedChangesOptions) {
  const router = useRouter();
  const pendingNavigation = useRef<string | null>(null);
  const isNavigating = useRef(false);

  // Block navigation when there are unsaved changes
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (hasUnsavedChanges && !isNavigating.current) {
        e.preventDefault();
        // Store the intended navigation
        const currentPath = window.location.pathname;
        pendingNavigation.current = currentPath;
        // Trigger the unsaved changes modal
        window.dispatchEvent(new CustomEvent('unsavedChangesDetected'));
        // Push the current state back to prevent navigation
        window.history.pushState(null, '', currentPath);
      }
    };

    // Block Link clicks when there are unsaved changes
    const handleLinkClick = (e: MouseEvent) => {
      if (hasUnsavedChanges && !isNavigating.current) {
        const target = e.target as HTMLElement;
        const link = target.closest('a[href]') as HTMLAnchorElement;
        
        if (link && link.href) {
          e.preventDefault();
          e.stopPropagation();
          
          // Extract pathname from href
          const url = new URL(link.href);
          const pathname = url.pathname;
          
          // Check if this navigation should be blocked
          if (shouldBlockNavigation(pathname)) {
            pendingNavigation.current = pathname;
            window.dispatchEvent(new CustomEvent('unsavedChangesDetected'));
          } else {
            // Allow navigation if it shouldn't be blocked
            window.location.href = link.href;
          }
        }
      }
    };

    // Block browser back/forward navigation
    window.addEventListener('popstate', handlePopState);
    // Block Link clicks
    document.addEventListener('click', handleLinkClick, true);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [hasUnsavedChanges, shouldBlockNavigation]);

  // Handle programmatic navigation
  const handleNavigation = useCallback((href: string) => {
    if (hasUnsavedChanges && shouldBlockNavigation(href)) {
      pendingNavigation.current = href;
      window.dispatchEvent(new CustomEvent('unsavedChangesDetected'));
      return false; // Block navigation
    }
    return true; // Allow navigation
  }, [hasUnsavedChanges, shouldBlockNavigation]);

  // Save changes and navigate
  const saveAndNavigate = useCallback(async () => {
    try {
      isNavigating.current = true;
      await onSave();
      
      if (pendingNavigation.current) {
        router.push(pendingNavigation.current);
        pendingNavigation.current = null;
      }
    } catch (error) {
      console.error('Error saving changes:', error);
    } finally {
      isNavigating.current = false;
    }
  }, [onSave, router]);

  // Discard changes and navigate
  const discardAndNavigate = useCallback(() => {
    isNavigating.current = true;
    onDiscard?.();
    
    if (pendingNavigation.current) {
      router.push(pendingNavigation.current);
      pendingNavigation.current = null;
    }
    
    isNavigating.current = false;
  }, [onDiscard, router]);

  // Cancel navigation
  const cancelNavigation = useCallback(() => {
    pendingNavigation.current = null;
  }, []);

  return {
    handleNavigation,
    saveAndNavigate,
    discardAndNavigate,
    cancelNavigation,
    pendingNavigation: pendingNavigation.current,
  };
}
