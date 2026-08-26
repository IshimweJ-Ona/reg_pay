"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { LoadingState, PermissionDeniedState } from '@/components/layout/page-state';

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
      <div className="min-h-screen bg-background p-6">
        <LoadingState
          title="Loading secure workspace"
          description="Checking your session, role, and current permissions."
          className="min-h-[70vh]"
        />
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
    return (
      <div className="min-h-screen bg-background p-6">
        <PermissionDeniedState
          title="Access needs approval"
          description="Your current role does not include the permission required for this page."
          className="min-h-[70vh]"
        />
      </div>
    );
  }

  return <>{children}</>;
}
