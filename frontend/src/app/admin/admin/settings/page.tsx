
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Bell, Globe, Mail, Save, Database } from 'lucide-react';

export default function SystemSettingsPage() {
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold">Corporate Configuration</h1>
        <p className="text-muted-foreground">Adjust system-wide parameters and security protocols.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" /> Regional Localization
            </CardTitle>
            <CardDescription>Default currency and time zone for payroll execution.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>System Currency</Label>
                <Input defaultValue="USD" />
              </div>
              <div className="space-y-2">
                <Label>Audit Time Zone</Label>
                <Input defaultValue="GMT+2 (Kigali)" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Multi-Currency Support</Label>
                <p className="text-xs text-muted-foreground">Allow departments to pay in local currencies.</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> Security Policies
            </CardTitle>
            <CardDescription>Enforce enterprise-grade authentication standards.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Two-Factor Authentication (2FA)</Label>
                <p className="text-xs text-muted-foreground">Require 2FA for all users with payroll.approve permissions.</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Automated Session Termination</Label>
                <p className="text-xs text-muted-foreground">Lock administrative screens after 15 minutes of inactivity.</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" /> Data Retention
            </CardTitle>
            <CardDescription>Configure historical data archiving cycles.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Audit Trail Longevity (Years)</Label>
              <Input type="number" defaultValue="7" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline">Discard Changes</Button>
          <Button className="h-11 px-8 shadow-lg shadow-primary/20">
            <Save className="mr-2 h-4 w-4" /> Commit Global Config
          </Button>
        </div>
      </div>
    </div>
  );
}
