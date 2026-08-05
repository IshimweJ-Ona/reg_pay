"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/auth-context';
import { User01, Mail01, Bell01, Clock, AlertTriangle } from '@untitledui/icons';
import { Badge } from '@/components/ui/badge';

export default function PendingApprovalPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* Profile Section */}
        <Card className="md:col-span-1 shadow-md border-t-4 border-t-accent">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-foreground">
              <User01 className="h-5 w-5 text-black" size={20} />
              Profile Section
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center py-4">
              <div className="h-20 w-20 rounded-full bg-accent/10 flex items-center justify-center mb-3">
                <User01 className="h-10 w-10 text-black" size={40} />
              </div>
              <h3 className="font-bold text-lg text-foreground">{user?.name}</h3>
              <Badge variant="outline" className="mt-1 text-destructive border-destructive/30 bg-destructive/10">
                PENDING APPROVAL
              </Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium text-foreground">{user?.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Role:</span>
                <span className="font-medium text-foreground">{user?.role}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full mt-4" onClick={logout}>
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* Main Content */}
        <Card className="md:col-span-2 shadow-lg border-t-4 border-t-destructive">
          <CardHeader className="bg-destructive/5">
            <CardTitle className="text-xl text-destructive flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" size={24} />
              Registration Pending
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="bg-card border-l-4 border-l-destructive p-6 rounded-r-lg shadow-sm">
              <p className="text-lg leading-relaxed text-foreground/80">
                Administrators will approve of your registrations and grant permission to you to operate on the system.
                <span className="block mt-4 font-semibold text-foreground">
                  Come back after 72hrs if not yet then contact this email:
                  <a href="mailto:admin@regpay.local" className="text-primary hover:underline ml-1">
                    admin@regpay.local
                  </a>
                </span>
                <span className="block mt-2">Thank you for registering on the system.</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <Clock className="h-5 w-5 text-black mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Wait Time</h4>
                  <p className="text-xs text-muted-foreground">Up to 72 hours for verification</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-muted rounded-lg">
                <Mail01 className="h-5 w-5 text-black mt-1" size={20} />
                <div>
                  <h4 className="font-semibold text-sm text-foreground">Contact Admin</h4>
                  <p className="text-xs text-muted-foreground">admin@regpay.local</p>
                </div>
              </div>
            </div>

            {/* Notification Section */}
            <div className="mt-8">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4 text-foreground">
                <Bell01 className="h-5 w-5 text-black" size={20} />
                Notification Section
              </h3>
              <div className="space-y-3">
                <div className="p-4 bg-accent/5 border border-accent/15 rounded-lg flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-accent" />
                  <p className="text-sm text-foreground">Your registration has been submitted successfully.</p>
                </div>
                <div className="p-4 bg-muted border border-border rounded-lg flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">Awaiting administrator review.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
