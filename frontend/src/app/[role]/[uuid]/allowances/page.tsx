"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  RefreshCw01 as RotateCw,
  Coins01 as Coins,
  Plus,
  Trash01 as Trash2,
  Edit05 as Edit,
  Loading02 as Loader2,
  Check,
  X,
} from '@untitledui/icons';
import { Button } from '@/components/ui/button';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/context/auth-context';
import { useRouter, useParams } from 'next/navigation';
import {
  getAllowanceTypes,
  createAllowanceType,
  updateAllowanceType,
  type AllowanceType,
} from '@/api/payment-structures';
import { useToast } from '@/hooks/use-toast';
import { userFriendlyError } from '@/lib/error-message';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingState, PermissionDeniedState, TableStateRow } from '@/components/layout/page-state';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatRwf } from '@/lib/payroll-display';

export default function AllowanceSetupPage() {
  const { user, hasPermission } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const canManageAllowances = hasPermission('allowances.manage');

  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState({ name: '', default_amount: '', description: '' });
  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  useEffect(() => {
    if (user && !canManageAllowances) {
      router.replace(`/${params.role}/${params.uuid}`);
      return;
    }
    loadAllowanceTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, canManageAllowances, router, params.role, params.uuid]);

  const loadAllowanceTypes = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getAllowanceTypes(true);
      setAllowanceTypes(data);
    } catch (error: any) {
      console.error('Failed to load allowance types:', error);
      const message = userFriendlyError(error, 'Could not retrieve allowance types.');
      setLoadError(message);
      toast({ variant: "destructive", title: "Load Failed", description: message });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newType.name.trim() || !newType.default_amount) {
      toast({ variant: 'destructive', title: 'Invalid Input', description: 'Please provide both a name and a default amount.' });
      return;
    }

    setSaving(true);
    try {
      await createAllowanceType({
        name: newType.name.trim(),
        default_amount: newType.default_amount,
        description: newType.description.trim() || undefined,
      });
      await loadAllowanceTypes();
      setNewType({ name: '', default_amount: '', description: '' });
      toast({
        title: 'Success',
        description: 'Allowance type saved. It is now pickable from the dropdown on Positions and Employees.',
      });
    } catch (error: any) {
      console.error('Failed to create allowance type:', error);
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: userFriendlyError(error, 'Could not save this allowance type.'),
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (type: AllowanceType) => {
    setEditingUuid(type.uuid);
    setEditAmount(type.default_amount);
  };

  const handleSaveEdit = async (uuid: string) => {
    try {
      await updateAllowanceType(uuid, { default_amount: editAmount });
      await loadAllowanceTypes();
      setEditingUuid(null);
      toast({ title: 'Success', description: 'Default amount updated.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: userFriendlyError(error, 'Could not update this allowance type.'),
      });
    }
  };

  const handleToggleActive = async (type: AllowanceType) => {
    try {
      await updateAllowanceType(type.uuid, { is_active: !type.is_active });
      await loadAllowanceTypes();
      toast({ title: 'Success', description: type.is_active ? 'Allowance type deactivated.' : 'Allowance type reactivated.' });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: userFriendlyError(error, 'Could not update this allowance type.'),
      });
    }
  };

  if (!user) {
    return (
      <LoadingState
        title="Loading allowance setup"
        description="Checking your session and configuration permissions."
      />
    );
  }

  if (!canManageAllowances) {
    return (
      <PermissionDeniedState
        title="Allowance setup permission required"
        description="Only staff with allowances.manage can create or edit the allowance catalog."
      />
    );
  }

  const activeCount = allowanceTypes.filter((t) => t.is_active).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Allowance Setup"
        description="Define the allowance catalog that Positions and Employees pick from — one place to manage names and default amounts."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard icon={<Coins className="h-6 w-6" size={24} />} label="Active Allowance Types" value={activeCount} tone="primary" />
        <StatCard icon={<Coins className="h-6 w-6" size={24} />} label="Total Defined" value={allowanceTypes.length} tone="info" />
      </div>

      <Card className="border border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Manage Allowance Types</CardTitle>
              <CardDescription>Positions and Employees attach allowances by picking one of these from a dropdown — the default amount here is just a starting suggestion and can still be overridden per attachment.</CardDescription>
            </div>
            <Button variant="outline" className="gap-2" onClick={loadAllowanceTypes} disabled={loading}>
              <RotateCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} size={16} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_160px_1fr_150px] gap-4 items-end bg-secondary/20 p-4 rounded-lg border border-dashed">
            <div className="space-y-2">
              <Label>Allowance Name</Label>
              <Input
                placeholder="e.g. Transport Allowance"
                value={newType.name}
                onChange={(e) => setNewType(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Default Amount (RWF)</Label>
              <Input
                type="number"
                placeholder="e.g. 25000"
                value={newType.default_amount}
                onChange={(e) => setNewType(prev => ({ ...prev, default_amount: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="e.g. Covers commuting costs"
                value={newType.description}
                onChange={(e) => setNewType(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <Button className="h-10 shadow-md" onClick={handleCreate} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" size={16} /> : <Plus className="h-4 w-4 mr-2" size={16} />}
              Save
            </Button>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-secondary/30">
                <TableRow>
                  <TableHead>Allowance Name</TableHead>
                  <TableHead>Default Amount</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableStateRow
                    colSpan={5}
                    tone="info"
                    title="Loading allowance types"
                    description="Preparing the allowance catalog."
                  />
                ) : loadError ? (
                  <TableStateRow
                    colSpan={5}
                    tone="destructive"
                    title="Allowance types could not load"
                    description={loadError}
                  />
                ) : allowanceTypes.length > 0 ? allowanceTypes.map((type) => (
                  <TableRow key={type.uuid} className="hover:bg-secondary/10 transition-colors">
                    <TableCell className="font-bold">{type.name}</TableCell>
                    <TableCell className="font-mono text-success font-bold">
                      {editingUuid === type.uuid ? (
                        <Input
                          type="number"
                          className="h-8 w-32"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          autoFocus
                        />
                      ) : (
                        formatRwf(Number(type.default_amount))
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{type.description || '—'}</TableCell>
                    <TableCell>
                      <StatusBadge tone={type.is_active ? "success" : "secondary"} label={type.is_active ? "Active" : "Inactive"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {editingUuid === type.uuid ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-success hover:bg-success/10"
                              onClick={() => handleSaveEdit(type.uuid)}
                              aria-label={`Save ${type.name}`}
                            >
                              <Check className="h-4 w-4" size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingUuid(null)}
                              aria-label="Cancel edit"
                            >
                              <X className="h-4 w-4" size={16} />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => startEdit(type)}
                              aria-label={`Edit ${type.name}`}
                            >
                              <Edit className="h-4 w-4" size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleToggleActive(type)}
                              aria-label={type.is_active ? `Deactivate ${type.name}` : `Reactivate ${type.name}`}
                              title={type.is_active ? 'Deactivate' : 'Reactivate'}
                            >
                              <Trash2 className="h-4 w-4" size={16} />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableStateRow
                    colSpan={5}
                    title="No allowance types configured"
                    description="Add an allowance type before it can be picked from Positions or Employees."
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
