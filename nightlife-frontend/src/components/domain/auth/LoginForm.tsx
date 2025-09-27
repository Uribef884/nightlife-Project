'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { loginSchema } from '@/services/domain/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import { authService } from '@/services/domain/auth.service';
import Link from 'next/link';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { useAuthRedirect } from '@/utils/redirect';

type LoginFormData = { email: string; password: string };

export default function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { login, clearError, isLoading, error, isAuthenticated } = useAuthStore();
  const redirectAfterAuth = useAuthRedirect('/');

  // Move useForm hook to top level - never inside conditional logic
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (isAuthenticated) {
      redirectAfterAuth();
    }
  }, [isAuthenticated, redirectAfterAuth]);

  if (isAuthenticated === undefined) {
    return (
      <div className="w-full max-w-md mx-auto text-center py-10">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();
      await login(data.email, data.password);
    } catch (e) {
      console.error('Login failed:', e);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      clearError();
      await authService.initiateGoogleAuth();
    } catch (e) {
      console.error('Google login failed:', e);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
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
              autoComplete="current-password"
              tabIndex={-1}
              className="mt-1 block w-full rounded-xl bg-white text-gray-900 px-3 py-2 pr-10 shadow-sm 
                         placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="Tu contraseña"
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
          className="w-full rounded-full bg-purple-600 py-2 font-semibold text-white shadow-sm 
                     hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-purple-500 disabled:opacity-60"
        >
          {isLoading ? 'Ingresando…' : 'Ingresar'}
        </button>
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
        label="Iniciar sesión con Google"
        onClick={handleGoogleLogin}
        disabled={isLoading}
      />

      {/* Terms and Privacy Policy Consent for OAuth */}
      <p className="text-xs text-gray-400 text-center mt-3">
        Al iniciar sesión con Google, aceptas nuestros{' '}
        <Link href="/terms" className="text-purple-400 hover:text-purple-300 underline">
          Términos de Servicio
        </Link>{' '}
        y reconoces nuestra{' '}
        <Link href="/privacy" className="text-purple-400 hover:text-purple-300 underline">
          Política de Privacidad
        </Link>
        .
      </p>

      {/* Forgot Password */}
      <div className="mt-4 flex justify-center">
        <Link
          href="/auth/forgot-password"
          tabIndex={-1}
          className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium
                     text-purple-100 bg-white/5 hover:bg-white/10 border border-white/10"
        >
          Olvidé mi contraseña
        </Link>
      </div>


    </div>
  );
}
