
"use client";

import { AuthProvider, useAuth } from '@/context/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && (!user || !['SUPER_ADMIN', 'ADMIN', 'HR_ADMIN'].includes(user.role))) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null; // Let the global PageLoader handle the initial visual
  }

  return (
    <div className="flex h-screen bg-pearl-fog overflow-hidden">
      <Sidebar type="admin" />
      <main className="flex-1 overflow-y-auto p-8 relative">
        {children}
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </AuthProvider>
  );
}
