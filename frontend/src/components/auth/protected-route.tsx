"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredPermission?: string;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  requiredPermission,
}: ProtectedRouteProps) {
  const { user, isLoading, hasPermission } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const roles = user.roles ?? [];
      const hasRequiredRole = requiredRoles
        ? requiredRoles.some((role) => roles.includes(role))
        : true;

      const hasRequiredPermission = requiredPermission
        ? hasPermission(requiredPermission)
        : true;

      if (!hasRequiredRole || !hasRequiredPermission) {
        router.push('/unauthorized');
      }
    }
  }, [user, isLoading, router, requiredRoles, requiredPermission, hasPermission]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const roles = user.roles ?? [];
  const hasRequiredRole = requiredRoles
    ? requiredRoles.some((role) => roles.includes(role))
    : true;

  const hasRequiredPermission = requiredPermission
    ? hasPermission(requiredPermission)
    : true;

  if (!hasRequiredRole || !hasRequiredPermission) {
    return null;
  }

  return <>{children}</>;
}
