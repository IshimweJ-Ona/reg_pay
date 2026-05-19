
"use client";

import { AuthProvider, useAuth } from '@/context/auth-context';
import { Sidebar } from '@/components/layout/sidebar';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function UserLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return null; // Let the global PageLoader handle the visual
  }

  return (
    <div className="flex h-screen bg-secondary/5 overflow-hidden">
      <Sidebar type="user" />
      <main className="flex-1 overflow-y-auto p-8 relative">
        {children}
      </main>
    </div>
  );
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <UserLayoutContent>{children}</UserLayoutContent>
    </AuthProvider>
  );
}
