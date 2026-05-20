
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Check, Clock, AlertCircle } from 'lucide-react';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { approveUser, rejectUser, approveUserTransfer, rejectUserTransfer } from '@/api/users';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead, Notification } from '@/api/notifications';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';

export function NotificationBell({ type }: { type: 'admin' | 'user' }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleApproveRegistration = async (notificationUuid: string, userUuid: string) => {
    try {
      await approveUser(userUuid, {});
      await markAsRead(notificationUuid);
      toast({ title: "Account approved", description: "The user can now sign in with assigned access." });
      await loadNotifications();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Approval failed",
        description: error?.response?.data?.message ?? "Check roles and permissions.",
      });
    }
  };

  const handleDenyRegistration = async (notificationUuid: string, userUuid: string) => {
    try {
      await rejectUser(userUuid, "Denied by administrator from notifications.");
      await markAsRead(notificationUuid);
      toast({ variant: "destructive", title: "Account denied", description: "The user was soft deleted." });
      await loadNotifications();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Denial failed",
        description: error?.response?.data?.message ?? "Please try again.",
      });
    }
  };

  const handleApproveTransfer = async (notificationUuid: string, transferUuid: string) => {
    try {
      await approveUserTransfer(transferUuid);
      await markAsRead(notificationUuid);
      toast({ title: "Transfer Approved", description: "The request has moved to the next level or finalized." });
      await loadNotifications();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Transfer approval failed",
        description: error?.response?.data?.message ?? "Please try again.",
      });
    }
  };

  const handleDenyTransfer = async (notificationUuid: string, transferUuid: string) => {
    try {
      await rejectUserTransfer(transferUuid, "Rejected via notifications.");
      await markAsRead(notificationUuid);
      toast({ variant: "destructive", title: "Transfer Rejected", description: "The request has been returned to the requestor." });
      await loadNotifications();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Transfer rejection failed",
        description: error?.response?.data?.message ?? "Please try again.",
      });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      setUnreadCount(0);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleMarkRead = async (uuid: string) => {
    try {
      await markAsRead(uuid);
      await loadNotifications();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl bg-white border shadow-sm hover:bg-secondary/50 transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white border-2 border-white shadow-sm">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96 p-0 border-none shadow-2xl animate-in fade-in zoom-in-95">
        <DropdownMenuLabel className="p-4 flex items-center justify-between bg-secondary/20">
          <span className="text-sm font-headline font-bold uppercase tracking-wider text-muted-foreground">
            {type === 'admin' ? 'System Notifications' : 'My Notifications'}
          </span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-primary hover:text-primary/80" onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="h-[400px]">
          <div className="flex flex-col">
            {notifications.length > 0 ? notifications.map((n) => (
              <div key={n.uuid} className={`p-4 border-b last:border-0 relative group transition-colors ${n.is_read ? 'bg-white opacity-80' : 'bg-blue-50/30'}`}>
                <div className="flex gap-4">
                  <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${
                    n.type === 'REGISTRATION_REQUEST' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {n.type === 'REGISTRATION_REQUEST' ? <AlertCircle className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  </div>
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-bold text-xs truncate group-hover:text-primary transition-colors">{n.title}</p>
                      {!n.is_read && <div className="h-2 w-2 rounded-full bg-red-600" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{n.message}</p>
                    
                    {n.type === 'REGISTRATION_REQUEST' && n.user && (
                      <div className="mt-2 p-2 bg-white/50 rounded-lg border border-slate-100 text-[10px] space-y-1">
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-500">Name:</span>
                          <span>{n.user.first_name} {n.user.last_name}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-500">Email:</span>
                          <span>{n.user.email}</span>
                        </div>
                        <div className="flex justify-between font-medium">
                          <span className="text-slate-500">Phone:</span>
                          <span>{n.user.phone_number}</span>
                        </div>
                        {n.user.working_location && (
                          <div className="flex justify-between font-medium">
                            <span className="text-slate-500">Location:</span>
                            <span>{n.user.working_location.name}</span>
                          </div>
                        )}
                        {n.user.department && (
                          <div className="flex justify-between font-medium">
                            <span className="text-slate-500">Dept:</span>
                            <span>{n.user.department.name}</span>
                          </div>
                        )}
                        
                        {!n.is_read && n.reference_id && (
                          <div className="mt-3 flex gap-2 pt-2 border-t border-slate-100">
                            <Button size="sm" className="h-7 flex-1 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(n.uuid, n.reference_id!)}>
                              <Check className="h-3 w-3 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 flex-1 px-2 text-[10px] text-destructive hover:bg-destructive/5" onClick={() => handleDeny(n.uuid, n.reference_id!)}>
                              Deny
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                        {new Date(n.created_at).toLocaleString()}
                      </span>
                      {!n.is_read && (
                        <button onClick={() => handleMarkRead(n.uuid)} className="text-[9px] text-primary hover:underline font-bold">
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center text-muted-foreground text-xs italic">
                No new communications.
              </div>
            )}
          </div>
        </ScrollArea>
        <DropdownMenuSeparator className="m-0" />
        <div className="p-2 bg-secondary/10">
          <Button variant="ghost" className="w-full text-[10px] font-bold h-8 uppercase tracking-widest">
            View All History
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
