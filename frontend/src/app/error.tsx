"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/layout/page-state";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route failed:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <ErrorState
        title="This page failed to load"
        description="Other pages are still available. Try reloading this page or go back to another module."
        action={<Button onClick={reset}>Try again</Button>}
        className="w-full max-w-md"
      />
    </div>
  );
}
