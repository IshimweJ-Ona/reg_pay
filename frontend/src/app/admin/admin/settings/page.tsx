
"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Bell, Globe, Mail, Save, Database, Loader2 } from 'lucide-react';
import { getSystemConfigs, updateBatchSystemConfigs } from '@/api/system-config';
import { useToast } from '@/hooks/use-toast';

export default function SystemSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<Record<string, string>>({
    currency: 'RWF',
    timezone: 'GMT+2 (Kigali)',
    multiCurrency: 'true',
    twoFactorAuth: 'true',
    sessionTermination: 'true',
    auditLongevity: '7'
  });
  const { toast } = useToast();

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const data = await getSystemConfigs();
      const configMap: Record<string, string> = {};
      data.forEach(c => {
        configMap[c.key] = c.value;
      });
      setConfigs(prev => ({ ...prev, ...configMap }));
    } catch (error) {
      console.error('Failed to load configs', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const batch = Object.entries(configs).map(([key, value]) => ({
        key,
        value: String(value)
      }));
      await updateBatchSystemConfigs(batch);
      toast({
        title: "Settings Saved",
        description: "System configuration has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Save Failed",
        description: error?.response?.data?.message || "Could not save settings.",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateVal = (key: string, value: string) => {
    setConfigs(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                <Input 
                  value={configs.currency} 
                  onChange={(e) => updateVal('currency', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Audit Time Zone</Label>
                <Input 
                  value={configs.timezone}
                  onChange={(e) => updateVal('timezone', e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Multi-Currency Support</Label>
                <p className="text-xs text-muted-foreground">Allow departments to pay in local currencies.</p>
              </div>
              <Switch 
                checked={configs.multiCurrency === 'true'} 
                onCheckedChange={(val) => updateVal('multiCurrency', String(val))}
              />
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
              <Switch 
                checked={configs.twoFactorAuth === 'true'}
                onCheckedChange={(val) => updateVal('twoFactorAuth', String(val))}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Automated Session Termination</Label>
                <p className="text-xs text-muted-foreground">Lock administrative screens after 15 minutes of inactivity.</p>
              </div>
              <Switch 
                checked={configs.sessionTermination === 'true'}
                onCheckedChange={(val) => updateVal('sessionTermination', String(val))}
              />
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
              <Input 
                type="number" 
                value={configs.auditLongevity}
                onChange={(e) => updateVal('auditLongevity', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={loadConfigs}>Discard Changes</Button>
          <Button 
            className="h-11 px-8 shadow-lg shadow-primary/20" 
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save updates
          </Button>
        </div>
      </div>
    </div>
  );
}

