"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { RotateCw } from "lucide-react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Percent, Plus, Trash2, Loader2, Zap, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/context/auth-context';
import { useRouter, useParams } from 'next/navigation';
import { getMonthlyTaxes, updateMonthlyTax, deactivateMonthlyTax, MonthlyTax } from '@/api/system-config';
import { useToast } from '@/hooks/use-toast';

export default function TaxSetupPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const canManageConfig = hasPermission('system-config.manage');

  const [taxes, setTaxes] = useState<MonthlyTax[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newTax, setNewTax] = useState({ name: '', rate: '' });

  useEffect(() => {
    if (user && !canManageConfig) {
      router.replace(`/${params.role}/${params.uuid}`);
      return;
    }
    loadTaxes();
  }, [user, canManageConfig, router, params]);

  const loadTaxes = async () => {
    setLoading(true);
    try {
      const data = await getMonthlyTaxes();
      setTaxes(data);
    } catch (error: any) {
      console.error('Failed to load taxes:', error);
      toast({
        variant: "destructive",
        title: "Load Failed",
        description: "Could not retrieve tax configurations. Check console for details.",
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
        description: `Tax updated will apply automatically.`,
      });
    } catch (error: any) {
      console.error('Failed to create tax:', error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error?.response?.data?.message || "Operation failed.",
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
        description: error?.response?.data?.message || "Operation failed.",
      });
    }
  };

  if (!user || !canManageConfig) return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Tax Setup</h1>
          <p className="text-muted-foreground">Configure statutory taxes applied to group payroll.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Active Taxes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Percent className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{taxes.length}</p>
                <p className="text-xs text-muted-foreground">Configured policies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Next Apply Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Zap className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">1st of Month</p>
                <p className="text-xs text-muted-foreground">Standard payroll cycle</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Policy Control</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <ShieldCheck className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">Enforced</p>
                <p className="text-xs text-muted-foreground">Statutory compliance active</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Manage Group Taxes</CardTitle>
              <CardDescription>Create or update taxes that will be applied to all monthly employees.</CardDescription>
            </div>
            <Button variant="outline" className="gap-2" onClick={loadTaxes} disabled={loading}>
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px_150px] gap-4 items-end bg-secondary/20 p-4 rounded-xl border border-dashed">
            <div className="space-y-2">
              <Label>Tax Name</Label>
              <Input 
                placeholder="e.g. PAYE Rwanda" 
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
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Create New Tax
            </Button>
          </div>

          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Tax Name</TableHead>
                  <TableHead>Current Rate</TableHead>
                  <TableHead>Effective Since</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                     <TableCell colSpan={5} className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></TableCell>
                   </TableRow>
                ) : taxes.length > 0 ? taxes.map((tax) => (
                  <TableRow key={tax.uuid} className="hover:bg-secondary/10 transition-colors">
                    <TableCell className="font-bold">{tax.name}</TableCell>
                    <TableCell className="font-mono text-emerald-700 font-bold">{tax.rate}%</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(tax.effective_from).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTax(tax.uuid)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No statutory taxes configured yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
