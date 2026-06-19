
"use client";

import React, { useEffect, useState } from 'react';
import { Bell, Check, AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getNotifications, markAsRead, markAllAsRead, Notification } from '@/api/notifications';
import { approveUser, rejectUser } from '@/api/users';
import { approvePayrollBatch, rejectPayrollBatch } from '@/api/payroll';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const loadNotifications = async () => {
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleApproveRegistration = async (nUuid: string, uUuid: string) => {
    try {
      await approveUser(uUuid, {});
      await markAsRead(nUuid);
      toast({ title: "Account approved", description: "The user now has system access." });
      await loadNotifications();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Approval failed", description: error?.response?.data?.message });
    }
  };

  const handleDenyRegistration = async (nUuid: string, uUuid: string) => {
    try {
      await rejectUser(uUuid, "Denied from notifications page.");
      await markAsRead(nUuid);
      toast({ variant: "destructive", title: "Account denied" });
      await loadNotifications();
    } catch {
      toast({ variant: "destructive", title: "Denial failed" });
    }
  };

  const handleApprovePayroll = async (nUuid: string, bUuid: string) => {
    try {
      await approvePayrollBatch(bUuid, "Approved from notifications page.");
      await markAsRead(nUuid);
      toast({ title: "Payroll approved" });
      await loadNotifications();
    } catch {
      toast({ variant: "destructive", title: "Approval failed" });
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    await loadNotifications();
  };

  const filtered = notifications.filter(n => 
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Notification Center</h1>
          <p className="text-muted-foreground">Detailed history of all system alerts and required actions.</p>
        </div>
        <Button variant="outline" onClick={handleMarkAllRead}>Mark all as read</Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search notifications..." 
            className="pl-10 h-11 bg-white border-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.length > 0 ? filtered.map((n) => (
          <Card key={n.uuid} className={`border-none shadow-sm overflow-hidden ${!n.is_read ? 'bg-blue-50/30 ring-1 ring-blue-100' : 'bg-white'}`}>
            <CardContent className="p-6">
              <div className="flex gap-6">
                <div className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center ${
                  n.type === 'REGISTRATION_REQUEST' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {n.type === 'REGISTRATION_REQUEST' ? <AlertCircle className="h-6 w-6" /> : <Bell className="h-6 w-6" />}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <h3 className="font-bold text-lg">{n.title}</h3>
                      {!n.is_read && <Badge className="bg-blue-600">New</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{n.message}</p>
                  
                  {n.type === 'REGISTRATION_REQUEST' && n.user && (
                    <div className="mt-4 p-4 bg-secondary/20 rounded-xl border border-secondary border-dashed grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div className="space-y-1">
                        <p className="text-muted-foreground uppercase tracking-wider font-bold text-[10px]">Candidate</p>
                        <p className="font-bold">{n.user.first_name} {n.user.last_name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground uppercase tracking-wider font-bold text-[10px]">Contact</p>
                        <p className="font-bold">{n.user.email}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground uppercase tracking-wider font-bold text-[10px]">Location</p>
                        <p className="font-bold">{n.user.working_location?.name || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground uppercase tracking-wider font-bold text-[10px]">Department</p>
                        <p className="font-bold">{n.user.department?.name || 'N/A'}</p>
                      </div>
                    </div>
                  )}

                  {!n.is_read && n.reference_id && (
                    <div className="flex gap-3 pt-2">
                      {n.type === 'REGISTRATION_REQUEST' && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApproveRegistration(n.uuid, n.reference_id!)}>
                            <Check className="h-4 w-4 mr-2" /> Approve Access
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/5" onClick={() => handleDenyRegistration(n.uuid, n.reference_id!)}>
                            Deny Request
                          </Button>
                        </>
                      )}
                      {n.type === 'PAYROLL_APPROVAL_REQUEST' && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprovePayroll(n.uuid, n.reference_id!)}>
                            <Check className="h-4 w-4 mr-2" /> Approve Batch
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/5" onClick={() => rejectPayrollBatch(n.reference_id!, "Rejected from notifications").then(loadNotifications)}>
                            Reject Batch
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )) : (
          <div className="py-20 text-center text-muted-foreground italic bg-white rounded-2xl border">
            No notifications found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}
