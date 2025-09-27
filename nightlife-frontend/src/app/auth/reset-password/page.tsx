'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { authService } from '@/services/domain/auth.service';
import { scrollToTop } from '@/utils/scrollUtils';

const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe incluir al menos una letra mayúscula')
    .regex(/[0-9]/, 'La contraseña debe incluir al menos un número'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

type ResetPasswordData = { newPassword: string; confirmPassword: string };

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Scroll to top when the reset password page loads (mobile-friendly)
  useEffect(() => {
    scrollToTop();
  }, []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordData>({ resolver: zodResolver(resetPasswordSchema) });

  const newPassword = watch('newPassword');
  const confirmPassword = watch('confirmPassword');

  // Password validation checks
  const passwordChecks = {
    length: newPassword ? newPassword.length >= 8 : null,
    uppercase: newPassword ? /[A-Z]/.test(newPassword) : null,
    number: newPassword ? /[0-9]/.test(newPassword) : null,
  };

  // Check if passwords match
  const passwordsMatch = newPassword && confirmPassword ? newPassword === confirmPassword : null;

  useEffect(() => {
    if (!token) {
      setError('Token de restablecimiento inválido o faltante');
    }
  }, [token]);

  const onSubmit = async (data: ResetPasswordData) => {
    if (!token) return;

    try {
      setIsLoading(true);
      setError(null);
      
      await authService.resetPassword(token, data.newPassword);
      setIsSubmitted(true);
    } catch (error) {
      console.error('Password reset failed:', error);
      setError('Error al restablecer la contraseña. Por favor intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07071a]">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Enlace Inválido</h2>
          <p className="text-red-300 mb-6">Este enlace de restablecimiento es inválido o ha expirado.</p>
          <Link
            href="/auth/forgot-password"
            className="inline-flex items-center rounded-full bg-purple-600 px-6 py-2 font-semibold text-white hover:bg-purple-700"
          >
            Solicitar Nuevo Enlace
          </Link>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07071a]">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl">✅</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Contraseña Restablecida</h2>
          <p className="text-purple-200 mb-6">Tu contraseña ha sido actualizada. Ahora puedes iniciar sesión con tu nueva contraseña.</p>
          <Link
            href="/auth#login"
            className="inline-flex items-center rounded-full bg-purple-600 px-6 py-2 font-semibold text-white hover:bg-purple-700"
          >
            Ir al Inicio de Sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07071a] py-4 px-4">
      <div className="w-full max-w-xl">
        {/* Back to login */}
        <div className="mb-6">
          <Link
            href="/auth#login"
            className="inline-flex items-center text-sm text-purple-200 hover:text-purple-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver al inicio de sesión
          </Link>
        </div>

        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Crear Nueva Contraseña</h1>
          <p className="text-purple-200">
            Ingresa tu nueva contraseña a continuación. Asegúrate de que sea segura y memorable.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-300 mb-6">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-white mb-2">
              Nueva Contraseña
            </label>
            <div className="relative">
              <input
                {...register('newPassword')}
                id="newPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="w-full rounded-xl bg-white text-gray-900 px-3 py-2 pr-10 shadow-sm 
                           placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ingresa tu nueva contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && <p className="mt-1 text-sm text-red-400">{errors.newPassword.message}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-white mb-2">
              Confirmar Nueva Contraseña
            </label>
            <div className="relative">
              <input
                {...register('confirmPassword')}
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="w-full rounded-xl bg-white text-gray-900 px-3 py-2 pr-10 shadow-sm 
                           placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Confirma tu nueva contraseña"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((v) => !v)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1 text-sm text-red-400">{errors.confirmPassword.message}</p>}
          </div>

          {/* Password Requirements */}
          <div className="space-y-1">
            <p className="text-xs text-purple-200/80">Tu contraseña debe tener:</p>
            <ul className="text-xs space-y-0.5">
              <li className={passwordChecks.length === null ? 'text-purple-200/80' : passwordChecks.length ? 'text-green-400' : 'text-red-400'}>
                • Al menos 8 caracteres
              </li>
              <li className={passwordChecks.uppercase === null ? 'text-purple-200/80' : passwordChecks.uppercase ? 'text-green-400' : 'text-red-400'}>
                • Al menos una letra mayúscula
              </li>
              <li className={passwordChecks.number === null ? 'text-purple-200/80' : passwordChecks.number ? 'text-green-400' : 'text-red-400'}>
                • Al menos un número
              </li>
            </ul>
            
            {/* Passwords match indicator - only show when they don't match */}
            {newPassword && confirmPassword && !passwordsMatch && (
              <p className="text-xs text-red-400">Las contraseñas no coinciden</p>
            )}
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-full bg-purple-600 py-2 font-semibold text-white shadow-sm 
                       hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-purple-500 disabled:opacity-60"
          >
            {isLoading ? 'Actualizando Contraseña...' : 'Actualizar Contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordContent />
    </Suspense>
  );
}
