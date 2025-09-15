import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService, type User } from '../services/domain/auth.service';

// Types for discriminated result
export type ChangePasswordResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | 'INCORRECT_CURRENT'
        | 'OAUTH_USER'
        | 'SAME_PASSWORD'
        | 'UNAUTHORIZED'
        | 'NETWORK_ERROR'
        | 'UNKNOWN_ERROR';
      message: string;
    };

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  changePassword: (
    oldPassword: string,
    newPassword: string,
    confirmPassword: string
  ) => Promise<ChangePasswordResult>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login action
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(email, password);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      // Register action
      register: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.register(email, password);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Registration failed',
          });
          throw error;
        }
      },

      // Logout action
      logout: async () => {
        set({ isLoading: true });
        try {
          await authService.logout();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          // Even if logout fails on backend, clear local state
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      // Forgot password action
      forgotPassword: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          await authService.forgotPassword(email);
          set({ isLoading: false, error: null });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to send reset email',
          });
          throw error;
        }
      },

      // Reset password action
      resetPassword: async (token: string, newPassword: string) => {
        set({ isLoading: true, error: null });
        try {
          await authService.resetPassword(token, newPassword);
          set({ isLoading: false, error: null });
        } catch (error) {
          set({
            isLoading: false,
            error: error instanceof Error ? error.message : 'Failed to reset password',
          });
          throw error;
        }
      },

      // Change password action - returns discriminated result instead of throwing
      changePassword: async (
        oldPassword: string,
        newPassword: string,
        confirmPassword: string
      ): Promise<ChangePasswordResult> => {
        set({ isLoading: true });
        try {
          await authService.changePassword(oldPassword, newPassword, confirmPassword);
          set({ isLoading: false });
          return { ok: true as const };
        } catch (error) {
          // Map backend errors to discriminated result (never navigate/refresh here)
          if (error instanceof Error) {
            const message = error.message.toLowerCase();

            if (message.includes('current password') || message.includes('incorrect')) {
              return {
                ok: false as const,
                code: 'INCORRECT_CURRENT' as const,
                message: 'La contraseña actual es incorrecta',
              };
            } else if (message.includes('cannot change password for oauth users') || message.includes('oauth')) {
              return {
                ok: false as const,
                code: 'OAUTH_USER' as const,
                message: 'No puedes cambiar la contraseña de una cuenta de Google',
              };
            } else if (message.includes('different') || message.includes('same')) {
              return {
                ok: false as const,
                code: 'SAME_PASSWORD' as const,
                message: 'La nueva contraseña debe ser diferente a la actual',
              };
            } else if (message.includes('unauthorized') || message.includes('401')) {
              return {
                ok: false as const,
                code: 'UNAUTHORIZED' as const,
                message: 'Sesión expirada. Por favor, inicia sesión nuevamente',
              };
            } else if (message.includes('network') || message.includes('fetch')) {
              return {
                ok: false as const,
                code: 'NETWORK_ERROR' as const,
                message: 'Error de conexión. Verifica tu internet e inténtalo de nuevo',
              };
            } else {
              return {
                ok: false as const,
                code: 'UNKNOWN_ERROR' as const,
                message: error.message,
              };
            }
          }

          return {
            ok: false as const,
            code: 'UNKNOWN_ERROR' as const,
            message: 'Error al cambiar la contraseña',
          };
        } finally {
          // Ensure loading is always cleared, avoiding race/double set patterns
          set({ isLoading: false });
        }
      },

      // Check authentication status
      checkAuth: async () => {
        set({ isLoading: true });
        try {
          const user = await authService.getCurrentUser();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Set user directly (for OAuth callbacks)
      setUser: (user: User | null) => {
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
          error: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Simple selectors without shallow comparison to avoid the infinite loop issue
export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useIsLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);

// Direct store access for actions to avoid selector issues
export const useAuthActions = () => {
  const store = useAuthStore();
  return {
    login: store.login,
    register: store.register,
    logout: store.logout,
    forgotPassword: store.forgotPassword,
    resetPassword: store.resetPassword,
    changePassword: store.changePassword,
    checkAuth: store.checkAuth,
    clearError: store.clearError,
    setUser: store.setUser,
  };
};
