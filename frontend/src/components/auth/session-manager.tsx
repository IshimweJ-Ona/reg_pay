"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function SessionManager({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!user) {
      return;
    }

    timerRef.current = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT);
  }, [logout, user]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    const handleEvent = () => resetTimer();

    if (user) {
      events.forEach(event => window.addEventListener(event, handleEvent));
      resetTimer();
    }

    return () => {
      events.forEach(event => window.removeEventListener(event, handleEvent));
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [user, resetTimer]);

  return <>{children}</>;
}
