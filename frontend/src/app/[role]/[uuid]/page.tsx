"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Users01 as Users,
  FileCheck01 as FileCheck,
  AlertCircle,
  Activity,
  Clock,
  Shield01 as ShieldAlert,
  Bell01 as Bell,
  File02 as FileText,
  Calendar,
  ChevronRight,
  Plus,
} from '@untitledui/icons';
import { useAuth } from '@/context/auth-context';
import { getEmployees } from '@/api/employees';
import { getPayrollBatches } from '@/api/payroll';
import { getPendingUsers } from '@/api/users';
import { Employee } from '@/types/employee';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { PermissionGate } from '@/components/auth/permission-gate';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState, LoadingState } from '@/components/layout/page-state';
import { StatCard, StatCardTone } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { DashboardAnalyticsSection } from '@/components/dashboard/dashboard-analytics-section';

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const role = params.role as string;
  const uuid = params.uuid as string;
  const basePath = `/${role}/${uuid}`;

  const canViewPayrollReports = hasPermission('payroll.reports');
  const isManagement =
    hasPermission('employees.read') ||
    hasPermission('payroll.read') ||
    canViewPayrollReports ||
    hasPermission('users.read') ||
    hasPermission('attendance.read');

  // Every section below is gated by the *specific* permission it needs, not
  // just the broad "isManagement" check - a user with only attendance.read
  // should never see payroll totals or a personnel chart just because they
  // qualify for the management view shell.
  const canViewEmployees = hasPermission('employees.read');
  const canViewPayroll = hasPermission('payroll.read');
  const canApproveUsers = hasPermission('users.approve') || hasPermission('employees.approve');
  const canApprovePayroll =
    hasPermission('payroll.approve') ||
    hasPermission('payroll.approve_initial') ||
    hasPermission('payroll.approve_final');
  const hasEmployeeWorkspaceModules = hasPermission('payroll.read') || hasPermission('attendance.read');

  useEffect(() => {
    async function loadData() {
      if (!isManagement) {
        setDashboardLoading(false);
        return;
      }
      setDashboardLoading(true);
      if (canViewEmployees) {
        try {
          const empRes = await getEmployees();
          setEmployees(empRes.employees || (Array.isArray(empRes) ? empRes : []));
        } catch (error) {
          console.error('Dashboard employees load failed:', error);
        }
      }
      if (canViewPayroll) {
        try {
          const batchRes = await getPayrollBatches();
          setBatches(batchRes.batches || (Array.isArray(batchRes) ? batchRes : []));
        } catch (error) {
          console.error('Dashboard payroll batches load failed:', error);
        }
      }
      if (canApproveUsers) {
        try {
          const pendingRes = await getPendingUsers();
          setPendingUsers(pendingRes.users || (Array.isArray(pendingRes) ? pendingRes : []));
        } catch (error) {
          console.error('Dashboard pending users load failed:', error);
        }
      }
      setDashboardLoading(false);
    }
    if (user) loadData();
    // Keyed on user?.id, not the whole user object: `user` gets a new
    // object reference every ~15s from the layout's background
    // refreshPermissions() poll (see [role]/[uuid]/layout.tsx), which would
    // otherwise needlessly refetch employees/payroll/pending-users and
    // flash the dashboard's loading state on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isManagement, canViewEmployees, canViewPayroll, canApproveUsers]);

  const pendingApprovalBatches = batches.filter((b) =>
    ['PENDING', 'IN_REVIEW', 'MANAGER_APPROVED'].includes(b.status),
  );
  const rejectedBatches = batches.filter((b) => String(b.status ?? '').includes('REJECTED'));
  const hasCriticalActionsAccess = canApproveUsers || canApprovePayroll;

  // Handle Pending Registration State
  if (user?.status === 'PENDING') {
    return (
      <div className="space-y-8 max-w-4xl mx-auto py-12">
        <div className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 bg-warning/10 rounded-full flex items-center justify-center mb-6 border border-warning/20 shadow-inner">
            <Clock className="h-12 w-12 text-warning animate-pulse" size={48} />
          </div>
          <h1 className="text-2xl font-headline font-bold text-foreground">Registration Pending</h1>
          <p className="text-lg text-muted-foreground">Welcome to REG, <span className="text-primary font-bold">{user.name}</span>. Your account is currently in the review queue.</p>
        </div>
        <Card className="border-2 border-dashed border-warning/30 bg-warning/5 shadow-none">
          <CardContent className="py-10 px-10 text-center">
            <div className="flex flex-col items-center gap-6">
              <ShieldAlert className="h-14 w-14 text-warning" size={56} />
              <div className="space-y-2">
                <p className="font-bold text-xl text-foreground">Identity Verification Required</p>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Administrators must verify your corporate role and assign functional permissions.
                </p>
              </div>
              <div className="mt-4 flex gap-4">
                <Button variant="outline" className="h-11 px-8 rounded-lg border-warning/30 hover:bg-warning/10">Support Desk</Button>
                <Button variant="default" className="h-11 px-8 rounded-lg bg-warning hover:bg-warning/90 text-warning-foreground shadow-sm shadow-warning/20" onClick={() => window.location.reload()}>Refresh Status</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If not admin/management, show User Dashboard
  if (!isManagement) {
    return (
      <div className="space-y-10 max-w-[1800px] mx-auto">
        <PageHeader
          title="My Workspace"
          description={`Welcome back, ${user?.name}. Access the payroll and attendance tools available to your role.`}
          actions={<StatusBadge tone="success" label="Authenticated" />}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            <section>
              <h3 className="text-xs font-bold text-muted-foreground uppercase mb-6 flex items-center gap-2">
                <Activity className="h-4 w-4" size={16} /> Core Operations
              </h3>
              {hasEmployeeWorkspaceModules ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PermissionGate permission="payroll.read">
                  <Card className="border border-border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
                    <div className="h-1.5 bg-primary w-full" />
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300 shadow-sm">
                          <FileText className="h-6 w-6" size={24} />
                        </div>
                        <Badge variant="secondary" className="font-bold">PAYROLL</Badge>
                      </div>
                      <CardTitle>Payroll Management</CardTitle>
                      <CardDescription>Execute salary batches and review disbursement history.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Link href={`${basePath}/payroll`} className="w-full">
                        <Button className="w-full justify-between h-11 bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg" size="sm">
                          <span className="flex items-center gap-2">Access Payroll Module</span>
                          <ChevronRight className="h-4 w-4 opacity-50" size={16} />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </PermissionGate>

                <PermissionGate permission="attendance.read">
                  <Card className="border border-border shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
                    <div className="h-1.5 bg-success w-full" />
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center text-success group-hover:bg-success group-hover:text-success-foreground transition-colors duration-300 shadow-sm">
                          <Calendar className="h-6 w-6" size={24} />
                        </div>
                        <Badge variant="secondary" className="font-bold">PRESENCE</Badge>
                      </div>
                      <CardTitle>Attendance Tracking</CardTitle>
                      <CardDescription>Monitor workforce punctuality and logs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Link href={`${basePath}/attendance`} className="w-full">
                        <Button className="w-full justify-between h-11 bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg" size="sm">
                          <span className="flex items-center gap-2">Enter Daily Log</span>
                          <ChevronRight className="h-4 w-4 opacity-50" size={16} />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </PermissionGate>
                </div>
              ) : (
                <EmptyState
                  title="No self-service modules assigned"
                  description="Your account is active, but no payroll or attendance modules are assigned to this role yet."
                />
              )}
            </section>
          </div>
          <div className="space-y-8">
             <Card className="border border-border shadow-sm bg-accent text-accent-foreground rounded-lg overflow-hidden p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-primary" size={20} />
                  <h3 className="font-bold">System Alerts</h3>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-accent-foreground/60 italic">No critical alerts at this time.</p>
                </div>
             </Card>
          </div>
        </div>
      </div>
    );
  }

  if (dashboardLoading) {
    return (
      <LoadingState
        title="Loading management dashboard"
        description="Preparing personnel, payroll, approvals, and branch-level metrics."
      />
    );
  }

  // Management Dashboard. Each card only appears if the current user
  // actually holds the permission the underlying number depends on -
  // otherwise it would show a misleading "0" for data they can't see.
  const stats = [
    canViewEmployees && {
      label: 'Total Personnel',
      value: employees.length,
      icon: Users,
      tone: 'info' as StatCardTone,
    },
    canViewPayroll && {
      label: 'Approved Batches',
      value: batches.filter((b) => b.status === 'APPROVED').length,
      icon: FileCheck,
      tone: 'success' as StatCardTone,
    },
    canViewPayroll && {
      label: 'Pending Batches',
      value: pendingApprovalBatches.length,
      icon: Clock,
      tone: 'warning' as StatCardTone,
    },
    canApproveUsers && {
      label: 'Pending Registrations',
      value: pendingUsers.length,
      icon: AlertCircle,
      tone: 'destructive' as StatCardTone,
    },
  ].filter(Boolean) as Array<{ label: string; value: number; icon: any; tone: StatCardTone }>;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Management Dashboard"
        description="Operational overview for personnel, payroll batches, approvals, and branch-level exceptions."
        actions={
          <>
            <PermissionGate permission="payroll.create">
              <Button className="h-12 px-6 rounded-lg shadow-sm shadow-primary/20" onClick={() => router.push(`${basePath}/payroll/new`)}>
                <Plus className="mr-2 h-4 w-4" size={16} /> New Payroll Batch
              </Button>
            </PermissionGate>
          </>
        }
      />

      {stats.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <StatCard key={i} icon={<stat.icon className="h-6 w-6" size={24} />} label={stat.label} value={stat.value} tone={stat.tone} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No dashboard metrics available"
          description="Your role has management access, but no personnel, payroll, or approval metrics are currently assigned."
        />
      )}

      <DashboardAnalyticsSection
        canViewEmployeeAnalytics={canViewEmployees}
        canViewPayrollAnalytics={canViewPayrollReports}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {hasCriticalActionsAccess && (
          <Card className="border border-border shadow-sm rounded-lg overflow-hidden">
            <CardHeader className="bg-accent text-accent-foreground pb-6">
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-warning" size={20} /> Critical Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {canApproveUsers && (
                  <div className="p-4 rounded-lg bg-warning/10 border border-warning/20 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-warning mt-0.5" size={20} />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">Personnel Verification</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pendingUsers.length > 0
                          ? `${pendingUsers.length} registration${pendingUsers.length === 1 ? '' : 's'} awaiting approval.`
                          : 'No pending registrations right now.'}
                      </p>
                      {pendingUsers.length > 0 && (
                        <Button variant="link" className="p-0 h-auto text-warning font-bold text-xs mt-2" onClick={() => router.push(`${basePath}/users`)}>Review Queue</Button>
                      )}
                    </div>
                  </div>
                )}
                {canApprovePayroll && (
                  <div className="p-4 rounded-lg bg-info/10 border border-info/20 flex items-start gap-3">
                    <Clock className="h-5 w-5 text-info mt-0.5" size={20} />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-foreground">Batch Approval</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {pendingApprovalBatches.length > 0
                          ? `${pendingApprovalBatches.length} batch${pendingApprovalBatches.length === 1 ? '' : 'es'} awaiting your approval.`
                          : rejectedBatches.length > 0
                            ? `${rejectedBatches.length} batch${rejectedBatches.length === 1 ? '' : 'es'} were rejected and need review.`
                            : 'No batches awaiting approval.'}
                      </p>
                      {(pendingApprovalBatches.length > 0 || rejectedBatches.length > 0) && (
                        <Button variant="link" className="p-0 h-auto text-info font-bold text-xs mt-2" onClick={() => router.push(`${basePath}/payroll`)}>Open Batches</Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
