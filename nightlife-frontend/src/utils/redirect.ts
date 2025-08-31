import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useCallback } from 'react';

const REDIRECT_KEY = 'auth_redirect_path';
const REDIRECT_COOLDOWN_KEY = 'auth_redirect_cooldown';

/**
 * Save the current page path for redirect after login
 */
export function saveRedirectPath(): void {
  if (typeof window === 'undefined') return;
  
  const currentPath = window.location.pathname;
  const currentSearch = window.location.search;
  const currentHash = window.location.hash;
  
  // Don't save auth routes as redirect targets
  if (currentPath.startsWith('/auth/')) return;
  
  const fullPath = currentPath + currentSearch + currentHash;
  sessionStorage.setItem(REDIRECT_KEY, fullPath);
}

/**
 * Get the saved redirect path and clear it
 */
export function getAndClearRedirectPath(): string | null {
  if (typeof window === 'undefined') return null;
  
  const redirectPath = sessionStorage.getItem(REDIRECT_KEY);
  if (redirectPath) {
    // Clear the redirect path immediately to prevent loops
    sessionStorage.removeItem(REDIRECT_KEY);
    return redirectPath;
  }
  return null;
}

/**
 * Hook to handle redirect after authentication
 * Redirects to saved path or falls back to default
 */
export function useAuthRedirect(defaultPath: string = '/') {
  const router = useRouter();
  
  const redirectAfterAuth = useCallback(() => {
    // Prevent redirect if we're already on an auth route
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/')) {
      return;
    }
    
    // Prevent multiple redirects in quick succession
    if (typeof window !== 'undefined') {
      const lastRedirect = sessionStorage.getItem(REDIRECT_COOLDOWN_KEY);
      const now = Date.now();
      if (lastRedirect && (now - parseInt(lastRedirect)) < 1000) {
        return; // Prevent redirects within 1 second
      }
      sessionStorage.setItem(REDIRECT_COOLDOWN_KEY, now.toString());
    }
    
    const savedPath = getAndClearRedirectPath();
    const targetPath = savedPath || defaultPath;
    
    // Use window.location.href as fallback if router.push fails
    try {
      router.push(targetPath);
    } catch (error) {
      console.warn('Router push failed, using window.location:', error);
      window.location.href = targetPath;
    }
  }, [router, defaultPath]);
  
  return redirectAfterAuth;
}

/**
 * Hook to save current path when component mounts
 * Useful for login buttons that should remember where user was
 */
export function useSaveCurrentPath() {
  const pathname = usePathname();
  
  useEffect(() => {
    if (pathname && !pathname.startsWith('/auth/')) {
      sessionStorage.setItem(REDIRECT_KEY, pathname);
    }
  }, [pathname]);
}
