import React from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-secondary/5 px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl border max-w-md w-full text-center">
        <div className="bg-destructive/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-8">
          You do not have the necessary permissions to access this page. Please contact your administrator if you believe this is an error.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild className="w-full">
            <Link href="/">Return to Dashboard</Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/auth/login">Sign in with a different account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
