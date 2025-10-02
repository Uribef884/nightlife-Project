'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSelectedClub, useAuthActions } from '@/stores/auth.store';
import ProtectedRoute from '@/components/domain/auth/ProtectedRoute';
import { ClubOwnerSidebar } from '@/components/dashboard/club-owner/ClubOwnerSidebar';
import { ClubSelector } from '@/components/dashboard/club-owner/ClubSelector';
import { MobileMenuButton } from '@/components/dashboard/club-owner/MobileMenuButton';
import { ScrollToTopButton } from '@/components/dashboard/club-owner/ScrollToTopButton';
import { SettingsManagement } from '@/components/dashboard/club-owner/settings/SettingsManagement';

export default function SettingsPage() {
  const { user } = useAuth();
  const selectedClub = useSelectedClub();
  const { setSelectedClub } = useAuthActions();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
        <ClubOwnerSidebar 
          selectedClub={selectedClub} 
          activeSection="settings"
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        
        <div className="flex-1 flex flex-col w-full lg:w-auto pt-4">
          <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 sm:px-6 py-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                            Configuración
                  </h1>
                  <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                            Gestiona tu cuenta y configuración de la aplicación
                  </p>
                </div>
                <div className="w-full sm:w-auto flex items-center gap-2">
                  <ClubSelector 
                    selectedClub={selectedClub}
                    onClubChange={setSelectedClub}
                  />
                  <MobileMenuButton 
                    isOpen={isMobileMenuOpen}
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  />
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 p-3 sm:p-4 lg:p-6 overflow-x-hidden">
              <SettingsManagement />
          </main>
        </div>
        <ScrollToTopButton />
      </div>
    </ProtectedRoute>
  );
}
