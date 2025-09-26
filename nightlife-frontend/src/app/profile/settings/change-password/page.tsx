'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthStore } from '@/stores/auth.store';
import ProtectedRoute from '@/components/domain/auth/ProtectedRoute';
import { Eye, EyeOff } from 'lucide-react';
import { showGlobalModal } from '@/components/ui/GlobalModal';


function ChangePasswordContent() {
  const { } = useAuth();
  const { changePassword } = useAuthStore();

  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);

  const [showPassword, setShowPassword] = useState({
    old: false,
    new: false,
    confirm: false
  });

  // Password validation checks for new password
  const passwordChecks = {
    length: formData.newPassword ? formData.newPassword.length >= 8 : null,
    uppercase: formData.newPassword ? /[A-Z]/.test(formData.newPassword) : null,
    number: formData.newPassword ? /[0-9]/.test(formData.newPassword) : null,
  };

  // Check if passwords match
  const passwordsMatch =
    formData.newPassword && formData.confirmPassword
      ? formData.newPassword === formData.confirmPassword
      : null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const togglePasswordVisibility = (field: 'old' | 'new' | 'confirm') => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const showModal = useCallback((type: 'success' | 'error', title: string, message: string) => {
    showGlobalModal(type, title, message);
  }, []);


  const validateForm = () => {
    if (!formData.oldPassword) {
      showModal('error', 'Error de validación', 'La contraseña actual es requerida');
      return false;
    }
    if (!formData.newPassword) {
      showModal('error', 'Error de validación', 'La nueva contraseña es requerida');
      return false;
    }
    if (formData.newPassword.length < 8) {
      showModal('error', 'Error de validación', 'La nueva contraseña debe tener al menos 8 caracteres');
      return false;
    }
    if (!/[A-Z]/.test(formData.newPassword)) {
      showModal('error', 'Error de validación', 'La nueva contraseña debe incluir al menos una letra mayúscula');
      return false;
    }
    if (!/[0-9]/.test(formData.newPassword)) {
      showModal('error', 'Error de validación', 'La nueva contraseña debe incluir al menos un número');
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      showModal('error', 'Error de validación', 'Las contraseñas nuevas no coinciden');
      return false;
    }
    if (formData.oldPassword === formData.newPassword) {
      showModal('error', 'Error de validación', 'La nueva contraseña debe ser diferente a la actual');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);

    try {
      const result = await changePassword(
        formData.oldPassword,
        formData.newPassword,
        formData.confirmPassword
      );

      if (result.ok) {
        showModal(
          'success',
          '¡Éxito!',
          'Tu contraseña ha sido actualizada correctamente.'
        );
        setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        showModal('error', 'Error', result.message);
      }
    } catch {
      showModal('error', 'Error', 'Error inesperado. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-nl-secondary hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 mb-4 transition-colors"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm sm:text-base">Volver al perfil</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">Actualizar Contraseña</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-2">
            Cambia tu contraseña para mantener tu cuenta segura
          </p>
          
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Current Password */}
            <div>
              <label htmlFor="oldPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Contraseña actual
              </label>
              <div className="relative">
                <input
                  type={showPassword.old ? 'text' : 'password'}
                  id="oldPassword"
                  name="oldPassword"
                  value={formData.oldPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-nl-secondary focus:border-nl-secondary dark:bg-gray-700 dark:text-white"
                  placeholder="Ingresa tu contraseña actual"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('old')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label={showPassword.old ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword.old ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword.new ? 'text' : 'password'}
                  id="newPassword"
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-nl-secondary focus:border-nl-secondary dark:bg-gray-700 dark:text-white"
                  placeholder="Ingresa tu nueva contraseña"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label={showPassword.new ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword.new ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">La nueva contraseña debe tener:</p>
              <ul className="text-xs space-y-0.5">
                <li className={passwordChecks.length === null ? 'text-gray-400' : passwordChecks.length ? 'text-green-500' : 'text-red-500'}>
                  • Al menos 8 caracteres
                </li>
                <li className={passwordChecks.uppercase === null ? 'text-gray-400' : passwordChecks.uppercase ? 'text-green-500' : 'text-red-500'}>
                  • Al menos una letra mayúscula
                </li>
                <li className={passwordChecks.number === null ? 'text-gray-400' : passwordChecks.number ? 'text-green-500' : 'text-red-500'}>
                  • Al menos un número
                </li>
              </ul>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirmar nueva contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword.confirm ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-nl-secondary focus:border-nl-secondary dark:bg-gray-700 dark:text-white"
                  placeholder="Confirma tu nueva contraseña"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label={showPassword.confirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword.confirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Passwords match indicator - only show when they don't match */}
              {formData.newPassword && formData.confirmPassword && !passwordsMatch && (
                <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
              <Link
                href="/dashboard"
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-nl-secondary transition-colors text-center"
              >
                Cancelar
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-nl-secondary hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-md font-semibold focus:outline-none focus:ring-2 focus:ring-nl-secondary focus:ring-offset-2 transition-colors"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm sm:text-base">Actualizando contraseña...</span>
                  </div>
                ) : (
                  <span className="text-sm sm:text-base">Actualizar contraseña</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

    </div>
  );
}

export default function ChangePasswordPage() {
  return (
    <ProtectedRoute>
      <ChangePasswordContent />
    </ProtectedRoute>
  );
}
