
"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Globe, Save, Database, Loader2, Percent, Plus, Trash2 } from 'lucide-react';
import { getSystemConfigs, updateBatchSystemConfigs, getMonthlyTaxes, updateMonthlyTax, deactivateMonthlyTax } from '@/api/system-config';
import { useToast } from '@/hooks/use-toast';
import {
  createDeductionType,
  getDeductionTypes,
  updateDeductionType,
} from '@/api/payment-structures';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/context/auth-context';

export default function SystemSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDeduction, setSavingDeduction] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
  const [deductionTypes, setDeductionTypes] = useState<any[]>([]);
  const [monthlyTaxes, setMonthlyTaxes] = useState<any[]>([]);
  const [newTax, setNewTax] = useState({ name: '', rate: '' });
  const [newDeduction, setNewDeduction] = useState({
    name: '',
    deduction_mode: 'PERCENTAGE' as 'FIXED' | 'PERCENTAGE',
    amount: '',
    percentage_value: '',
    is_mandatory: true,
  });
  const [configs, setConfigs] = useState<Record<string, string>>({
    currency: 'RWF',
    timezone: 'GMT+2 (Kigali)',
    multiCurrency: 'true',
    twoFactorAuth: 'true',
    sessionTermination: 'true',
    auditLongevity: '7',
    hqName: 'REG Headquarters',
    hqAddress: 'Kigali, Rwanda',
    hqEmail: 'admin@regpay.local',
    hqPhone: ''
  });
  const { toast } = useToast();
  const { hasPermission, user } = useAuth();
  const canManageDeductions = hasPermission('payment-structures.update');
  const isSuperAdmin = (user?.roles ?? []).includes('SUPER_ADMIN');

  useEffect(() => {
    loadConfigs();
  }, []);

  const loadConfigs = async () => {
    try {
      const [data, deductions, taxes] = await Promise.all([
        getSystemConfigs(),
        getDeductionTypes().catch(() => []),
        getMonthlyTaxes().catch(() => []),
      ]);
      const configMap: Record<string, string> = {};
      data.forEach(c => {
        configMap[c.key] = c.value;
      });
      setConfigs(prev => ({ ...prev, ...configMap }));
      setDeductionTypes(Array.isArray(deductions) ? deductions : []);
      setMonthlyTaxes(Array.isArray(taxes) ? taxes : []);
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
        title: "Save failed",
        description: "We could not save these settings. Please check the values and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateVal = (key: string, value: string) => {
    setConfigs(prev => ({ ...prev, [key]: value }));
  };

  const nextMonthLabel = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      .toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  const refreshDeductions = async () => {
    const deductions = await getDeductionTypes();
    setDeductionTypes(Array.isArray(deductions) ? deductions : []);
  };

  const refreshMonthlyTaxes = async () => {
    const taxes = await getMonthlyTaxes();
    setMonthlyTaxes(Array.isArray(taxes) ? taxes : []);
  };

  const handleCreateDeduction = async () => {
    if (!newDeduction.name.trim()) {
      toast({ variant: 'destructive', title: 'Name required', description: 'Please enter a deduction name.' });
      return;
    }

    const value = newDeduction.deduction_mode === 'FIXED'
      ? newDeduction.amount
      : newDeduction.percentage_value;

    if (!value || Number(value) < 0) {
      toast({ variant: 'destructive', title: 'Rate required', description: 'Please enter a valid deduction rate.' });
      return;
    }

    setSavingDeduction(true);
    try {
      await createDeductionType({
        name: newDeduction.name.trim(),
        deduction_mode: newDeduction.deduction_mode,
        amount: newDeduction.deduction_mode === 'FIXED' ? newDeduction.amount : '0',
        percentage_value: newDeduction.deduction_mode === 'PERCENTAGE' ? newDeduction.percentage_value : '0',
        is_mandatory: newDeduction.is_mandatory,
      });
      await refreshDeductions();
      setNewDeduction({
        name: '',
        deduction_mode: 'PERCENTAGE',
        amount: '',
        percentage_value: '',
        is_mandatory: true,
      });
      toast({
        title: 'Deduction created',
        description: newDeduction.is_mandatory
          ? `It will automatically apply from ${nextMonthLabel()}.`
          : 'The deduction type is available for manual assignment.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deduction creation failed',
        description: error?.response?.data?.message ?? 'Please check the deduction details.',
      });
    } finally {
      setSavingDeduction(false);
    }
  };

  const handleUpdateMonthlyTax = async () => {
    if (!newTax.name.trim() || !newTax.rate) {
      toast({ variant: 'destructive', title: 'Invalid tax', description: 'Please provide both tax name and percentage.' });
      return;
    }

    setSavingTax(true);
    try {
      await updateMonthlyTax(newTax.name.trim(), Number(newTax.rate));
      await refreshMonthlyTaxes();
      
      const now = new Date();
      const isFirstDay = now.getDate() === 1;
      const effectiveMonth = isFirstDay 
        ? now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
        : new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

      setNewTax({ name: '', rate: '' });
      toast({
        title: 'Tax updated',
        description: `tax updated will apply automatically to the following month except change on the first day of month then it applies to that month. Otherwise to the following month.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error?.response?.data?.message ?? 'Please try again.',
      });
    } finally {
      setSavingTax(false);
    }
  };

  const handleDeactivateTax = async (uuid: string) => {
    try {
      await deactivateMonthlyTax(uuid);
      await refreshMonthlyTaxes();
      toast({ title: 'Tax deactivated', description: 'The tax will no longer be applied to future payrolls.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deactivation failed',
        description: error?.response?.data?.message ?? 'Please try again.',
      });
    }
  };

  const handleUpdateDeduction = async (deduction: any, patch: Record<string, any>) => {
    setSavingDeduction(true);
    try {
      await updateDeductionType(deduction.uuid, patch);
      await refreshDeductions();
      toast({ title: 'Deduction updated', description: `${deduction.name} has been updated.` });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Deduction update failed',
        description: error?.response?.data?.message ?? 'Please check the value and try again.',
      });
    } finally {
      setSavingDeduction(false);
    }
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
        <h1 className="text-3xl font-headline font-bold">Settings</h1>
        <p className="text-muted-foreground">Update headquarters details, payroll defaults, and security settings.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" /> Headquarters Details
            </CardTitle>
            <CardDescription>These details appear in administrative records and payroll documents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Headquarters Name</Label>
                <Input value={configs.hqName} onChange={(e) => updateVal('hqName', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={configs.hqAddress} onChange={(e) => updateVal('hqAddress', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={configs.hqEmail} onChange={(e) => updateVal('hqEmail', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={configs.hqPhone} onChange={(e) => updateVal('hqPhone', e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" /> Regional Localization
            </CardTitle>
            <CardDescription>Default currency and time zone for payroll processing.</CardDescription>
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

        {isSuperAdmin && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-emerald-600" /> Monthly Statutory Taxes
              </CardTitle>
              <CardDescription>
                Configure taxes applied globally to all Monthly employees. Updates automatically take effect on {nextMonthLabel()}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_120px] gap-3 items-end rounded-lg border p-4 bg-emerald-50/20">
                <div className="space-y-2">
                  <Label>Tax Name</Label>
                  <Input
                    value={newTax.name}
                    onChange={(e) => setNewTax(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. PAYE, Health Insurance"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newTax.rate}
                    onChange={(e) => setNewTax(prev => ({ ...prev, rate: e.target.value }))}
                  />
                </div>
                <Button onClick={handleUpdateMonthlyTax} disabled={savingTax} className="h-10 bg-emerald-600 hover:bg-emerald-700">
                  {savingTax ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Add/Update
                </Button>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-emerald-50/50">
                    <TableRow>
                      <TableHead>Tax Name</TableHead>
                      <TableHead>Current Rate (%)</TableHead>
                      <TableHead>Effective Since</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyTaxes.length > 0 ? monthlyTaxes.map((tax) => (
                      <TableRow key={tax.uuid}>
                        <TableCell className="font-medium">{tax.name}</TableCell>
                        <TableCell className="font-bold text-emerald-700">{tax.rate}%</TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {new Date(tax.effective_from).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeactivateTax(tax.uuid)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                          No monthly taxes configured.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {isSuperAdmin && (
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" /> Deductions
              </CardTitle>
              <CardDescription>
                Manage deduction names and rates. New mandatory deductions automatically start for active employees on {nextMonthLabel()}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_150px_150px_120px] gap-3 items-end rounded-lg border p-4">
                <div className="space-y-2">
                  <Label>Deduction Name</Label>
                  <Input
                    value={newDeduction.name}
                    onChange={(event) => setNewDeduction((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="e.g. RSSB Pension"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <select
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={newDeduction.deduction_mode}
                    onChange={(event) => setNewDeduction((prev) => ({
                      ...prev,
                      deduction_mode: event.target.value as 'FIXED' | 'PERCENTAGE',
                      amount: '',
                      percentage_value: '',
                    }))}
                  >
                    <option value="PERCENTAGE">Percentage</option>
                    <option value="FIXED">Fixed</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{newDeduction.deduction_mode === 'FIXED' ? 'Amount' : 'Rate (%)'}</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newDeduction.deduction_mode === 'FIXED' ? newDeduction.amount : newDeduction.percentage_value}
                    onChange={(event) => setNewDeduction((prev) => ({
                      ...prev,
                      [newDeduction.deduction_mode === 'FIXED' ? 'amount' : 'percentage_value']: event.target.value,
                    }))}
                  />
                </div>
                <Button onClick={handleCreateDeduction} disabled={savingDeduction} className="h-10">
                  {savingDeduction ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Create
                </Button>
                <div className="flex items-center gap-2 md:col-span-4">
                  <Switch
                    checked={newDeduction.is_mandatory}
                    onCheckedChange={(checked) => setNewDeduction((prev) => ({ ...prev, is_mandatory: checked }))}
                  />
                  <span className="text-sm text-muted-foreground">Automatically apply this deduction to active employees next month</span>
                </div>
              </div>

              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader className="bg-secondary/40">
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Mandatory</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deductionTypes.length > 0 ? deductionTypes.map((deduction) => {
                      const rate = deduction.deduction_mode === 'FIXED'
                        ? deduction.amount
                        : deduction.percentage_value;

                      return (
                        <TableRow key={deduction.uuid}>
                          <TableCell>
                            <Input
                              defaultValue={deduction.name}
                              onBlur={(event) => {
                                if (event.target.value !== deduction.name) {
                                  handleUpdateDeduction(deduction, { name: event.target.value });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{deduction.deduction_mode}</Badge>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              defaultValue={rate}
                              onBlur={(event) => {
                                if (event.target.value !== rate) {
                                  handleUpdateDeduction(deduction, {
                                    amount: deduction.deduction_mode === 'FIXED' ? event.target.value : '0',
                                    percentage_value: deduction.deduction_mode === 'PERCENTAGE' ? event.target.value : '0',
                                  });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={deduction.is_mandatory}
                              onCheckedChange={(checked) => handleUpdateDeduction(deduction, { is_mandatory: checked })}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    }) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                          No deduction types configured.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

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

