import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PermissionDeniedState } from '@/components/layout/page-state';

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-secondary/5 px-4">
      <PermissionDeniedState
        title="Access denied"
        description="Your current role does not include this page. Contact an administrator if this access should be added."
        className="w-full max-w-md"
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="w-full">
            <Link href="/">Return to Dashboard</Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/auth/login">Sign in with a different account</Link>
          </Button>
          </div>
        }
      />
    </main>
  );
}
