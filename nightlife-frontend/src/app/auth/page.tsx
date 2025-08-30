// src/app/auth/page.tsx
'use client';

/**
 * Public /auth page that uses hash-based tabs (#login, #register, #forgot-password)
 * and renders the animated AuthLayout with the right form.
 *
 * NOTE: The actual logic lives in pageClient to keep the page tiny.
 */
import AuthPage from './pageClient';

export default function AuthRoute() {
  return <AuthPage />;
}
