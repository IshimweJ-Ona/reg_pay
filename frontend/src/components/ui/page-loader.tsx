
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function PageLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const isMajorChange = (prev: string | null, curr: string) => {
      if (!prev) return true;
      const getArea = (p: string) => p.split('/')[1];
      return getArea(prev) !== getArea(curr);
    };

    const prevPath = sessionStorage.getItem("last_path");
    const currentPath = pathname;

    if (!isMajorChange(prevPath, currentPath)) {
      setVisible(false);
      sessionStorage.setItem("last_path", currentPath);
      return;
    }

    sessionStorage.setItem("last_path", currentPath);

    let timers: ReturnType<typeof setTimeout>[] = [];
    let hide: ReturnType<typeof setTimeout> | undefined;

    const runLoader = () => {
      setVisible(true);
      setProgress(0);
      timers.forEach(clearTimeout);
      if (hide) clearTimeout(hide);

      const steps = [20, 45, 70, 88, 100];
      timers = steps.map((val, i) =>
        setTimeout(() => setProgress(val), i * 100 + 50)
      );

      hide = setTimeout(() => setVisible(false), 1000);
    };

    runLoader();

    window.addEventListener("popstate", runLoader);
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) runLoader();
    };
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      timers.forEach(clearTimeout);
      if (hide) clearTimeout(hide);
      window.removeEventListener("popstate", runLoader);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-5 rounded-lg border border-border bg-white p-3 shadow-sm">
          <Image src="/pics/reg-logo.png" alt="REG Logo" width={48} height={48} className="h-12 w-12 object-contain" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            REG Pay
          </h1>
          <p className="mt-2 text-xs font-medium uppercase text-muted-foreground">
            Secure payroll workspace
          </p>
        </div>
      </div>

      <div className="mb-4 h-1 w-56 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="text-xs font-medium text-muted-foreground" role="status" aria-live="polite">
        Loading latest access and payroll data
      </div>
    </div>
  );
}
