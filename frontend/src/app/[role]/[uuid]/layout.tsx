
"use client";

import { AuthProvider, useAuth, isAdminRole } from '@/context/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { SectionErrorBoundary } from '@/components/layout/section-error-boundary';
import { cn } from '@/lib/utils';
import { ProtectedRoute } from '@/components/auth/protected-route';

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
  }, [isLoading, user]);

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
    return null;
  }

  const isManagement = hasPermission('employees.read') || hasPermission('payroll.read') || hasPermission('users.read') || hasPermission('attendance.read');

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
