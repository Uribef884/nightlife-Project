'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useAuthStore } from '@/stores/auth.store';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Mail, 
  Shield, 
  LogOut
} from 'lucide-react';

export function SettingsManagement() {
  const { user } = useAuth();
  const { logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      // Redirect to login page after successful logout
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Account Information */}
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow">
                <div className="mb-4">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                    Información de la Cuenta
                  </h2>
                </div>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Correo Electrónico</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{user?.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <Shield className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Rol</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{user?.role}</p>
                    </div>
                  </div>
        </div>
      </div>

      {/* Logout Button */}
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow">
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors w-full sm:w-auto"
        >
                  <LogOut className="w-4 h-4" />
                  Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
