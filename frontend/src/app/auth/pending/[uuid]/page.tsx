"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/auth-context';
import { User, Mail, Bell, Clock, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PendingApprovalPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Profile Section */}
        <Card className="md:col-span-1 shadow-md border-t-4 border-t-blue-600">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              Profile Section
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center py-4">
              <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center mb-3">
                <User className="h-10 w-10 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg">{user?.name}</h3>
              <Badge variant="outline" className="mt-1 text-orange-600 border-orange-200 bg-orange-50">
                PENDING APPROVAL
              </Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role:</span>
                <span className="font-medium">{user?.role}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={logout}>
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Card className="md:col-span-2 shadow-lg border-t-4 border-t-red-600">
          <CardHeader className="bg-red-50/50">
            <CardTitle className="text-xl text-red-700 flex items-center gap-2">
              <ShieldAlert className="h-6 w-6" />
              Registration Pending
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="bg-white border-l-4 border-l-orange-500 p-6 rounded-r-lg shadow-sm">
              <p className="text-lg leading-relaxed text-slate-700">
                Administrators will approve of your registrations and grant permission to you to operate on the system. 
                <span className="block mt-4 font-semibold text-slate-900">
                  Come back after 72hrs if not yet then contact this email: 
                  <a href="mailto:admin@regpay.local" className="text-red-600 hover:underline ml-1">
                    admin@regpay.local
                  </a>
                </span>
                <span className="block mt-2">Thank you for registering on the system.</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <Clock className="h-5 w-5 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-semibold text-sm">Wait Time</h4>
                  <p className="text-xs text-muted-foreground">Up to 72 hours for verification</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg">
                <Mail className="h-5 w-5 text-blue-500 mt-1" />
                <div>
                  <h4 className="font-semibold text-sm">Contact Admin</h4>
                  <p className="text-xs text-muted-foreground">admin@regpay.local</p>
                </div>
              </div>
            </div>

            {/* Notification Section */}
            <div className="mt-8">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <Bell className="h-5 w-5 text-red-600" />
                Notification Section
              </h3>
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-blue-500" />
                  <p className="text-sm text-blue-800">Your registration has been submitted successfully.</p>
                </div>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-slate-300" />
                  <p className="text-sm text-slate-600">Awaiting administrator review.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
