"use client";

import React, { useEffect, useState, useMemo, Suspense } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Coins01 as Coins, SearchMd as Search, UserPlus01 as UserPlus, Edit05 as Edit,
  Users01 as Users, PiggyBank01 as PiggyBank, Clipboard, LineChartUp03 as TrendingUp, Trash01 as Trash2
} from '@untitledui/icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { getEmployees } from '@/api/employees';
import {
  getIkiminaMemberships,
  createIkiminaMembership,
  updateIkiminaMembership,
  removeIkiminaMembership,
} from '@/api/ikimina';
import { userFriendlyError } from '@/lib/error-message';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';

const formatRwf = (value: number) => `RWF ${value.toLocaleString()}`;

function IkiminaManagementContent() {
  const { user, hasPermission, accessToken } = useAuth();
  const { toast } = useToast();

  const [memberships, setMemberships] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedMembership, setSelectedMembership] = useState<any | null>(null);
  const [removeTarget, setRemoveTarget] = useState<any | null>(null);
  const [removing, setRemoving] = useState(false);

  // Form States
  const [newMemberEmployeeId, setNewMemberEmployeeId] = useState('');
  const [newMemberAmount, setNewMemberAmount] = useState('');
  const [editMemberAmount, setEditMemberAmount] = useState('');
  const [editMemberActive, setEditMemberActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canManage = hasPermission('ikimina.manage');
  const permissionSignature = (user?.permissions ?? []).join('|');

  const loadData = async () => {
    setLoading(true);
    try {
      const [membershipsData, employeesData] = await Promise.all([
        getIkiminaMemberships(),
        getEmployees().catch(() => ({ employees: [] })),
      ]);
      setMemberships(membershipsData);
      setEmployees(employeesData.employees || (Array.isArray(employeesData) ? employeesData : []));
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to load savings data',
        description: userFriendlyError(error),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accessToken, user?.id, permissionSignature]);

  // Filtered lists
  const filteredMemberships = useMemo(() => {
    return memberships.filter((m) => {
      const name = `${m.employee?.first_name ?? ''} ${m.employee?.last_name ?? ''}`.toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || 
        (m.employee?.department?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.employee?.working_location?.name ?? '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'ALL' || 
        (statusFilter === 'ACTIVE' && m.is_active) || 
        (statusFilter === 'INACTIVE' && !m.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [memberships, searchTerm, statusFilter]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalSavings = memberships.reduce((sum, m) => sum + (m.total_savings ?? 0), 0);
    const activeMembers = memberships.filter((m) => m.is_active);
    const totalActive = activeMembers.length;
    const monthlyExpected = activeMembers.reduce((sum, m) => sum + (m.monthly_amount ?? 0), 0);
    const averageSaving = totalActive > 0 ? totalSavings / totalActive : 0;

    return {
      totalSavings,
      totalActive,
      monthlyExpected,
      averageSaving,
    };
  }, [memberships]);

  // Filter employees eligible for new membership:
  // Must be MONTHLY payroll frequency, and not already have a membership
  const eligibleEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const freq = emp.payment_structures?.[0]?.payroll_frequency || emp.employment_category?.payroll_frequency;
      if (freq !== 'MONTHLY') return false;
      
      const alreadyMember = memberships.some((m) => m.employee_id === emp.id);
      return !alreadyMember;
    });
  }, [employees, memberships]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberEmployeeId || !newMemberAmount) {
      toast({ variant: 'destructive', title: 'Input Required', description: 'Please choose an employee and specify the monthly amount.' });
      return;
    }

    setSubmitting(true);
    try {
      await createIkiminaMembership({
        employee_id: newMemberEmployeeId,
        monthly_amount: Number(newMemberAmount),
        is_active: true,
      });

      toast({ title: 'Success', description: 'Employee registered to Ikimina savings module.' });
      setIsRegisterOpen(false);
      setNewMemberEmployeeId('');
      setNewMemberAmount('');
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Registration failed',
        description: error?.response?.data?.message || 'Could not register employee.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (membership: any) => {
    setSelectedMembership(membership);
    setEditMemberAmount(membership.monthly_amount.toString());
    setEditMemberActive(membership.is_active);
    setIsEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMembership || !editMemberAmount) return;

    setSubmitting(true);
    try {
      await updateIkiminaMembership(selectedMembership.uuid, {
        monthly_amount: Number(editMemberAmount),
        is_active: editMemberActive,
      });

      toast({ title: 'Success', description: 'Ikimina membership updated successfully.' });
      setIsEditOpen(false);
      setSelectedMembership(null);
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update failed',
        description: error?.response?.data?.message || 'Could not update membership.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;

    setRemoving(true);
    try {
      await removeIkiminaMembership(removeTarget.uuid);
      toast({ title: 'Success', description: 'Employee removed from Ikimina savings.' });
      setRemoveTarget(null);
      loadData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Removal failed',
        description: error?.response?.data?.message || 'Could not remove membership.',
      });
    } finally {
      setRemoving(false);
    }
  };

  // Extract all contributions for a Ledger tab
  const allContributions = useMemo(() => {
    const list: any[] = [];
    memberships.forEach((m) => {
      if (m.contributions) {
        m.contributions.forEach((c: any) => {
          list.push({
            ...c,
            employeeName: `${m.employee?.first_name ?? ''} ${m.employee?.last_name ?? ''}`.trim(),
            department: m.employee?.department?.name ?? '—',
            workingLocation: m.employee?.working_location?.name ?? '—',
          });
        });
      }
    });
    return list.sort((a, b) => new Date(b.contribution_date).getTime() - new Date(a.contribution_date).getTime());
  }, [memberships]);

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Ikimina Savings"
        description="Manage employee savings plans and recurring payroll deductions."
        actions={
          canManage && (
            <Button
              className="gap-2 shadow-lg shadow-primary/20"
              onClick={() => setIsRegisterOpen(true)}
            >
              <UserPlus className="h-4 w-4" size={16} /> Register Savings Plan
            </Button>
          )
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          tone="primary"
          icon={<Coins className="h-5 w-5" size={20} />}
          label="Total Savings Pool"
          value={formatRwf(stats.totalSavings)}
        />
        <StatCard
          tone="success"
          icon={<Users className="h-5 w-5" size={20} />}
          label="Active Members"
          value={`${stats.totalActive} Employees`}
        />
        <StatCard
          tone="info"
          icon={<TrendingUp className="h-5 w-5" size={20} />}
          label="Monthly Pool Growth"
          value={`+${formatRwf(stats.monthlyExpected)} / mo`}
        />
        <StatCard
          tone="warning"
          icon={<PiggyBank className="h-5 w-5" size={20} />}
          label="Average Contribution Pool"
          value={formatRwf(stats.averageSaving)}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="w-full">
        <TabsList className="bg-card border border-border p-1 h-12 rounded-xl mb-6">
          <TabsTrigger value="members" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Users className="h-4 w-4" size={16} /> Active Members ({filteredMemberships.length})
          </TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2 px-6 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Clipboard className="h-4 w-4" size={16} /> Contribution Ledger ({allContributions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" size={16} />
              <Input
                placeholder="Search member by name, department, or working location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('ALL')}
                size="sm"
              >
                All Status
              </Button>
              <Button
                variant={statusFilter === 'ACTIVE' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('ACTIVE')}
                size="sm"
                className={statusFilter === 'ACTIVE' ? '' : 'text-success hover:text-success'}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'INACTIVE' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('INACTIVE')}
                size="sm"
                className={statusFilter === 'INACTIVE' ? '' : 'text-destructive hover:text-destructive'}
              >
                Inactive
              </Button>
            </div>
          </div>

          {/* Members Table */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Working Location</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="text-right">Monthly Deduction</TableHead>
                    <TableHead className="text-right">Total Savings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined At</TableHead>
                    {canManage && <TableHead className="w-[100px]">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">
                        Loading memberships...
                      </TableCell>
                    </TableRow>
                  ) : filteredMemberships.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">
                        No Ikimina savings plans found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMemberships.map((m) => (
                      <TableRow key={m.uuid} className="hover:bg-secondary/10 transition-colors">
                        <TableCell className="font-semibold">{`${m.employee?.first_name ?? ''} ${m.employee?.last_name ?? ''}`.trim()}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.employee?.working_location?.name ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{m.employee?.department?.name ?? '—'}</TableCell>
                        <TableCell className="text-right font-medium">{formatRwf(m.monthly_amount)}</TableCell>
                        <TableCell className="text-right font-bold text-success">{formatRwf(m.total_savings ?? 0)}</TableCell>
                        <TableCell>
                          <StatusBadge
                            label={m.is_active ? 'Active' : 'Inactive'}
                            tone={m.is_active ? 'success' : 'destructive'}
                          />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(m.joined_at).toLocaleDateString()}</TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(m)}
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              >
                                <Edit className="h-4 w-4" size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRemoveTarget(m)}
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" size={16} />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          {/* Ledger Table */}
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Working Location</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Batch Code / Reference</TableHead>
                    <TableHead className="text-right">Deducted Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Loading contributions ledger...
                      </TableCell>
                    </TableRow>
                  ) : allContributions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No transactions recorded in the savings ledger.
                      </TableCell>
                    </TableRow>
                  ) : (
                    allContributions.map((c) => (
                      <TableRow key={c.uuid} className="hover:bg-secondary/10 transition-colors">
                        <TableCell className="text-sm font-medium">{new Date(c.contribution_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-semibold">{c.employeeName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.workingLocation}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.department}</TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">
                          {c.payroll_batch_id ? `Payroll Batch` : 'Manual Adjustment'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-success">+{formatRwf(c.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal: Register Member */}
      <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register Employee Savings Plan</DialogTitle>
            <DialogDescription>
              Assign a monthly Ikimina savings plan to an employee. Deductions are processed automatically during payroll generation. Only MONTHLY employees are eligible.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="employee">Employee</Label>
              <Select
                value={newMemberEmployeeId || 'none'}
                onValueChange={(value) => setNewMemberEmployeeId(value === 'none' ? '' : value)}
              >
                <SelectTrigger id="employee">
                  <SelectValue placeholder="-- Choose Eligible Monthly Employee --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">-- Choose Eligible Monthly Employee --</SelectItem>
                  {eligibleEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.department?.name || 'No Dept'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eligibleEmployees.length === 0 && (
                <p className="text-xs text-warning font-medium">No monthly employees available or all monthly employees already registered.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Monthly Deduction (RWF)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="e.g. 15000"
                value={newMemberAmount}
                onChange={(e) => setNewMemberAmount(e.target.value)}
                min="100"
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsRegisterOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !newMemberEmployeeId}>
                {submitting ? 'Registering...' : 'Register Plan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Membership */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modify Savings Plan</DialogTitle>
            <DialogDescription>
              Update monthly contribution rate or change active status for {selectedMembership?.employee?.first_name} {selectedMembership?.employee?.last_name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-amount">Monthly Deduction (RWF)</Label>
              <Input
                id="edit-amount"
                type="number"
                value={editMemberAmount}
                onChange={(e) => setEditMemberAmount(e.target.value)}
                min="100"
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="edit-active"
                checked={editMemberActive}
                onCheckedChange={(checked) => setEditMemberActive(checked === true)}
              />
              <Label htmlFor="edit-active" className="cursor-pointer font-medium">
                Active savings plan (deductions will run in next payroll cycle)
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setIsEditOpen(false); setSelectedMembership(null); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm: Remove Member */}
      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from Ikimina Savings?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {removeTarget?.employee?.first_name} {removeTarget?.employee?.last_name} from the savings program. This cannot be undone. If they have contributions already processed through payroll, removal will be blocked — deactivate the plan instead in that case.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function IkiminaManagementPage() {
  return (
    <ProtectedRoute requiredPermission="ikimina.read">
      <Suspense fallback={<div className="p-8 text-muted-foreground text-sm">Loading savings view...</div>}>
        <IkiminaManagementContent />
      </Suspense>
    </ProtectedRoute>
  );
}
