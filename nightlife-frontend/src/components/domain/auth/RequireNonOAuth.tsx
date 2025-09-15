'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface RequireNonOAuthProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function RequireNonOAuth({ children, fallback }: RequireNonOAuthProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Remove the useEffect that was causing automatic redirects
  // The redirect logic is now handled in the render method below

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // If no user, redirect to login
  if (!user) {
    router.push('/auth/login');
    // Scroll to top when redirecting to login
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    return null;
  }

  // Check if user is OAuth user
  const isOAuthUser = user.isOAuthUser === true || !!(user as any)?.googleId;
  
  if (isOAuthUser) {
    // Show fallback or redirect
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Cambio de contraseña no disponible
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Tu cuenta está vinculada con Google. No puedes cambiar la contraseña desde aquí.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-md font-medium"
            >
              Volver al perfil
            </button>
          </div>
        </div>
      </div>
    );
  }

  // User is not OAuth, show the protected content
  return <>{children}</>;
}
