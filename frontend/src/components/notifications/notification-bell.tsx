
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Check, Clock, AlertCircle } from 'lucide-react';
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, 
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { approveUser, getPendingUsers, rejectUser } from '@/api/users';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'info' | 'success' | 'alert';
  icon: any;
}

export function NotificationBell({ type }: { type: 'admin' | 'user' }) {
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  const loadPendingUsers = async () => {
    if (type !== 'admin') return;
    try {
      const users = await getPendingUsers();
      setPendingUsers(users);
      setUnreadCount(users.length);
    } catch {
      setPendingUsers([]);
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadPendingUsers();
  }, [type]);
  
  const notifications = useMemo(() => {
    if (type !== 'admin') return [];
    return pendingUsers.map((user) => ({
      id: user.uuid,
      title: 'Account Approval',
      desc: `${user.first_name} ${user.last_name} registered with ${user.email}.`,
      time: new Date(user.created_at).toLocaleString(),
      type: 'alert' as const,
      icon: AlertCircle,
      user,
    }));
  }, [pendingUsers, type]);

  const handleApprove = async (uuid: string) => {
    try {
      await approveUser(uuid, {});
      toast({ title: "Account approved", description: "The user can now sign in with assigned access." });
      await loadPendingUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Approval failed",
        description: error?.response?.data?.message ?? "Check roles, departments, and permissions setup.",
      });
    }
  };

  const handleDeny = async (uuid: string) => {
    try {
      await rejectUser(uuid, "Denied by administrator from notifications.");
      toast({ variant: "destructive", title: "Account denied", description: "The user was soft deleted and access revoked." });
      await loadPendingUsers();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Denial failed",
        description: error?.response?.data?.message ?? "Please try again.",
      });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl bg-white border shadow-sm hover:bg-secondary/50 transition-colors">
          <Bell className="h-5 w-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white border-2 border-white shadow-sm">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 border-none shadow-2xl animate-in fade-in zoom-in-95">
        <DropdownMenuLabel className="p-4 flex items-center justify-between bg-secondary/20">
          <span className="text-sm font-headline font-bold uppercase tracking-wider text-muted-foreground">
            {type === 'admin' ? 'System Audit Log' : 'Employee Notifications'}
          </span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 text-primary hover:text-primary/80" onClick={() => setUnreadCount(0)}>
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="m-0" />
        <ScrollArea className="h-80">
          <div className="flex flex-col">
            {notifications.length > 0 ? notifications.map((n: any) => (
              <DropdownMenuItem key={n.id} className="p-4 focus:bg-secondary/50 cursor-pointer border-b last:border-0 rounded-none group">
                <div className="flex gap-4">
                  <div className={`h-10 w-10 shrink-0 rounded-full flex items-center justify-center ${
                    n.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 
                    n.type === 'alert' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <n.icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <p className="font-bold text-xs truncate group-hover:text-primary transition-colors">{n.title}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{n.desc}</p>
                    <span className="text-[9px] font-bold text-muted-foreground/60 mt-1 uppercase tracking-widest">{n.time}</span>
                    {type === 'admin' && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" className="h-7 px-2 text-[10px]" onClick={(event) => { event.preventDefault(); handleApprove(n.id); }}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] text-destructive" onClick={(event) => { event.preventDefault(); handleDeny(n.id); }}>
                          Deny
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
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
            View Archive
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
