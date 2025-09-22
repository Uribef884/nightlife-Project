'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { registerSchema } from '@/services/domain/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/domain/auth.service';
import Link from 'next/link';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { useAuthRedirect } from '@/utils/redirect';

type RegisterFormData = { email: string; password: string; confirmPassword: string };

export default function RegisterForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register: registerUser, clearError, isLoading, error, isAuthenticated } = useAuthStore();
  const redirectAfterAuth = useAuthRedirect('/');

  useEffect(() => {
    if (isAuthenticated) redirectAfterAuth();
  }, [isAuthenticated, redirectAfterAuth]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(
      registerSchema
        .extend({ confirmPassword: registerSchema.shape.password })
        .refine((data) => data.password === data.confirmPassword, {
          message: 'Las contraseñas no coinciden',
          path: ['confirmPassword'],
        })
    ),
  });

  const password = watch('password');
  const confirmPassword = watch('confirmPassword');

  // Password validation checks
  const passwordChecks = {
    length: password ? password.length >= 8 : null,
    uppercase: password ? /[A-Z]/.test(password) : null,
    number: password ? /[0-9]/.test(password) : null,
  };

  // Check if passwords match
  const passwordsMatch = password && confirmPassword ? password === confirmPassword : null;

  const onSubmit = async (data: RegisterFormData) => {
    try {
      clearError();
      await registerUser(data.email, data.password);
    } catch (e) {
      console.error('Registration failed:', e);
    }
  };

  const handleGoogleRegister = async () => {
    try {
      clearError();
      await authService.initiateGoogleAuth();
    } catch (e) {
      console.error('Google registration failed:', e);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-white">
            Correo electrónico
          </label>
          <input
            {...register('email')}
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            tabIndex={-1}
            className="mt-1 block w-full rounded-xl bg-white text-gray-900 px-3 py-2 shadow-sm 
                       placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="correo@ejemplo.com"
          />
          {errors.email && <p className="mt-1 text-sm text-red-400">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-white">
            Contraseña
          </label>
          <div className="relative">
            <input
              {...register('password')}
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              tabIndex={-1}
              className="mt-1 block w-full rounded-xl bg-white text-gray-900 px-3 py-2 pr-10 shadow-sm 
                         placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Crea una contraseña"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-sm text-red-400">{errors.password.message}</p>}
        </div>

        {/* Confirm Password */}
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-white">
            Confirmar Contraseña
          </label>
          <div className="relative">
            <input
              {...register('confirmPassword')}
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              tabIndex={-1}
              className="mt-1 block w-full rounded-xl bg-white text-gray-900 px-3 py-2 pr-10 shadow-sm 
                         placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Repite la contraseña"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              tabIndex={-1}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              aria-label={showConfirmPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="mt-1 text-sm text-red-400">{errors.confirmPassword.message}</p>
          )}
        </div>

        {/* Password Requirements */}
        <div className="space-y-1">
          <p className="text-xs text-purple-200/80">La contraseña debe tener:</p>
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
          {password && confirmPassword && !passwordsMatch && (
            <p className="text-xs text-red-400">Las contraseñas no coinciden</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          tabIndex={-1}
          className="w-full rounded-full bg-purple-600 py-2.5 font-semibold text-white shadow-sm 
                     hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-purple-500 disabled:opacity-60"
        >
          {isLoading ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>

        {/* Terms and Privacy Policy Consent */}
        <p className="text-xs text-gray-400 text-center mt-3">
          Al crear una cuenta, aceptas nuestros{' '}
          <Link href="/terms" tabIndex={-1} className="text-purple-400 hover:text-purple-300 underline">
            Términos de Servicio
          </Link>{' '}
          y reconoces nuestra{' '}
          <Link href="/privacy" tabIndex={-1} className="text-purple-400 hover:text-purple-300 underline">
            Política de Privacidad
          </Link>
          .
        </p>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-purple-200/30" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[#07071a] text-purple-200/80">O continúa con</span>
        </div>
      </div>

      {/* Google Button */}
      <GoogleAuthButton
        label="Registrarse con Google"
        onClick={handleGoogleRegister}
        disabled={isLoading}
      />

      {/* Terms and Privacy Policy Consent for OAuth */}
      <p className="text-xs text-gray-400 text-center mt-3">
        Al crear una cuenta, aceptas nuestros{' '}
        <Link href="/terms" tabIndex={-1} className="text-purple-400 hover:text-purple-300 underline">
          Términos
        </Link>{' '}
        y reconoces nuestra{' '}
        <Link href="/privacy" tabIndex={-1} className="text-purple-400 hover:text-purple-300 underline">
          Política de Privacidad
        </Link>
        .
      </p>

      {/* Back to login */}
      <div className="mt-4 text-center text-sm text-purple-200">
        ¿Ya tienes una cuenta?{' '}
        <Link href="/auth/login" tabIndex={-1} className="underline underline-offset-4 hover:text-purple-100">
          Inicia sesión
        </Link>
      </div>
    </div>
  );
}
