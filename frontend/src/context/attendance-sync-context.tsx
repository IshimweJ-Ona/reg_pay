"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { bulkCreateTimeRecords } from '@/api/attendance';

interface SyncState {
  isSyncing: boolean;
  progress: number;
  sessionId: string;
  startedAt: string;
}

interface AttendanceSyncContextType {
  syncState: SyncState;
  startSync: (logs: any[]) => Promise<void>;
  pendingSync: Record<string, any>;
  setPendingSync: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

const AttendanceSyncContext = createContext<AttendanceSyncContextType | undefined>(undefined);

export function AttendanceSyncProvider({ children }: { children: React.ReactNode }) {
  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    progress: 0,
    sessionId: '',
    startedAt: '',
  });
  const [pendingSync, setPendingSync] = useState<Record<string, any>>({});
  const { toast } = useToast();

  // Load pending sync from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('attendance_pending_sync');
    if (saved) {
      try {
        setPendingSync(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse pending sync', e);
      }
    }
  }, []);

  // Save pending sync to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('attendance_pending_sync', JSON.stringify(pendingSync));
  }, [pendingSync]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (syncState.isSyncing) {
        e.preventDefault();
        e.returnValue = 'Attendance sync is in progress. If you refresh, attendance will have to restart. Please wait for sync to complete.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncState.isSyncing]);

  const startSync = useCallback(async (logs: any[]) => {
    if (logs.length === 0) return;

    const sessionId = Math.random().toString(36).substring(7);
    setSyncState({
      isSyncing: true,
      progress: 0,
      sessionId,
      startedAt: new Date().toISOString(),
    });

    let interval: any;
    try {
      // Simulate progress for UI feedback since we use a single batch call
      interval = setInterval(() => {
        setSyncState(prev => {
          if (prev.progress >= 90) {
            clearInterval(interval);
            return prev;
          }
          return { ...prev, progress: prev.progress + 10 };
        });
      }, 500);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        toast({ 
          variant: 'destructive', 
          title: 'Sync Timeout', 
          description: 'Sync is taking longer than expected. Retrying is allowed.' 
        });
        controller.abort();
      }, 60000);

      const warningTimeoutId = setTimeout(() => {
        toast({ 
          title: 'Sync Warning', 
          description: 'Sync is taking longer than expected…' 
        });
      }, 45000);

      await bulkCreateTimeRecords(logs, controller.signal);
      
      clearTimeout(timeoutId);
      clearTimeout(warningTimeoutId);
      clearInterval(interval);
      setSyncState(prev => ({ ...prev, progress: 100 }));
      
      setTimeout(() => {
        setSyncState({
          isSyncing: false,
          progress: 0,
          sessionId: '',
          startedAt: '',
        });
        toast({ title: ' Attendance sync complete!', description: 'All records have been saved.' });
      }, 5000);

    } catch (error: any) {
      clearInterval(interval);
      setSyncState({
        isSyncing: false,
        progress: 0,
        sessionId: '',
        startedAt: '',
      });

      if (error.name === 'AbortError') {
        toast({ 
          variant: 'destructive', 
          title: 'Sync Aborted', 
          description: 'Sync took longer than 60 seconds and was aborted.' 
        });
      } else {
        toast({ 
          variant: 'destructive', 
          title: 'Sync failed', 
          description: 'There was an error syncing attendance records.' 
        });
      }
    }
  }, [toast]);

  return (
    <AttendanceSyncContext.Provider value={{ syncState, startSync, pendingSync, setPendingSync }}>
      {children}
    </AttendanceSyncContext.Provider>
  );
}

export function useAttendanceSync() {
  const context = useContext(AttendanceSyncContext);
  if (context === undefined) {
    throw new Error('useAttendanceSync must be used within an AttendanceSyncProvider');
  }
  return context;
}
