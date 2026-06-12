
"use client";

import { AuthProvider, useAuth, isAdminRole } from '@/context/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { SectionErrorBoundary } from '@/components/layout/section-error-boundary';
import { cn } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      // Security check: Ensure the UUID in the URL matches the logged in user
      if (user.uuid !== params.uuid) {
        // Redirect to their own dashboard if they try to access another UUID
        const rolePath = isAdminRole(user.role) ? 'super_admin' : 'users'; // Simplified for now
        router.push(`/${rolePath}/${user.uuid}`);
      }
    }
  }, [user, isLoading, router, params.uuid]);

  if (isLoading || !user) {
    return null;
  }

  const isManagement = isAdminRole(user.role);

  return (
    <ProtectedRoute>
      <div className={cn(
        "flex h-screen overflow-hidden",
        isManagement ? "bg-pearl-fog" : "bg-secondary/5"
      )}>
        <Sidebar type={isManagement ? "admin" : "user"} />
        <main className="flex-1 overflow-y-auto p-8 relative">
          <SectionErrorBoundary>
            {children}
          </SectionErrorBoundary>
        </main>
      </div>
    </ProtectedRoute>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AuthProvider>
  );
}
