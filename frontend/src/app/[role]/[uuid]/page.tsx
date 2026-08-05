"use client";

import { useEffect, useMemo, useState } from 'react';
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
  MarkerPin01 as MapPin,
} from '@untitledui/icons';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LabelList,
  PieChart,
  Pie,
  Cell,
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
import { PageHeader } from '@/components/layout/page-header';
import { StatCard, StatCardTone } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';

function formatRwfCompact(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toFixed(0);
}

// Fixed-order categorical slots (see globals.css) - never cycled or reassigned by rank.
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
];

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
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredEmployees, selectedLocationId, canViewAllLocations]);

  // Working-location share as a pie: every location gets its own slice, no
  // folding, so a newly added location shows up automatically as soon as it
  // has employees. The first 8 slices use the fixed brand hues; anything
  // beyond that gets a generated hue (golden-angle spacing keeps neighbors
  // visually apart) so the chart never has to drop or merge a location.
  // "share" (not "percent") is deliberate - Recharts' <Pie label> spreads
  // each data entry over its own computed geometry props, so a field
  // literally named "percent" clobbers Recharts' own 0-1 fraction and the
  // label doubles up (e.g. renders "4000%" instead of "40%").
  const locationPieData = useMemo(() => {
    const total = locationBreakdown.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return [];
    return locationBreakdown.map((d, i) => ({
      ...d,
      share: total > 0 ? (d.value / total) * 100 : 0,
      color:
        i < CHART_COLORS.length
          ? CHART_COLORS[i]
          : `hsl(${Math.round((i * 137.508) % 360)}, 62%, 48%)`,
    }));
  }, [locationBreakdown]);

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
          <div className="mx-auto w-24 h-24 bg-warning/10 rounded-full flex items-center justify-center mb-6 border border-warning/20 shadow-inner">
            <Clock className="h-12 w-12 text-warning animate-pulse" size={48} />
          </div>
          <h1 className="text-4xl font-headline font-bold text-foreground">Registration Pending</h1>
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
                <Button variant="outline" className="h-11 px-8 rounded-xl border-warning/30 hover:bg-warning/10">Support Desk</Button>
                <Button variant="default" className="h-11 px-8 rounded-xl bg-warning hover:bg-warning/90 text-warning-foreground shadow-lg shadow-warning/20" onClick={() => window.location.reload()}>Refresh Status</Button>
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
          title="Enterprise Console"
          description={`Welcome back, ${user?.name}. Your operational modules are active below.`}
          actions={<StatusBadge tone="success" label="Authenticated" />}
        />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            <section>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                <Activity className="h-4 w-4" size={16} /> Core Operations
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PermissionGate permission="payroll.read">
                  <Card className="border-none shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group">
                    <div className="h-1.5 bg-primary w-full" />
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300 shadow-sm">
                          <FileText className="h-6 w-6" size={24} />
                        </div>
                        <Badge variant="secondary" className="font-bold">PAYROLL</Badge>
                      </div>
                      <CardTitle>Payroll Management</CardTitle>
                      <CardDescription>Execute salary batches and review disbursement history.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Link href={`${basePath}/payroll`} className="w-full">
                        <Button className="w-full justify-between h-11 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl" size="sm">
                          <span className="flex items-center gap-2">Access Payroll Module</span>
                          <ChevronRight className="h-4 w-4 opacity-50" size={16} />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </PermissionGate>

                <PermissionGate permission="attendance.read">
                  <Card className="border-none shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group">
                    <div className="h-1.5 bg-success w-full" />
                    <CardHeader>
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-12 w-12 rounded-2xl bg-success/10 flex items-center justify-center text-success group-hover:bg-success group-hover:text-success-foreground transition-colors duration-300 shadow-sm">
                          <Calendar className="h-6 w-6" size={24} />
                        </div>
                        <Badge variant="secondary" className="font-bold">PRESENCE</Badge>
                      </div>
                      <CardTitle>Attendance Tracking</CardTitle>
                      <CardDescription>Monitor workforce punctuality and logs.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Link href={`${basePath}/attendance`} className="w-full">
                        <Button className="w-full justify-between h-11 bg-accent text-accent-foreground hover:bg-accent/90 rounded-xl" size="sm">
                          <span className="flex items-center gap-2">Enter Daily Log</span>
                          <ChevronRight className="h-4 w-4 opacity-50" size={16} />
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                </PermissionGate>
              </div>
            </section>
          </div>
          <div className="space-y-8">
             <Card className="border-none shadow-sm bg-accent text-accent-foreground rounded-3xl overflow-hidden p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-primary" size={20} />
                  <h3 className="font-bold tracking-tight">System Alerts</h3>
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

  // Management Dashboard. Each card only appears if the current user
  // actually holds the permission the underlying number depends on -
  // otherwise it would show a misleading "0" for data they can't see.
  const stats = [
    canViewEmployees && {
      label: 'Total Personnel',
      value: filteredEmployees.length,
      icon: Users,
      tone: 'info' as StatCardTone,
    },
    canViewPayroll && {
      label: 'Approved Batches',
      value: filteredBatches.filter((b) => b.status === 'APPROVED').length,
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
        title="Executive Dashboard"
        description="Group-wide operational overview for REG Management."
        actions={
          <>
            {canViewAllLocations && workingLocations.length > 0 && (
              <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
                <SelectTrigger className="h-12 w-[220px] bg-card">
                  <MapPin className="h-4 w-4 mr-1 text-muted-foreground" size={16} />
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
              <Plus className="mr-2 h-4 w-4" size={16} /> New Payroll Batch
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <StatCard key={i} icon={<stat.icon className="h-6 w-6" size={24} />} label={stat.label} value={stat.value} tone={stat.tone} />
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
              <div className="h-12 w-16 rounded-xl bg-success/10 flex items-center justify-center text-success font-bold text-sm">
                RWF
              </div>
            </CardHeader>
            <CardContent>
              {payrollChartData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={payrollChartData} barGap={6}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                      <YAxis tickFormatter={formatRwfCompact} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <RechartsTooltip cursor={{ fill: 'hsl(var(--muted))' }} formatter={(value) => formatRwfCompact(Number(value))} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="gross" name="Gross" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={64} />
                      <Bar dataKey="net" name="Net" fill="hsl(var(--info))" radius={[6, 6, 0, 0]} maxBarSize={64} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] w-full bg-muted rounded-2xl border border-dashed flex items-center justify-center text-muted-foreground italic">
                  No payroll batches yet.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {hasCriticalActionsAccess && (
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-accent text-accent-foreground pb-6">
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-warning" size={20} /> Critical Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {canApproveUsers && (
                  <div className="p-4 rounded-2xl bg-warning/10 border border-warning/20 flex items-start gap-3">
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
                  <div className="p-4 rounded-2xl bg-info/10 border border-info/20 flex items-start gap-3">
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

      {canViewAllLocations && locationBreakdown.length > 0 && (
        <Card className="border-none shadow-sm rounded-3xl">
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" size={20} />
              {selectedLocationId === 'all'
                ? 'Personnel by Working Location'
                : `Personnel by Department · ${workingLocations.find((l) => l.id === selectedLocationId)?.name ?? ''}`}
            </CardTitle>
            <CardDescription>Only visible to roles with cross-branch visibility (employees.read_all / SUPER_ADMIN).</CardDescription>
          </CardHeader>
          <CardContent>
            {selectedLocationId === 'all' ? (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <RechartsTooltip
                      formatter={(value, name, item) => {
                        const share = (item?.payload?.share ?? 0).toFixed(0);
                        return [`${value} personnel (${share}%)`, String(name)];
                      }}
                    />
                    <Legend
                      verticalAlign="middle"
                      align="right"
                      layout="vertical"
                      wrapperStyle={{ fontSize: 12, lineHeight: '20px' }}
                    />
                    <Pie
                      data={locationPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="38%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={110}
                      paddingAngle={2}
                      label={({ percent, value }) =>
                        (percent ?? 0) >= 0.08 ? `${value} (${((percent ?? 0) * 100).toFixed(0)}%)` : ''
                      }
                      labelLine={false}
                    >
                      {locationPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="hsl(var(--card))" strokeWidth={2} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ height: Math.max(280, locationBreakdown.length * 42) }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={locationBreakdown}
                    layout="vertical"
                    margin={{ top: 4, right: 32, bottom: 4, left: 4 }}
                    barCategoryGap={10}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={160}
                      tick={{ fontSize: 12 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip cursor={{ fill: 'hsl(var(--muted))' }} formatter={(value) => [value, 'Personnel']} />
                    <Bar dataKey="value" name="Personnel" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={28}>
                      <LabelList dataKey="value" position="right" style={{ fontSize: 12, fontWeight: 600, fill: 'hsl(var(--foreground))' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
