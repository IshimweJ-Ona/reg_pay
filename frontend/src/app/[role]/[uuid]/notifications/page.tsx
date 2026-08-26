"use client";

import { useEffect, useState } from 'react';
import { Check, SearchMd } from '@untitledui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { getNotifications, markAsRead, markAllAsRead, clearNotification, clearAllNotifications, Notification } from '@/api/notifications';
import { approveUser, rejectUser, approveUserTransfer, rejectUserTransfer } from '@/api/users';
import { approvePayrollBatch, rejectPayrollBatch } from '@/api/payroll';
import { approveEmployeeTransfer, rejectEmployeeTransfer } from '@/api/employees';
import { userFriendlyError } from '@/lib/error-message';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, ErrorState, LoadingState } from '@/components/layout/page-state';
import { getNotificationVisual } from '@/lib/notification-visual';

function renderNotificationText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const v = value as { key?: string; name?: string };
    return v.name ?? v.key ?? JSON.stringify(value);
  }
  return String(value ?? '');
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [notificationsPage, setNotificationsPage] = useState(1);
  const NOTIFICATIONS_PAGE_SIZE = 20;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadNotifications = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getNotifications();
      setNotifications(data);
    } catch (error) {
      setNotifications([]);
      setLoadError(userFriendlyError(error, "Could not load notifications."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    window.addEventListener('notifications_updated', loadNotifications);
    return () => window.removeEventListener('notifications_updated', loadNotifications);
  }, []);

  const handleApproveRegistration = async (nUuid: string, uUuid: string) => {
    try {
      await approveUser(uUuid, {});
      await markAsRead(nUuid);
      toast({ title: "Account approved", description: "The user now has system access." });
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Approval failed", description: error?.response?.data?.message });
    }
  };

  const handleDenyRegistration = async (nUuid: string, uUuid: string) => {
    try {
      await rejectUser(uUuid, "Denied from notifications page.");
      await markAsRead(nUuid);
      toast({ variant: "destructive", title: "Account denied" });
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch {
      toast({ variant: "destructive", title: "Denial failed" });
    }
  };

  const handleApprovePayroll = async (nUuid: string, bUuid: string) => {
    try {
      await approvePayrollBatch(bUuid, "Approved from notifications page.");
      await markAsRead(nUuid);
      toast({ title: "Payroll approved" });
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch {
      toast({ variant: "destructive", title: "Approval failed" });
    }
  };

  const handleApproveTransfer = async (nUuid: string, transferUuid: string, title: string) => {
    try {
      const isEmployee = title.toLowerCase().includes('employee');
      if (isEmployee) {
        await approveEmployeeTransfer(transferUuid);
      } else {
        await approveUserTransfer(transferUuid);
      }
      await markAsRead(nUuid);
      toast({ title: "Transfer Approved", description: "The request has moved to the next level or finalized." });
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch (error: any) {
      toast({ variant: "destructive", title: "Transfer approval failed", description: error?.response?.data?.message });
    }
  };

  const handleDenyTransfer = async (nUuid: string, transferUuid: string, title: string) => {
    try {
      const isEmployee = title.toLowerCase().includes('employee');
      if (isEmployee) {
        await rejectEmployeeTransfer(transferUuid, "Denied from notifications page.");
      } else {
        await rejectUserTransfer(transferUuid, "Denied from notifications page.");
      }
      await markAsRead(nUuid);
      toast({ variant: "destructive", title: "Transfer Rejected" });
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch {
      toast({ variant: "destructive", title: "Transfer rejection failed" });
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    window.dispatchEvent(new CustomEvent('notifications_updated'));
  };

  const handleClear = async (uuid: string) => {
    try {
      await clearNotification(uuid);
      setNotifications((prev) => prev.filter((n) => n.uuid !== uuid));
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to clear notification",
        description: userFriendlyError(error, "Please try again."),
      });
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllNotifications();
      setNotifications([]);
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to clear notifications",
        description: userFriendlyError(error, "Please try again."),
      });
    }
  };

  const filtered = notifications.filter(n =>
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.message.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const notificationsTotalPages = Math.max(1, Math.ceil(filtered.length / NOTIFICATIONS_PAGE_SIZE));
  const paginatedNotifications = filtered.slice(
    (notificationsPage - 1) * NOTIFICATIONS_PAGE_SIZE,
    notificationsPage * NOTIFICATIONS_PAGE_SIZE,
  );

  useEffect(() => {
    setNotificationsPage(1);
  }, [searchTerm]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification Center"
        description="Detailed history of all system alerts and required actions."
        actions={
          <>
            <Button variant="outline" onClick={handleMarkAllRead} disabled={notifications.length === 0}>Mark all as read</Button>
            <Button variant="outline" className="text-destructive hover:bg-destructive/5" onClick={handleClearAll} disabled={notifications.length === 0}>Clear all</Button>
          </>
        }
      />

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" size={16} />
          <Input
            placeholder="Search notifications..."
            className="pl-10 h-11 bg-card border border-border shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <LoadingState
          title="Loading notifications"
          description="Checking approval requests, payroll alerts, and system messages."
        />
      ) : loadError ? (
        <ErrorState
          title="Notifications could not load"
          description={loadError}
          action={<Button onClick={loadNotifications}>Retry</Button>}
        />
      ) : (
        <div className="grid gap-4">
          {paginatedNotifications.length > 0 ? paginatedNotifications.map((n) => {
          const visual = getNotificationVisual(n.type);
          return (
          <Card key={n.uuid} className={`border border-border shadow-sm overflow-hidden ${!n.is_read ? 'bg-info/5 ring-1 ring-info/20' : 'bg-card'}`}>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
                <div className={`h-12 w-12 shrink-0 rounded-lg flex items-center justify-center ${visual.iconClasses}`}>
                  {visual.icon}
                </div>
                <div className="flex-1 space-y-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-bold text-lg text-foreground">{n.title}</h3>
                      {!n.is_read && <Badge className="bg-info text-info-foreground">New</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs text-muted-foreground font-medium">{new Date(n.created_at).toLocaleString()}</span>
                      <button onClick={() => handleClear(n.uuid)} className="text-xs text-muted-foreground hover:text-destructive hover:underline font-bold">
                        Clear
                      </button>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{renderNotificationText(n.message)}</p>

                  {n.type === 'REGISTRATION_REQUEST' && n.user && (
                    <div className="mt-4 p-4 bg-secondary/20 rounded-lg border border-secondary border-dashed grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div className="space-y-1">
                        <p className="text-muted-foreground uppercase font-bold text-[10px]">Candidate</p>
                        <p className="font-bold text-foreground">{n.user.first_name} {n.user.last_name}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground uppercase font-bold text-[10px]">Contact</p>
                        <p className="font-bold text-foreground">{n.user.email}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground uppercase font-bold text-[10px]">Location</p>
                        <p className="font-bold text-foreground">{n.user.working_location?.name || 'N/A'}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground uppercase font-bold text-[10px]">Department</p>
                        <p className="font-bold text-foreground">{n.user.department?.name || 'N/A'}</p>
                      </div>
                    </div>
                  )}

                  {!n.is_read && n.reference_id && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      {n.type === 'REGISTRATION_REQUEST' && (
                        <>
                          <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => handleApproveRegistration(n.uuid, n.reference_id!)}>
                            <Check className="h-4 w-4 mr-2" size={16} /> Approve Access
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/5" onClick={() => handleDenyRegistration(n.uuid, n.reference_id!)}>
                            Deny Request
                          </Button>
                        </>
                      )}
                      {n.type === 'PAYROLL_APPROVAL_REQUEST' && (
                        <>
                          <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => handleApprovePayroll(n.uuid, n.reference_id!)}>
                            <Check className="h-4 w-4 mr-2" size={16} /> Approve Batch
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/5" onClick={() => rejectPayrollBatch(n.reference_id!, "Rejected from notifications").then(() => window.dispatchEvent(new CustomEvent('notifications_updated')))}>
                            Reject Batch
                          </Button>
                        </>
                      )}
                      {n.type === 'TRANSFER_REQUEST' && (
                        <>
                          <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={() => handleApproveTransfer(n.uuid, n.reference_id!, n.title)}>
                            <Check className="h-4 w-4 mr-2" size={16} /> Approve Transfer
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/5" onClick={() => handleDenyTransfer(n.uuid, n.reference_id!, n.title)}>
                            Reject Transfer
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          );
        }) : (
          <EmptyState
            title={searchTerm ? "No matching notifications" : "No notifications"}
            description={searchTerm ? "Clear the search to see all available notifications." : "Approval requests and payroll alerts will appear here when action is needed."}
            action={searchTerm ? <Button variant="outline" onClick={() => setSearchTerm('')}>Clear search</Button> : undefined}
          />
          )}
        </div>
      )}
      {!loading && !loadError && filtered.length > 0 && (
        <Pagination
          page={notificationsPage}
          totalPages={notificationsTotalPages}
          total={filtered.length}
          limit={NOTIFICATIONS_PAGE_SIZE}
          onPageChange={setNotificationsPage}
        />
      )}
    </div>
  );
}
