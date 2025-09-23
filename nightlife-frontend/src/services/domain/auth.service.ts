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
  details?: any;
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

import { ApiService } from '../shared/api.service';

class AuthService extends ApiService {
  constructor() {
    super();
  }

  // Login
  async login(email: string, password: string): Promise<LoginResponse> {
    return this.post<LoginResponse>('/auth/login', { email, password });
  }

  // Register
  async register(email: string, password: string): Promise<RegisterResponse> {
    return this.post<RegisterResponse>('/auth/register', { email, password });
  }

  // Logout
  async logout(): Promise<{ message: string }> {
    return this.post<{ message: string }>('/auth/logout');
  }

  // Forgot password
  async forgotPassword(email: string): Promise<{ message: string }> {
    console.log('📤 [AUTH_SERVICE] Calling forgot password API for:', email);
    try {
      const response = await this.post<{ message: string }>('/auth/forgot-password', { email });
      console.log('✅ [AUTH_SERVICE] Forgot password API call successful:', response);
      return response;
    } catch (error) {
      console.error('❌ [AUTH_SERVICE] Forgot password API call failed:', error);
      throw error;
    }
  }

  // Reset password
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return this.post<{ message: string }>('/auth/reset-password', { token, newPassword });
  }

  // Change password
  async changePassword(oldPassword: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    return this.post<{ message: string }>('/auth/change-password', { 
      oldPassword, 
      newPassword, 
      confirmPassword 
    });
  }

  // Get current user
  async getCurrentUser(): Promise<User> {
    return this.get<User>('/auth/me');
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
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch available clubs');
    }

    return response.json();
  }

  // Select a club as active
  async selectClub(clubId: string): Promise<{ token: string; user: User }> {
    const response = await this.request('/auth/select-club', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clubId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to select club');
    }

    return response.json();
  }
}

export const authService = new AuthService();
