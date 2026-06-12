"use client";

import React, { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { useAttendanceSync } from '@/context/attendance-sync-context';

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function SessionManager({ children }: { children: React.ReactNode }) {
  const { logout, user } = useAuth();
  const { syncState } = useAttendanceSync();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    if (!user || syncState.isSyncing) {
      return;
    }

    timerRef.current = setTimeout(() => {
      logout();
    }, INACTIVITY_TIMEOUT);
  }, [logout, user, syncState.isSyncing]);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleEvent = () => resetTimer();

    if (user && !syncState.isSyncing) {
      events.forEach(event => window.addEventListener(event, handleEvent));
      resetTimer();
    }

    return () => {
      events.forEach(event => window.removeEventListener(event, handleEvent));
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [user, syncState.isSyncing, resetTimer]);

  return <>{children}</>;
}
