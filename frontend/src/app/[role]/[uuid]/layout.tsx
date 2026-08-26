
"use client";

import { AuthProvider, useAuth } from '@/context/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { SectionErrorBoundary } from '@/components/layout/section-error-boundary';
import { cn } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { LoadingState } from '@/components/layout/page-state';

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading, refreshPermissions, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && user) {
      refreshPermissions();
    }
  }, [pathname, isLoading]);

  useEffect(() => {
    if (isLoading || !user) return;
    const interval = setInterval(() => {
      refreshPermissions();
    }, 15000);
    return () => clearInterval(interval);
    // Keyed on user?.id, not the whole user object: refreshPermissions()
    // itself calls setUser() with a new reference every tick, which would
    // otherwise tear down and restart this interval on every single poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user?.id]);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      // Security check: Ensure the UUID in the URL matches the logged in user
      if (user.uuid !== params.uuid) {
        // Redirect to their own dashboard if they try to access another UUID
        let rolePath = 'users';
        if (user.roles?.includes('SUPER_ADMIN')) {
          rolePath = 'super_admin';
        } else if (user.roles?.includes('BRANCH_MANAGER')) {
          rolePath = 'branch_manager';
        } else if (user.roles?.some(r => ['HR', 'HR_MANAGER', 'HR_ADMIN'].includes(r))) {
          rolePath = 'hr';
        } else if (user.roles?.some(r => ['ACCOUNTANT', 'FINANCE'].includes(r))) {
          rolePath = 'finance';
        } else if (user.roles?.includes('ATTENDANT')) {
          rolePath = 'attendant';
        }
        
        router.push(`/${rolePath}/${user.uuid}`);
      }
    }
  }, [user, isLoading, router, params.uuid]);

  if (isLoading || !user) {
    return (
      <LoadingState
        title="Loading secure workspace"
        description="Checking your session and role-specific navigation."
        className="min-h-screen rounded-none border-0"
      />
    );
  }

  const isManagement = hasPermission('employees.read') || hasPermission('payroll.read') || hasPermission('users.read') || hasPermission('attendance.read');

  return (
    <ProtectedRoute>
      <div className={cn(
        "flex min-h-screen flex-col overflow-hidden lg:h-screen lg:flex-row",
        isManagement ? "bg-pearl-fog" : "bg-secondary/5"
      )}>
        <Sidebar type={isManagement ? "admin" : "user"} />
        <main className="relative flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
