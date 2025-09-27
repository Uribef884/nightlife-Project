'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

function GoogleCallbackContent() {
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasRedirected, setHasRedirected] = useState(false);
  const [hasProcessed, setHasProcessed] = useState(false);

  useEffect(() => {
    const processCallback = async () => {
      // Prevent multiple processing
      if (hasProcessed) {
        return;
      }
      setHasProcessed(true);

      try {
        // Get token and user data from URL parameters
        const token = searchParams.get('token');
        const userParam = searchParams.get('user');

        if (!token || !userParam) {
          setError('Missing authentication data');
          setIsProcessing(false);
          return;
        }

        // Parse user data (it's URL encoded JSON)
        let userData;
        try {
          userData = JSON.parse(decodeURIComponent(userParam));
        } catch (parseError) {
          console.error('Failed to parse user data:', parseError);
          setError('Invalid user data');
          setIsProcessing(false);
          return;
        }

        // Store authentication data
        setUser(userData);

        // Prevent multiple redirects
        if (!hasRedirected) {
          setHasRedirected(true);
          
          // Get the saved redirect path
          const savedPath = sessionStorage.getItem('auth_redirect_path');
          const targetPath = savedPath || '/';
          
          // Clear the redirect path
          if (savedPath) {
            sessionStorage.removeItem('auth_redirect_path');
          }
          
          // Use direct navigation for more reliable redirect
          window.location.href = targetPath;
        }
      } catch (error) {
        console.error('Google callback error:', error);
        setError('Authentication failed');
        setIsProcessing(false);
        setHasRedirected(false); // Reset redirect flag on error
      }
    };

    processCallback();
  }, [searchParams, setUser, hasRedirected, isProcessing, hasProcessed]);

  if (isProcessing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07071a]">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-2 border-purple-500 border-t-transparent mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Completando autenticación</h2>
          <p className="text-purple-200">Por favor espera...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07071a]">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Error de autenticación</h2>
          <p className="text-red-300 mb-6">{error}</p>
          <button
            onClick={() => window.location.href = '/auth/login'}
            className="inline-flex items-center rounded-full bg-purple-600 px-6 py-2 font-semibold text-white hover:bg-purple-700"
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#07071a]">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 animate-spin rounded-full border-2 border-purple-500 border-t-transparent mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Cargando...</h2>
          <p className="text-purple-200">Por favor espera...</p>
        </div>
      </div>
    }>
      <GoogleCallbackContent />
    </Suspense>
  );
}
