'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'user' | 'clubowner' | 'waiter' | 'bouncer' | 'admin';
  requiredRoles?: ('user' | 'clubowner' | 'waiter' | 'bouncer' | 'admin')[];
  redirectTo?: string;
}

export default function ProtectedRoute({
  children,
  requiredRole,
  requiredRoles,
  redirectTo = '/auth/login',
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      // Still loading, don't redirect yet
      return;
    }

    if (!isAuthenticated) {
      router.push(redirectTo);
      return;
    }

    // Check role requirements
    if (requiredRole && user?.role !== requiredRole) {
      router.push('/dashboard');
      return;
    }

    if (requiredRoles && user && !requiredRoles.includes(user.role)) {
      router.push('/dashboard');
      return;
    }
  }, [isAuthenticated, isLoading, user, requiredRole, requiredRoles, redirectTo, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Don't render children if not authenticated or role doesn't match
  if (!isAuthenticated) {
    return null;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return null;
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}

// Convenience components for specific roles
export function AdminRoute({ children, redirectTo }: Omit<ProtectedRouteProps, 'requiredRole' | 'requiredRoles'>) {
  return (
    <ProtectedRoute requiredRole="admin" redirectTo={redirectTo}>
      {children}
    </ProtectedRoute>
  );
}

export function ClubOwnerRoute({ children, redirectTo }: Omit<ProtectedRouteProps, 'requiredRole' | 'requiredRoles'>) {
  return (
    <ProtectedRoute requiredRole="clubowner" redirectTo={redirectTo}>
      {children}
    </ProtectedRoute>
  );
}

export function StaffRoute({ children, redirectTo }: Omit<ProtectedRouteProps, 'requiredRole' | 'requiredRoles'>) {
  return (
    <ProtectedRoute requiredRoles={['bouncer', 'waiter']} redirectTo={redirectTo}>
      {children}
    </ProtectedRoute>
  );
}

export function ClubAccessRoute({ children, redirectTo }: Omit<ProtectedRouteProps, 'requiredRole' | 'requiredRoles'>) {
  return (
    <ProtectedRoute requiredRoles={['clubowner', 'bouncer', 'waiter']} redirectTo={redirectTo}>
      {children}
    </ProtectedRoute>
  );
}
