'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useAuthStore } from '@/stores/auth.store';
import ProtectedRoute from '@/components/domain/auth/ProtectedRoute';

function DashboardContent() {
  const { user } = useAuth();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'clubowner':
        return 'Dueño del Club';
      case 'bouncer':
        return 'Portero';
      case 'waiter':
        return 'Mesero';
      case 'user':
        return 'Usuario';
      default:
        return role;
    }
  };

  const getDashboardContent = () => {
    switch (user?.role) {
      case 'admin':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Panel de Administrador
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Gestión de Usuarios
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Administra usuarios, roles y permisos del sistema
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Estadísticas del Sistema
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Visualiza métricas y reportes del sistema
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Configuración Global
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Configura parámetros del sistema
                </p>
              </div>
            </div>
          </div>
        );
      case 'clubowner':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Panel del Dueño del Club
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Gestión de Eventos
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Crea y administra eventos de tu club
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Personal
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Administra bouncers y meseros
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Reportes
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Visualiza estadísticas de tu club
                </p>
              </div>
            </div>
          </div>
        );
      case 'bouncer':
      case 'waiter':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Panel de Personal
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Verificar Entradas
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Escanea códigos QR de tickets
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Gestión de Menús
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Administra menús y pedidos
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Reportes del Turno
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Registra actividades del turno
                </p>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Panel de Usuario
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Mis Tickets
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Visualiza y gestiona tus tickets
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Historial de Compras
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Revisa tu historial de compras
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Configuración
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Personaliza tu cuenta
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Panel de Control
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Bienvenido de vuelta, {user?.email} ({getRoleDisplayName(user?.role || '')})
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {getDashboardContent()}
      </main>
    </div>
  );
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
