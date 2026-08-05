"use client";

import { useAttendanceSync } from '@/context/attendance-sync-context';
import { Progress } from '@/components/ui/progress';
import { Loading02, CheckCircle } from '@untitledui/icons';
import { cn } from '@/lib/utils';

export function AttendanceSyncPopover() {
  const { syncState } = useAttendanceSync();

  if (!syncState.isSyncing && syncState.progress !== 100) {
    return null;
  }

  const isComplete = syncState.progress === 100;

  return (
    <div className={cn(
      "fixed bottom-6 right-6 w-80 bg-card border rounded-2xl shadow-2xl p-4 transition-all duration-500 z-[100]",
      "animate-in slide-in-from-bottom-10"
    )}>
      <div className="flex items-center gap-3 mb-3">
        {isComplete ? (
          <CheckCircle className="h-5 w-5 text-success" size={20} />
        ) : (
          <Loading02 className="h-5 w-5 text-primary animate-spin" size={20} />
        )}
        <span className="font-bold text-sm">
          {isComplete ? 'Attendance sync complete!' : 'Syncing attendance…'}
        </span>
      </div>
      
      {!isComplete && (
        <p className="text-xs text-muted-foreground mb-3">
          Please do not refresh. You can continue to navigate.
        </p>
      )}
      
      <Progress value={syncState.progress} className="h-2 mb-1" />
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground font-bold">{syncState.progress}% complete</span>
        {!isComplete && (
          <span className="text-[10px] text-muted-foreground font-bold animate-pulse">Processing batch...</span>
        )}
      </div>
    </div>
  );
}
