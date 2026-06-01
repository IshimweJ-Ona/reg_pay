
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
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
        "fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#040a15] transition-opacity duration-500",
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      )}
    >
      <div className="flex flex-col items-center mb-8 animate-in fade-in zoom-in duration-500">
        <div className="bg-primary p-4 rounded-2xl shadow-2xl shadow-primary/20 mb-6">
          <ShieldCheck className="h-12 w-12 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-4xl font-headline font-bold tracking-[0.2em] text-white">
            REG <span className="text-primary"></span>
          </h1>
          <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-white/40 font-bold font-body">
            Enterprise Payment Systems
          </p>
        </div>
      </div>

      <div className="w-48 h-1 bg-white/5 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="text-[9px] uppercase tracking-[0.4em] text-white/30 font-bold animate-pulse">
        System Initializing
      </div>
    </div>
  );
}
