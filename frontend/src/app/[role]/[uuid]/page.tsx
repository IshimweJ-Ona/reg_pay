
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileCheck, AlertCircle, TrendingUp, Activity, Clock, ShieldAlert, Bell, FileText, Calendar, ChevronRight, Plus, Building2, MapPin, Receipt, Wallet } from 'lucide-react';
import { useAuth, isAdminRole } from '@/context/auth-context';
import { getEmployees } from '@/api/employees';
import { getPayrollBatches } from '@/api/payroll';
import { Employee } from '@/types/employee';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { PermissionGate } from '@/components/auth/permission-gate';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const role = params.role as string;
  const uuid = params.uuid as string;
  const basePath = `/${role}/${uuid}`;

  useEffect(() => {
    async function loadData() {
      if (!isAdminRole(user?.role)) {
        setIsLoading(false);
        return;
      }
      try {
        const [empRes, batchRes] = await Promise.all([
          getEmployees(),
          getPayrollBatches()
        ]);
        setEmployees(empRes.employees || (Array.isArray(empRes) ? empRes : []));
        setBatches(batchRes.batches || (Array.isArray(batchRes) ? batchRes : []));
      } catch (error) {
        console.error('Dashboard data load failed:', error);
      } finally {
        setIsLoading(false);
      }
    }
    if (user) loadData();
  }, [user]);

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
  if (!isAdminRole(user?.role)) {
    return (
      <div className="space-y-10 max-w-7xl mx-auto">
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

  // Management Dashboard
  const stats = [
    { label: 'Total Personnel', value: employees.length, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Batches', value: batches.filter(b => b.status === 'APPROVED' || b.status === 'MANAGER_APPROVED').length, icon: FileCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Pending Batches', value: batches.filter(b => b.status === 'PENDING' || b.status === 'IN_REVIEW').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Pending Users', value: employees.filter(e => e.status === 'PENDING').length, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-8 rounded-3xl shadow-sm border">
        <div>
          <h1 className="text-4xl font-headline font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground text-lg">Group-wide operational overview for REG Management.</p>
        </div>
        <div className="flex gap-3">
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
                {i === 0 && <Badge className="bg-blue-500/10 text-blue-600 border-none px-2">+12%</Badge>}
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
        <Card className="lg:col-span-2 border-none shadow-sm rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xl font-bold">Group Liquidity & Disbursement</CardTitle>
              <CardDescription>Aggregated monthly salary trends across all regional branches.</CardDescription>
            </div>
            <div className="h-12 w-16 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold text-sm">
              RWF
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full bg-slate-50 rounded-2xl border border-dashed flex items-center justify-center text-muted-foreground italic">
              Financial performance visualization currently synchronizing...
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="bg-slate-900 text-white pb-6">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-400" /> Critical Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Personnel Verification</p>
                  <p className="text-xs text-slate-600 mt-1">14 new registrations are awaiting role assignment.</p>
                  <Button variant="link" className="p-0 h-auto text-amber-600 font-bold text-xs mt-2" onClick={() => router.push(`${basePath}/users`)}>Review Queue</Button>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900">Batch Approval</p>
                  <p className="text-xs text-slate-600 mt-1">HQ Manager rejected 'PAY-2026-05'. Review required.</p>
                  <Button variant="link" className="p-0 h-auto text-blue-600 font-bold text-xs mt-2" onClick={() => router.push(`${basePath}/payroll`)}>Open Batches</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
