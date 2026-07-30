"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileCheck, AlertCircle, Activity, Clock, ShieldAlert, Bell, FileText, Calendar, ChevronRight, Plus, MapPin } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '@/context/auth-context';
import { getEmployees } from '@/api/employees';
import { getPayrollBatches } from '@/api/payroll';
import { getPendingUsers } from '@/api/users';
import { getWorkingLocations } from '@/api/working_locations';
import { Employee } from '@/types/employee';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { PermissionGate } from '@/components/auth/permission-gate';

const CHART_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

function formatRwfCompact(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [workingLocations, setWorkingLocations] = useState<any[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  const role = params.role as string;
  const uuid = params.uuid as string;
  const basePath = `/${role}/${uuid}`;

  const isManagement = hasPermission('employees.read') || hasPermission('payroll.read') || hasPermission('users.read') || hasPermission('attendance.read');

  // Every section below is gated by the *specific* permission it needs, not
  // just the broad "isManagement" check - a user with only attendance.read
  // should never see payroll totals or a personnel chart just because they
  // qualify for the management view shell.
  const canViewEmployees = hasPermission('employees.read');
  const canViewAllLocations = hasPermission('employees.read_all') || !!user?.roles?.includes('SUPER_ADMIN');
  const canViewPayroll = hasPermission('payroll.read');
  const canApproveUsers = hasPermission('users.approve') || hasPermission('employees.approve');
  const canApprovePayroll =
    hasPermission('payroll.approve') ||
    hasPermission('payroll.approve_initial') ||
    hasPermission('payroll.approve_final');

  useEffect(() => {
    async function loadData() {
      if (!isManagement) {
        return;
      }
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
      if (canViewAllLocations) {
        try {
          const locRes = await getWorkingLocations();
          setWorkingLocations(locRes.working_locations || locRes.locations || (Array.isArray(locRes) ? locRes : []));
        } catch (error) {
          console.error('Dashboard working locations load failed:', error);
        }
      }
    }
    if (user) loadData();
  }, [user, isManagement, canViewEmployees, canViewPayroll, canApproveUsers, canViewAllLocations]);

  // Every chart below reacts to this selector: "all" keeps the group-wide
  // view, otherwise both the payroll chart and the breakdown chart are
  // scoped down to the one working location the user picked.
  const filteredBatches = useMemo(() => {
    if (selectedLocationId === 'all') return batches;
    return batches.filter((b) => (b.working_location_id ?? b.working_location?.id) === selectedLocationId);
  }, [batches, selectedLocationId]);

  const filteredEmployees = useMemo(() => {
    if (selectedLocationId === 'all') return employees;
    return employees.filter((e) => (e as any).working_location_id === selectedLocationId || (e as any).working_location?.id === selectedLocationId);
  }, [employees, selectedLocationId]);

  const payrollChartData = useMemo(() => {
    return [...filteredBatches]
      .sort((a, b) => {
        const aKey = `${a.payroll_year ?? 0}-${String(a.payroll_month ?? 0).padStart(2, '0')}`;
        const bKey = `${b.payroll_year ?? 0}-${String(b.payroll_month ?? 0).padStart(2, '0')}`;
        return aKey.localeCompare(bKey);
      })
      .slice(-8)
      .map((b) => ({
        name: b.batch_code ?? `${b.payroll_month}/${b.payroll_year}`,
        gross: Number(b.total_gross ?? 0),
        net: Number(b.total_amount ?? 0),
        tax: Number(b.total_tax ?? 0),
      }));
  }, [filteredBatches]);

  // "All locations" breaks personnel down by working location; once a single
  // location is selected that would collapse to one slice, so switch the
  // same chart to a per-department breakdown for that location instead.
  const locationBreakdown = useMemo(() => {
    if (!canViewAllLocations) return [];
    const counts = new Map<string, number>();
    for (const emp of filteredEmployees) {
      const name =
        selectedLocationId === 'all'
          ? ((emp as any).working_location?.name ?? emp.location ?? 'Unassigned')
          : ((emp as any).department?.name ?? (emp as any).department ?? 'Unassigned');
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredEmployees, selectedLocationId, canViewAllLocations]);

  const pendingApprovalBatches = filteredBatches.filter((b) =>
    ['PENDING', 'IN_REVIEW', 'MANAGER_APPROVED'].includes(b.status),
  );
  const rejectedBatches = filteredBatches.filter((b) => String(b.status ?? '').includes('REJECTED'));
  const hasCriticalActionsAccess = canApproveUsers || canApprovePayroll;

  // Handle Pending Registration State
  if (user?.status === 'PENDING') {
    return (
      <div className="space-y-8 max-w-4xl mx-auto py-12">
        <div className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-100 shadow-inner">
            <Clock className="h-12 w-12 text-amber-500 animate-pulse" />
          </div>
          <h1 className="text-4xl font-headline font-bold text-slate-900">Registration Pending</h1>
          <p className="text-lg text-muted-foreground">Welcome to REG, <span className="text-primary font-bold">{user.name}</span>. Your account is currently in the review queue.</p>
        </div>
        <Card className="border-2 border-dashed border-amber-200 bg-amber-50/20 shadow-none">
          <CardContent className="py-10 px-10 text-center">
            <div className="flex flex-col items-center gap-6">
              <ShieldAlert className="h-14 w-14 text-amber-400" />
              <div className="space-y-2">
                <p className="font-bold text-xl text-slate-800">Identity Verification Required</p>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Administrators must verify your corporate role and assign functional permissions.
                </p>
              </div>
              <div className="mt-4 flex gap-4">
                <Button variant="outline" className="h-11 px-8 rounded-xl border-amber-200 hover:bg-amber-50">Support Desk</Button>
                <Button variant="default" className="h-11 px-8 rounded-xl bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-600/20" onClick={() => window.location.reload()}>Refresh Status</Button>
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
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-headline font-bold text-slate-900 tracking-tight">Enterprise Console</h1>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-3">Authenticated</Badge>
            </div>
            <p className="text-muted-foreground text-lg">Welcome back, <span className="font-semibold text-slate-700">{user?.name}</span>. Your operational modules are active below.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            <section>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <Activity className="h-4 w-4" /> Core Operations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PermissionGate permission="payroll.read">
                  <Card className="border-none shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group">
                    <div className="h-1.5 bg-primary w-full" />
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300 shadow-sm">
                          <FileText className="h-6 w-6" />
                        </div>
                        <Badge variant="secondary" className="font-bold">PAYROLL</Badge>
                      </div>
                      <CardTitle>Payroll Management</CardTitle>
                      <CardDescription>Execute salary batches and review disbursement history.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Link href={`${basePath}/payroll`} className="w-full">
                        <Button className="w-full justify-between h-11 bg-slate-900 hover:bg-slate-800 rounded-xl" size="sm">
                          <span className="flex items-center gap-2">Access Payroll Module</span>
                          <ChevronRight className="h-4 w-4 opacity-50" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </PermissionGate>

                <PermissionGate permission="attendance.read">
                  <Card className="border-none shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group">
                    <div className="h-1.5 bg-emerald-500 w-full" />
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300 shadow-sm">
                          <Calendar className="h-6 w-6" />
                        </div>
                        <Badge variant="secondary" className="font-bold">PRESENCE</Badge>
                      </div>
                      <CardTitle>Attendance Tracking</CardTitle>
                      <CardDescription>Monitor workforce punctuality and logs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Link href={`${basePath}/attendance`} className="w-full">
                        <Button className="w-full justify-between h-11 bg-slate-900 hover:bg-slate-800 rounded-xl" size="sm">
                          <span className="flex items-center gap-2">Enter Daily Log</span>
                          <ChevronRight className="h-4 w-4 opacity-50" />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </PermissionGate>
              </div>
            </section>
          </div>
          <div className="space-y-8">
             <Card className="border-none shadow-sm bg-slate-900 text-white rounded-3xl overflow-hidden p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-primary" />
                  <h3 className="font-bold tracking-tight">System Alerts</h3>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-white/60 italic">No critical alerts at this time.</p>
                </div>
             </Card>
          </div>
        </div>
      </div>
    );
  }

  // Management Dashboard. Each card only appears if the current user
  // actually holds the permission the underlying number depends on -
  // otherwise it would show a misleading "0" for data they can't see.
  const stats = [
    canViewEmployees && {
      label: 'Total Personnel',
      value: filteredEmployees.length,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    canViewPayroll && {
      label: 'Approved Batches',
      value: filteredBatches.filter((b) => b.status === 'APPROVED').length,
      icon: FileCheck,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    canViewPayroll && {
      label: 'Pending Batches',
      value: pendingApprovalBatches.length,
      icon: Clock,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    canApproveUsers && {
      label: 'Pending Registrations',
      value: pendingUsers.length,
      icon: AlertCircle,
      color: 'text-rose-600',
      bg: 'bg-rose-50',
    },
  ].filter(Boolean) as Array<{ label: string; value: number; icon: any; color: string; bg: string }>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-3xl shadow-sm border">
        <div>
          <h1 className="text-4xl font-headline font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground text-lg">Group-wide operational overview for REG Management.</p>
        </div>
        <div className="flex gap-3">
          {canViewAllLocations && workingLocations.length > 0 && (
            <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
              <SelectTrigger className="h-12 w-[220px] bg-white">
                <MapPin className="h-4 w-4 mr-1 text-muted-foreground" />
                <SelectValue placeholder="All locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All working locations</SelectItem>
                {workingLocations.map((loc: any) => (
                  <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button className="h-12 px-6 rounded-xl shadow-lg shadow-primary/20" onClick={() => router.push(`${basePath}/payroll/new`)}>
            <Plus className="mr-2 h-4 w-4" /> New Payroll Batch
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="border-none shadow-sm hover:shadow-md transition-shadow duration-300 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-2xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-6 w-6" />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                <p className="text-3xl font-bold mt-1 tracking-tight text-slate-900">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {canViewPayroll && (
          <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-xl font-bold">Payroll Gross vs Net</CardTitle>
                <CardDescription>
                  {canViewAllLocations
                    ? selectedLocationId === 'all'
                      ? 'Most recent payroll batches across all working locations.'
                      : `Most recent payroll batches for ${workingLocations.find((l) => l.id === selectedLocationId)?.name ?? 'the selected location'}.`
                    : 'Most recent payroll batches for your working location.'}
                </CardDescription>
              </div>
              <div className="h-12 w-16 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm">
                RWF
              </div>
            </CardHeader>
            <CardContent>
              {payrollChartData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payrollChartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={formatRwfCompact} tick={{ fontSize: 11 }} />
                      <RechartsTooltip formatter={(value) => formatRwfCompact(Number(value))} />
                      <Legend />
                      <Bar dataKey="gross" name="Gross" fill="#2563eb" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="net" name="Net" fill="#10b981" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] w-full bg-slate-50 rounded-2xl border border-dashed flex items-center justify-center text-muted-foreground italic">
                  No payroll batches yet.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {hasCriticalActionsAccess && (
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-900 text-white pb-6">
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-400" /> Critical Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {canApproveUsers && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">Personnel Verification</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {pendingUsers.length > 0
                          ? `${pendingUsers.length} registration${pendingUsers.length === 1 ? '' : 's'} awaiting approval.`
                          : 'No pending registrations right now.'}
                      </p>
                      {pendingUsers.length > 0 && (
                        <Button variant="link" className="p-0 h-auto text-amber-600 font-bold text-xs mt-2" onClick={() => router.push(`${basePath}/users`)}>Review Queue</Button>
                      )}
                    </div>
                  </div>
                )}
                {canApprovePayroll && (
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                    <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-900">Batch Approval</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {pendingApprovalBatches.length > 0
                          ? `${pendingApprovalBatches.length} batch${pendingApprovalBatches.length === 1 ? '' : 'es'} awaiting your approval.`
                          : rejectedBatches.length > 0
                            ? `${rejectedBatches.length} batch${rejectedBatches.length === 1 ? '' : 'es'} were rejected and need review.`
                            : 'No batches awaiting approval.'}
                      </p>
                      {(pendingApprovalBatches.length > 0 || rejectedBatches.length > 0) && (
                        <Button variant="link" className="p-0 h-auto text-blue-600 font-bold text-xs mt-2" onClick={() => router.push(`${basePath}/payroll`)}>Open Batches</Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {canViewAllLocations && locationBreakdown.length > 0 && (
        <Card className="border-none shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              {selectedLocationId === 'all'
                ? 'Personnel by Working Location'
                : `Personnel by Department · ${workingLocations.find((l) => l.id === selectedLocationId)?.name ?? ''}`}
            </CardTitle>
            <CardDescription>Only visible to roles with cross-branch visibility (employees.read_all / SUPER_ADMIN).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={locationBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry: any) => `${entry.name}: ${entry.value}`}
                  >
                    {locationBreakdown.map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
