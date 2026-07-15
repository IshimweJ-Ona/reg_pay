"use client";

import { useAuth } from '@/context/auth-context';
import React from 'react';

interface PermissionGateProps {
  permission: string;
  children: React.ReactNode;
  fallback?: React.ReactNode; // default null: unauthorized content is removed from the DOM.
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { hasPermission, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  // No permission means no rendered element by default, not a disabled placeholder.
  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
