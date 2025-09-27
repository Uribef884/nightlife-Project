import { z } from 'zod';

// Types
export interface User {
  id: string;
  email: string;
  role: 'user' | 'clubowner' | 'waiter' | 'bouncer' | 'admin';
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isOAuthUser?: boolean;
  clubId?: string | null;
  clubIds?: string[] | null;
}

export interface LoginResponse {
  message: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  token: string;
  user: User;
}

export interface AuthError {
  error: string;
  details?: unknown;
}

// Validation schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[0-9]/, 'Password must include at least one number')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
  confirmPassword: z.string().min(1, 'Password confirmation is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match",
  path: ["confirmPassword"],
});

// Response validation schemas
export const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(['user', 'clubowner', 'waiter', 'bouncer', 'admin']),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  avatar: z.string().optional(),
  isOAuthUser: z.boolean().optional(),
  clubId: z.string().nullable().optional(),
  clubIds: z.array(z.string()).nullable().optional(),
});

export const loginResponseSchema = z.object({
  message: z.string(),
  user: userSchema,
});

export const registerResponseSchema = z.object({
  message: z.string(),
  token: z.string(),
  user: userSchema,
});

export const messageResponseSchema = z.object({
  message: z.string(),
});

export const selectClubResponseSchema = z.object({
  token: z.string(),
  user: userSchema,
});

export const availableClubsResponseSchema = z.object({
  clubs: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    city: z.string().optional(),
    profileImageUrl: z.string().optional(),
    isActive: z.boolean(),
  })),
});

import { ApiService } from '../shared/api.service';

class AuthService extends ApiService {
  constructor() {
    super();
  }

  // Login
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.post<unknown>('/auth/login', { email, password });
    return loginResponseSchema.parse(response);
  }

  // Register
  async register(email: string, password: string): Promise<RegisterResponse> {
    const response = await this.post<unknown>('/auth/register', { email, password });
    return registerResponseSchema.parse(response);
  }

  // Logout
  async logout(): Promise<{ message: string }> {
    const response = await this.post<unknown>('/auth/logout');
    return messageResponseSchema.parse(response);
  }

  // Forgot password
  async forgotPassword(email: string): Promise<{ message: string }> {
    console.log('📤 [AUTH_SERVICE] Calling forgot password API for:', email);
    try {
      const response = await this.post<unknown>('/auth/forgot-password', { email });
      console.log('✅ [AUTH_SERVICE] Forgot password API call successful:', response);
      return messageResponseSchema.parse(response);
    } catch (error) {
      console.error('❌ [AUTH_SERVICE] Forgot password API call failed:', error);
      throw error;
    }
  }

  // Reset password
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const response = await this.post<unknown>('/auth/reset-password', { token, newPassword });
    return messageResponseSchema.parse(response);
  }

  // Change password
  async changePassword(oldPassword: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    const response = await this.post<unknown>('/auth/change-password', { 
      oldPassword, 
      newPassword, 
      confirmPassword 
    });
    return messageResponseSchema.parse(response);
  }

  // Get current user
  async getCurrentUser(): Promise<User> {
    const response = await this.get<unknown>('/auth/me');
    return userSchema.parse(response);
  }

  // Google OAuth
  async initiateGoogleAuth(): Promise<void> {
    const googleAuthUrl = `${this.baseUrl}/auth/google`;
    window.location.href = googleAuthUrl;
  }

  // Check if user is authenticated (by trying to get current user)
  async isAuthenticated(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch {
      return false;
    }
  }

  // Get user role
  getUserRole(user: User | null): string | null {
    return user?.role || null;
  }

  // Check if user has specific role
  hasRole(user: User | null, role: string): boolean {
    return user?.role === role;
  }

  // Check if user has any of the specified roles
  hasAnyRole(user: User | null, roles: string[]): boolean {
    return user ? roles.includes(user.role) : false;
  }

  // Check if user is admin
  isAdmin(user: User | null): boolean {
    return this.hasRole(user, 'admin');
  }

  // Check if user is club owner
  isClubOwner(user: User | null): boolean {
    return this.hasRole(user, 'clubowner');
  }

  // Check if user is staff (bouncer or waiter)
  isStaff(user: User | null): boolean {
    return this.hasAnyRole(user, ['bouncer', 'waiter']);
  }

  // Check if user can access club (clubowner, bouncer, waiter)
  canAccessClub(user: User | null): boolean {
    return this.hasAnyRole(user, ['clubowner', 'bouncer', 'waiter']);
  }

  // Get available clubs for the current user
  async getAvailableClubs(): Promise<{ clubs: Array<{
    id: string;
    name: string;
    description?: string;
    city?: string;
    profileImageUrl?: string;
    isActive: boolean;
  }> }> {
    const response = await this.request('/auth/available-clubs', {
      method: 'GET',
    }) as Response;

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Failed to fetch available clubs');
    }

    const data = await response.json() as unknown;
    return availableClubsResponseSchema.parse(data);
  }

  // Select a club as active
  async selectClub(clubId: string): Promise<{ token: string; user: User }> {
    const response = await this.request('/auth/select-club', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clubId }),
    }) as Response;

    if (!response.ok) {
      const error = await response.json() as { error?: string };
      throw new Error(error.error || 'Failed to select club');
    }

    const data = await response.json() as unknown;
    return selectClubResponseSchema.parse(data);
  }
}

export const authService = new AuthService();
