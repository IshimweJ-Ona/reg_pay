"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  RefreshCw01 as RotateCw,
  Percent01 as Percent,
  Plus,
  Trash01 as Trash2,
  Loading02 as Loader2,
  Zap,
  ShieldTick as ShieldCheck,
} from '@untitledui/icons';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/context/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { getMonthlyTaxes, updateMonthlyTax, deactivateMonthlyTax, MonthlyTax } from '@/api/system-config';
import { useToast } from '@/hooks/use-toast';
import { userFriendlyError } from '@/lib/error-message';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingState, PermissionDeniedState, TableStateRow } from '@/components/layout/page-state';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';

const isPitTax = (name: string) => {
  const normalized = name.toLowerCase().replace(/[^a-z]/g, '');
  return normalized === 'pit' || normalized.includes('personalincometax') || normalized.includes('paye');
};

export default function TaxSetupPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const canManageConfig = hasPermission('system-config.manage');

  const [taxes, setTaxes] = useState<MonthlyTax[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newTax, setNewTax] = useState({ name: '', rate: '' });

  useEffect(() => {
    if (user && !canManageConfig) {
      router.replace(`/${params.role}/${params.uuid}`);
      return;
    }
    loadTaxes();
    // Keyed on user?.id, not the whole user object - see the matching note
    // in [role]/[uuid]/page.tsx (the background permissions poll gives
    // `user` a new reference every ~15s even when nothing changed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, canManageConfig, router, params.role, params.uuid]);

  const loadTaxes = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getMonthlyTaxes();
      setTaxes(data);
    } catch (error: any) {
      console.error('Failed to load taxes:', error);
      const message = userFriendlyError(error, 'Could not retrieve tax configurations.');
      setLoadError(message);
      toast({
        variant: "destructive",
        title: "Load Failed",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTax = async () => {
    if (!newTax.name.trim() || !newTax.rate) {
      toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please provide both tax name and rate.' });
      return;
    }

    setSaving(true);
    try {
      await updateMonthlyTax(newTax.name.trim(), Number(newTax.rate));
      await loadTaxes();
      setNewTax({ name: '', rate: '' });
      toast({
        title: 'Success',
        description: isPitTax(newTax.name)
          ? 'PIT rate saved. The effective-date rule will be applied by payroll.'
          : 'Tax policy saved. It is now available for assignment in the employee update form.',
      });
    } catch (error: any) {
      console.error('Failed to create tax:', error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: userFriendlyError(error, 'Could not save this tax policy.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTax = async (uuid: string) => {
    try {
      await deactivateMonthlyTax(uuid);
      await loadTaxes();
      toast({ title: 'Success', description: 'Tax deactivated successfully.' });
    } catch (error: any) {
      console.error('Failed to deactivate tax:', error);
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: userFriendlyError(error, 'Could not deactivate this tax policy.'),
      });
    }
  };

  if (!user) {
    return (
      <LoadingState
        title="Loading tax setup"
        description="Checking your session and configuration permissions."
      />
    );
  }

  if (!canManageConfig) {
    return (
      <PermissionDeniedState
        title="Tax setup permission required"
        description="Only administrators with system configuration access can change payroll tax policies."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tax Setup"
        description="Manage PIT and employee-assigned monthly tax policies."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon={<Percent className="h-6 w-6" size={24} />} label="Active Taxes" value={taxes.length} tone="primary" />
        <StatCard icon={<Zap className="h-6 w-6" size={24} />} label="Effective Rule" value="1st / Next" tone="success" />
        <StatCard icon={<ShieldCheck className="h-6 w-6" size={24} />} label="Policy Control" value="PIT Auto" tone="info" />
      </div>

      <Card className="border border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Manage Group Taxes</CardTitle>
              <CardDescription>PIT/PAYE applies automatically to monthly employees. Other taxes are available as employee-level deductions.</CardDescription>
            </div>
            <Button variant="outline" className="gap-2" onClick={loadTaxes} disabled={loading}>
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} size={16} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_150px] gap-4 items-end bg-secondary/20 p-4 rounded-lg border border-dashed">
            <div className="space-y-2">
              <Label>Tax Name</Label>
              <Input 
                placeholder="e.g. PAYE (Income Tax), RSSB Pension, Maternity Leave Fund"
                value={newTax.name}
                onChange={(e) => setNewTax(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Rate (%)</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00" 
                value={newTax.rate}
                onChange={(e) => setNewTax(prev => ({ ...prev, rate: e.target.value }))}
              />
            </div>
            <Button className="h-10 shadow-md" onClick={handleCreateTax} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" size={16} /> : <Plus className="h-4 w-4 mr-2" size={16} />}
              Save Tax Policy
            </Button>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Tax Name</TableHead>
                  <TableHead>Current Rate</TableHead>
                  <TableHead>Effective Since</TableHead>
                  <TableHead>Payroll Use</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableStateRow
                    colSpan={6}
                    tone="info"
                    title="Loading tax policies"
                    description="Preparing PIT rules and employee-assigned monthly deductions."
                  />
                ) : loadError ? (
                  <TableStateRow
                    colSpan={6}
                    tone="destructive"
                    title="Tax policies could not load"
                    description={loadError}
                  />
                ) : taxes.length > 0 ? taxes.map((tax) => (
                  <TableRow key={tax.uuid} className="hover:bg-secondary/10 transition-colors">
                    <TableCell className="font-bold">{tax.name}</TableCell>
                    <TableCell className="font-mono text-success font-bold">{tax.rate}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(tax.effective_from).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {tax.is_automatic ? (
                        <StatusBadge tone="info" label="Automatic PIT" />
                      ) : (
                        <Badge variant="outline">Assign to Employee</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone="success" label="Active" />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteTax(tax.uuid)}
                        disabled={tax.uuid === 'default-pit'}
                        aria-label={`Deactivate ${tax.name}`}
                        title={tax.uuid === 'default-pit' ? 'Default PIT cannot be deactivated' : `Deactivate ${tax.name}`}
                      >
                        <Trash2 className="h-4 w-4" size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableStateRow
                    colSpan={6}
                    title="No statutory taxes configured"
                    description="Save PIT, RSSB, or other monthly tax policies before assigning them to employees."
                  />
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
