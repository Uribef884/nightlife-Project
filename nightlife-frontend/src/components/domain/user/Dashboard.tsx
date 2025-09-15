'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthStore } from '@/stores/auth.store';
import ProtectedRoute from '@/components/domain/auth/ProtectedRoute';

// ✅ Added small inline DeleteAccountDialog component for MVP
function DeleteAccountDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-sm sm:max-w-md">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
          ¿Estás seguro que deseas hacer esto?
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mb-4 sm:mb-6">
          Esta acción <strong>no puede ser revertida</strong>.
        </p>
        <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm sm:text-base transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold text-sm sm:text-base transition-colors"
          >
            Eliminar definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}

function PerfilContent() {
  const { user } = useAuth();
  const { logout } = useAuthStore();
  const [showDelete, setShowDelete] = useState(false);

  // OAuth detection
  const isOAuthUser = user?.isOAuthUser === true || 
                     !!(user as any)?.googleId || 
                     (user as any)?.provider === 'google' ||
                     (user as any)?.oauthProvider === 'google';

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        setShowDelete(false);
        await logout();
      } else {
        const data = await response.json();
        alert(`Error al eliminar cuenta: ${data.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Error de conexión. Inténtalo de nuevo.');
    }
  };

  // ✅ Role-aware content
  if (user?.role === 'waiter' || user?.role === 'bouncer') {
    // Only logout button
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center p-4">
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-4 sm:px-6 py-2 sm:py-3 rounded-md text-sm sm:text-base font-medium transition-colors w-full sm:w-auto"
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6">
        {/* ✅ Always show email for user + clubowner */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow">
          <p className="text-sm sm:text-base text-gray-900 dark:text-white font-semibold">Email</p>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">{user?.email}</p>
        </div>

        {/* Historial de órdenes */}
        <Link
          href="/profile/orders"
          className="block bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <span className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">Historial de órdenes</span>
        </Link>

        {/* Mis QRs → only for role user */}
        {user?.role === 'user' && (
          <Link
            href="/profile/qrs"
            className="block bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-sm sm:text-base text-gray-900 dark:text-white font-medium">Mis QR&apos;s</span>
          </Link>
        )}

        {/* Ajustes → both user + clubowner */}
        <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow space-y-3 sm:space-y-4">
          <p className="text-sm sm:text-base text-gray-900 dark:text-white font-semibold">Ajustes</p>
          {/* Only show change password for non-OAuth users */}
          {!isOAuthUser && (
            <Link
              href="/profile/settings/change-password"
              className="block text-nl-secondary hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 hover:underline text-sm sm:text-base transition-colors"
            >
              Cambiar contraseña
            </Link>
          )}
          {user?.role === 'user' && (
            <button
              onClick={() => setShowDelete(true)}
              className="block text-red-600 hover:text-red-700 hover:underline text-sm sm:text-base transition-colors"
            >
              Eliminar cuenta
            </button>
          )}
        </div>

        {/* Logout always visible */}
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 sm:py-3 rounded-md text-sm sm:text-base font-medium transition-colors"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Delete modal */}
      {showDelete && (
        <DeleteAccountDialog
          onClose={() => setShowDelete(false)}
          onConfirm={handleDeleteAccount}
        />
      )}
    </div>
  );
}

export default function PerfilPage() {
  return (
    <ProtectedRoute>
      <PerfilContent />
    </ProtectedRoute>
  );
}
