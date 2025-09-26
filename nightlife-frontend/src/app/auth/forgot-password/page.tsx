// src/app/(auth)/auth/forgot-password/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '@/services/domain/auth.service';
import { scrollToTop } from '@/utils/scrollUtils';

const forgotPasswordSchema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
});

type ForgotPasswordData = { email: string };

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scroll to top when the forgot password page loads (mobile-friendly)
  useEffect(() => {
    scrollToTop();
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordData) => {
    try {
      setIsLoading(true);
      setError(null);
      await authService.forgotPassword(data.email);
      setIsSubmitted(true);
    } catch {
      setError('Error al enviar el correo. Por favor intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07071a] py-4 px-4">
        <div className="w-full max-w-xl text-center">
          {/* Success Icon */}
          <div className="mb-8 flex justify-center">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-500/20 border-2 border-green-400/30 mb-6 animate-pulse">
              <svg className="h-10 w-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Purple pill headline with enhanced styling */}
          <div className="mb-8 flex justify-center">
            <div className="rounded-full bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-4 text-white font-bold text-lg shadow-lg shadow-purple-500/25 animate-bounce">
              ✉️ Correo enviado
            </div>
          </div>

          {/* Enhanced message with better typography */}
          <div className="mb-8 space-y-4">
            <p className="text-purple-100 text-lg leading-relaxed">
              Si existe una cuenta con ese correo, recibirás un mensaje con instrucciones para restablecer tu contraseña.
            </p>
            <p className="text-purple-200/80 text-sm">
              Revisa tu bandeja de entrada y carpeta de spam
            </p>
          </div>

          {/* Enhanced back button with gradient and hover effects */}
          <div className="space-y-4">
            <Link
              href="/auth#login"
              className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-purple-700 px-8 py-4 font-semibold text-white shadow-lg shadow-purple-500/25 hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-[#07071a] transform hover:scale-105 transition-all duration-200"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Volver al inicio de sesión
            </Link>
            
            {/* Additional helpful link */}
            <div className="pt-4">
              <button
                onClick={() => setIsSubmitted(false)}
                className="text-purple-300 hover:text-purple-200 text-sm underline underline-offset-4 transition-colors duration-200"
              >
                Enviar a otro correo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07071a] py-4 px-4">
      <div className="w-full max-w-xl">
        {/* Purple pill headline */}
        <div className="mb-8 flex justify-center">
          <div className="rounded-full bg-purple-600 px-6 py-3 text-white font-semibold shadow-sm">
            ¿Olvidaste tu contraseña?
          </div>
        </div>

        {/* Bold helper copy */}
        <p className="mb-4 font-semibold text-purple-100">
          Ingresa tu correo electrónico para recuperar tu cuenta.
        </p>

        {/* Error display */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-300/40 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div>
            <label htmlFor="email" className="sr-only">
              Correo electrónico
            </label>
            <input
              {...register('email')}
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="Correo electrónico"
              className="w-full rounded-2xl bg-white text-gray-900 px-4 py-3 shadow-sm 
                         placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            {errors.email && (
              <p className="mt-2 text-sm text-red-400">{errors.email.message}</p>
            )}
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex min-w-[200px] items-center justify-center rounded-full
                         bg-purple-600 px-8 py-3 font-semibold text-white shadow-sm
                         hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500
                         disabled:opacity-60"
            >
              {isLoading ? 'Enviando…' : 'Enviar'}
            </button>
          </div>
        </form>

        {/* Back link */}
        <div className="mt-6 text-center">
          <Link
            href="/auth#login"
            className="text-sm text-purple-200 hover:text-purple-100 underline underline-offset-4"
          >
            Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
