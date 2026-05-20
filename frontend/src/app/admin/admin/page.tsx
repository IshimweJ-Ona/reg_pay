
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileCheck, AlertCircle, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { useRouter } from 'next/navigation';
import { getEmployees } from '@/api/employees';
import { getPayrollBatches } from '@/api/payroll';
import { getPendingUsers } from '@/api/users';
import { getDepartments } from '@/api/working_locations';

export default function AdminDashboard() {
  const router = useRouter();
  const [employees, setEmployees] = useState<any[]>([]);
  const [payrollBatches, setPayrollBatches] = useState<any[]>([]);
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      getEmployees().catch(() => ({ employees: [] })),
      getPayrollBatches().catch(() => []),
      getPendingUsers().catch(() => ({ pending_users: [] })),
      getDepartments().catch(() => ({ departments: [] })),
    ]).then(([employeeData, batchItems, pendingData, departmentData]) => {
      setEmployees(employeeData.employees || []);
      setPayrollBatches(batchItems);
      setPendingUsers(pendingData.pending_users || []);
      setDepartments(departmentData.departments || []);
    });
  }, []);

  const data = useMemo(() => {
    const payrollByPeriod = new Map<string, number>();
    payrollBatches.forEach((batch) => {
      const key = `${batch.payroll_month}/${batch.payroll_year}`;
      payrollByPeriod.set(key, (payrollByPeriod.get(key) ?? 0) + Number(batch.total_amount ?? 0));
    });

    const rows = Array.from(payrollByPeriod.entries()).map(([name, payroll]) => ({
      name,
      payroll,
      employees: employees.length,
    }));

    return rows.length ? rows : [{ name: 'Current', payroll: 0, employees: employees.length }];
  }, [employees.length, payrollBatches]);

  const stats = [
    { name: 'Total Employees', value: employees.length.toLocaleString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
    { name: 'Pending Approvals', value: pendingUsers.length.toLocaleString(), icon: FileCheck, color: 'text-amber-600', bg: 'bg-amber-100' },
    { name: 'Active Payroll', value: `$${payrollBatches.reduce((sum, batch) => sum + Number(batch.total_amount ?? 0), 0).toLocaleString()}`, icon: DollarSign, color: 'text-primary', bg: 'bg-primary/10' },
    { name: 'System Status', value: 'Optimal', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-100' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-headline font-bold">Executive Dashboard</h1>
        <p className="text-muted-foreground">Real-time overview of REG(Rwanda Energy Group) payment infrastructure.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.name} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                  <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                </div>
                <div className={`${stat.bg} p-3 rounded-xl`}>
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Payroll Disbursement Trends
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorPayroll" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                <Tooltip />
                <Area type="monotone" dataKey="payroll" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPayroll)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-accent" /> Department Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: 'hsl(var(--secondary))'}} />
                <Bar dataKey="employees" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Recent Administrative Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingUsers.slice(0, 3).map((pendingUser) => (
                <div 
                  key={pendingUser.uuid} 
                  className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-muted-foreground/20 hover:border-primary/50 transition-colors group cursor-pointer"
                  onClick={() => router.push('/admin/admin/users')}
                >
                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    {pendingUser.first_name?.charAt(0) ?? 'U'}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Pending account approval</p>
                    <p className="text-xs text-muted-foreground">{pendingUser.email}</p>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{new Date(pendingUser.created_at).toLocaleDateString()}</span>
                </div>
              ))}
              {!pendingUsers.length && <p className="text-sm text-muted-foreground">No pending administrative actions.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-primary text-white">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Compliance Radar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-white/80 mb-6">Live compliance summary based on current employee, department, and approval records.</p>
            <div className="space-y-4">
              <div className="bg-white/10 p-4 rounded-xl">
                <p className="text-xs font-bold uppercase tracking-wider mb-1">Upcoming Audit</p>
                <p className="text-sm">{departments.length} active departments in the organization directory.</p>
              </div>
              <div className="bg-white/10 p-4 rounded-xl">
                <p className="text-xs font-bold uppercase tracking-wider mb-1">Missing Records</p>
                <p className="text-sm">{employees.filter((employee) => !employee.national_id).length} employees missing national IDs.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
