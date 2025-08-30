'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processCallback = async () => {
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

        // Redirect to dashboard or home page
        router.push('/dashboard');
      } catch (error) {
        console.error('Google callback error:', error);
        setError('Authentication failed');
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, setUser, router]);

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
            onClick={() => router.push('/auth')}
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
