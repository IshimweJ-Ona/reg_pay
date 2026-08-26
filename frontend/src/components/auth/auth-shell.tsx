"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";

interface AuthShellProps {
  illustration: string;
  illustrationAlt: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthShell({ illustration, illustrationAlt, title, subtitle, children }: AuthShellProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex relative flex-col items-center justify-center bg-accent px-12 py-16 overflow-hidden">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="relative z-10 flex flex-col items-center text-center max-w-sm"
        >
          <div className="bg-white p-2 rounded-lg shadow-sm mb-8">
            <Image src="/pics/reg-logo.png" alt="REG Logo" width={48} height={48} className="h-12 w-12 object-contain" />
          </div>
          <Image
            src={illustration}
            alt={illustrationAlt}
            width={320}
            height={320}
            className="w-full max-w-[280px] h-auto mb-8"
            priority
          />
          <h2 className="font-headline text-2xl font-semibold text-accent-foreground mb-3">{title}</h2>
          <p className="text-accent-foreground/70 leading-relaxed">{subtitle}</p>
        </motion.div>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="md:hidden flex flex-col items-center mb-8">
          <div className="bg-white p-2 rounded-lg shadow-sm border border-border mb-4">
            <Image src="/pics/reg-logo.png" alt="REG Logo" width={48} height={48} className="h-12 w-12 object-contain" />
          </div>
          <h1 className="font-headline text-xl font-bold text-foreground">REG Payment System</h1>
        </div>
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
