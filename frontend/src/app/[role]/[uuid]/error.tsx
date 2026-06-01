"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function AdminAreaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const role = params.role as string;
  const uuid = params.uuid as string;
  const basePath = `/${role}/${uuid}`;

  useEffect(() => {
    console.error("Admin route failed:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
        <h2 className="text-xl font-bold">Area unavailable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This module hit an error, but the rest of the dashboard remains
          isolated and usable.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Button variant="outline" asChild>
            <Link href={basePath}>Dashboard</Link>
          </Button>
          <Button onClick={reset}>Try again</Button>
        </div>
      </div>
    </div>
  );
}
