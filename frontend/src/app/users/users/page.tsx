"use client";

import React from 'react';
import { useAuth } from '@/context/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PermissionGate } from '@/components/auth/permission-gate';
import { 
  Clock, ShieldAlert, Bell, FileText, 
  Calendar, Users, CreditCard, ChevronRight,
  Plus, Building2, MapPin, Activity, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function UserDashboard() {
  const { user } = useAuth();

  // Handle Pending Registration State
  if (user?.status === 'PENDING') {
    return (
      <div className="space-y-8 max-w-4xl mx-auto py-12">
        <div className="text-center space-y-4">
          <div className="mx-auto w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center mb-6 border border-amber-100 shadow-inner">
            <Clock className="h-12 w-12 text-amber-500 animate-pulse" />
          </div>
          <h1 className="text-4xl font-headline font-bold text-slate-900">Registration Pending</h1>
          <p className="text-lg text-muted-foreground">Welcome to REG(Rwanda Energy Group), <span className="text-primary font-bold">{user.name}</span>. Your account is currently in the corporate review queue.</p>
        </div>

        <Card className="border-2 border-dashed border-amber-200 bg-amber-50/20 shadow-none">
          <CardContent className="py-10 px-10 text-center">
            <div className="flex flex-col items-center gap-6">
              <ShieldAlert className="h-14 w-14 text-amber-400" />
              <div className="space-y-2">
                <p className="font-bold text-xl text-slate-800">Identity Verification Required</p>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Administrators must verify your corporate role and assign functional permissions before you can access the payroll and operational modules.
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

  // Active Dashboard for Approved Users
  return (
    <div className="space-y-10 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b pb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-headline font-bold text-slate-900 tracking-tight">Enterprise Console</h1>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-3">Authenticated</Badge>
          </div>
          <p className="text-muted-foreground text-lg">Welcome back, <span className="font-semibold text-slate-700">{user?.name}</span>. Managed payroll and operational modules are active below.</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border">
           <div className="px-4 border-r">
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Permissions</p>
             <p className="text-lg font-bold text-primary">{user?.permissions.length || 0}</p>
           </div>
           <div className="px-4">
             <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Status</p>
             <div className="flex items-center gap-2">
               <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
               <p className="text-lg font-bold text-emerald-600">Optimal</p>
             </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column - Main Action Hub */}
        <div className="lg:col-span-3 space-y-8">
          <section>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Core Operations
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Payroll Section */}
              {(user?.permissions.some(p => p.startsWith('payroll.'))) && (
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
                    <CardDescription>Execute salary batches, review slips, and manage disbursement rails.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <PermissionGate permission="payroll.create">
                        <Link href="/users/users/payroll" className="w-full">
                          <Button className="w-full justify-between h-11 bg-slate-900 hover:bg-slate-800 rounded-xl" size="sm">
                            <span className="flex items-center gap-2"><Plus className="h-4 w-4" /> Generate New Batch</span>
                            <ChevronRight className="h-4 w-4 opacity-50" />
                          </Button>
                        </Link>
                      </PermissionGate>
                      <PermissionGate permission="payroll.read">
                        <Link href="/users/users/payroll" className="w-full">
                          <Button variant="outline" className="w-full justify-between h-11 rounded-xl border-dashed" size="sm">
                            <span>View Disbursement History</span>
                            <FileText className="h-4 w-4 opacity-50" />
                          </Button>
                        </Link>
                      </PermissionGate>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Employees Section - Hidden from regular users as they don't have a specific page yet */}
              {/* If they have permission, they might need to go to admin but they are guarded. So we hide it for now to avoid broken experience */}

              {/* Attendance Section */}
              {(user?.permissions.some(p => p.startsWith('attendance.'))) && (
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
                    <CardDescription>Monitor workforce punctuality and maintain regional compliance logs.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col gap-2">
                      <Link href="/users/users/attendance" className="w-full">
                        <Button className="w-full justify-between h-11 bg-slate-900 hover:bg-slate-800 rounded-xl" size="sm">
                          <span className="flex items-center gap-2"><Activity className="h-4 w-4" /> Enter Daily Log</span>
                          <ChevronRight className="h-4 w-4 opacity-50" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Financial Section - Hidden from regular users for now */}
            </div>
          </section>

          {/* Fallback for No Specific Permissions */}
          {(!user?.permissions.some(p => p.startsWith('payroll.') || p.startsWith('attendance.'))) && (
            <div className="bg-white border-2 border-dashed rounded-3xl p-12 text-center space-y-4">
              <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border shadow-inner">
                <ShieldAlert className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">No Functional Permissions Assigned</h3>
              <p className="text-muted-foreground max-w-sm mx-auto">Your identity has been verified, but no operational roles have been assigned yet. Please contact your department head.</p>
              <Link href="/users/users/profile">
                <Button variant="outline" className="rounded-xl px-8 h-11 mt-4">Complete Profile Setup</Button>
              </Link>
            </div>
          )}
        </div>

        {/* Right Column - Status & Notifications */}
        <div className="space-y-8">
           <Card className="border-none shadow-sm bg-slate-900 text-white rounded-3xl overflow-hidden">
             <div className="p-6 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-bold tracking-tight">System Alerts</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">Infrastructure</p>
                    <p className="text-sm font-medium leading-relaxed group-hover:text-primary transition-colors">SWIFT Protocol update scheduled for 02:00 AM.</p>
                    <span className="text-[9px] text-white/40 block mt-2">2H AGO</span>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/10 hover:bg-white/10 transition-colors cursor-pointer group">
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.2em] mb-1">Compliance</p>
                    <p className="text-sm font-medium leading-relaxed group-hover:text-emerald-400 transition-colors">Q3 Tax report has been successfully archived.</p>
                    <span className="text-[9px] text-white/40 block mt-2">5H AGO</span>
                  </div>
                </div>

                <Button variant="ghost" className="w-full h-11 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5">
                  View Audit Archive
                </Button>
             </div>
           </Card>

           <Card className="border-none shadow-sm rounded-3xl overflow-hidden">
              <CardHeader className="bg-secondary/20 pb-4">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" /> Regional Context
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between border-b pb-4">
                   <div className="flex items-center gap-3">
                     <Building2 className="h-5 w-5 text-muted-foreground" />
                     <span className="text-sm font-medium">Department</span>
                   </div>
                   <span className="text-sm font-bold text-primary">{user?.department || 'Unassigned'}</span>
                </div>
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <MapPin className="h-5 w-5 text-muted-foreground" />
                     <span className="text-sm font-medium">Location</span>
                   </div>
                   <span className="text-sm font-bold text-primary">{user?.location || 'Unassigned'}</span>
                </div>
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
