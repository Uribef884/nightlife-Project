'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@/services/domain/auth.service';
import { useAuthStore } from '@/stores/auth.store';
import Link from 'next/link';

type ForgotPasswordFormData = {
  email: string;
};

export default function ForgotPasswordForm() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { forgotPassword, clearError, isLoading, error } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    try {
      clearError();
      console.log('📧 [FORGOT_PASSWORD] Submitting forgot password request for:', data.email);
      await forgotPassword(data.email);
      console.log('✅ [FORGOT_PASSWORD] Forgot password request successful');
      setIsSubmitted(true);
    } catch (error) {
      console.error('❌ [FORGOT_PASSWORD] Forgot password failed:', error);
      // Error is already set in the store, but let's add some context
      if (error instanceof Error) {
        console.error('❌ [FORGOT_PASSWORD] Error details:', error.message);
      }
    }
  };

  if (isSubmitted) {
    return (
      <div className="w-full max-w-md mx-auto space-y-6 text-center">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-6">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-medium text-green-800 dark:text-green-200">
            Check your email
          </h3>
          <p className="mt-2 text-sm text-green-700 dark:text-green-300">
            We've sent a password reset link to your email address. Please check your inbox and follow the instructions to reset your password.
          </p>
        </div>
        
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Didn't receive the email?{' '}
          <button
            onClick={() => setIsSubmitted(false)}
            className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Try again
          </button>
        </div>
        
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <Link
            href="/auth/login"
            className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">
          Olvidé mi contraseña
        </h1>
        <p className="mt-2 text-gray-300">
          Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                 {/* Email field */}
         <div>
           <label htmlFor="email" className="block text-sm font-medium text-white">
             Correo electrónico
           </label>
           <input
             {...register('email')}
             type="email"
             id="email"
             className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-gray-900"
             placeholder="Ingresa tu correo electrónico"
           />
                     {errors.email && (
             <p className="mt-1 text-sm text-red-400">
               {errors.email.message}
             </p>
           )}
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

                 {/* Submit button */}
         <button
           type="submit"
           disabled={isLoading}
           className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
         >
           {isLoading ? (
             <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
             </svg>
           ) : null}
           {isLoading ? 'Enviando...' : 'Enviar enlace de restablecimiento'}
         </button>
      </form>

             {/* Links */}
       <div className="text-center space-y-2">
         <Link
           href="/auth/login"
           className="text-sm text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
         >
           Volver al inicio de sesión
         </Link>
         <div className="text-sm text-gray-600 dark:text-gray-400">
           ¿No tienes una cuenta?{' '}
           <Link
             href="/auth/register"
             className="text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300"
           >
             Regístrate
           </Link>
         </div>
       </div>
    </div>
  );
}
