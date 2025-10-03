'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function ClubOwnerDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  // Redirect to club profile page
  useEffect(() => {
    if (user?.role === 'clubowner' || user?.role === 'admin') {
      router.replace('/dashboard/club-owner/club-profile');
    }
  }, [router, user?.role]);

  // Only allow club owners and admins
  if (user?.role !== 'clubowner' && user?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Acceso Denegado
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            No tienes permisos para acceder a este panel.
          </p>
        </div>
      </div>
    );
  }

  // Show loading while redirecting
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Redirigiendo...</p>
      </div>
    </div>
  );
}
