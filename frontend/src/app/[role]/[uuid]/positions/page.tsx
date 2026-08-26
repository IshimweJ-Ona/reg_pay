"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Briefcase02 as Briefcase,
  Plus,
  SearchMd as Search,
  Edit05 as Edit,
  Archive,
  Coins01,
  Percent01,
  Trash01,
  LayersTwo02,
} from '@untitledui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Pagination } from '@/components/ui/pagination';
import {
  InlineStateNote,
  LoadingState,
  PermissionDeniedState,
  TableStateRow,
} from '@/components/layout/page-state';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { userFriendlyError } from '@/lib/error-message';
import {
  Position,
  PositionEmploymentCategory,
  EmploymentCategorySummary,
  getPositions,
  getEmploymentCategories,
  createPosition,
  updatePosition,
  archivePosition,
  reactivatePosition,
  attachPositionEmploymentCategory,
  updatePositionEmploymentCategory,
  detachPositionEmploymentCategory,
  attachPositionDeductionType,
  detachPositionDeductionType,
  addPositionAllowanceTemplate,
  removePositionAllowanceTemplate,
} from '@/api/positions';
import { getDeductionTypes, getAllowanceTypes, type AllowanceType } from '@/api/payment-structures';
import { getMonthlyTaxes, MonthlyTax } from '@/api/system-config';

const emptyForm = {
  name: '',
  description: '',
};

const emptyVariantForm = {
  employment_category_id: '',
  default_basic_salary: '',
  default_daily_rate: '',
  default_overtime_rate: '',
  default_custom_work_days: '',
};

// Mirrors the same name-matching used on the employee edit form: a
// deduction_types row is treated as a "tax" if its name matches an active
// monthly_taxes row (PAYE is excluded - it applies automatically and is
// never an opt-in assignment).
const normalizeTaxName = (name?: string) =>
  String(name ?? '').toLowerCase().replace(/[^a-z]/g, '');
const isPitTaxName = (name?: string) => {
  const normalized = normalizeTaxName(name);
  return normalized === 'pit' || normalized.includes('personalincometax') || normalized.includes('paye');
};

export default function PositionsPage() {
  const { isLoading: isAuthLoading, hasPermission } = useAuth();
  const { toast } = useToast();

  const [positions, setPositions] = useState<Position[]>([]);
  const [categories, setCategories] = useState<EmploymentCategorySummary[]>([]);
  const [deductionTypes, setDeductionTypes] = useState<any[]>([]);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
  const [monthlyTaxes, setMonthlyTaxes] = useState<MonthlyTax[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [positionsPage, setPositionsPage] = useState(1);
  const POSITIONS_PAGE_SIZE = 25;
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [detailPosition, setDetailPosition] = useState<Position | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Position | null>(null);
  const [newAllowance, setNewAllowance] = useState({ title: '', default_amount: '', description: '', allowance_type_id: '' });
  const [selectedDeductionTypeId, setSelectedDeductionTypeId] = useState('');
  const [selectedAllowanceTypeId, setSelectedAllowanceTypeId] = useState('');

  const [variantForm, setVariantForm] = useState(emptyVariantForm);
  const [editingVariant, setEditingVariant] = useState<PositionEmploymentCategory | null>(null);
  const [isSavingVariant, setIsSavingVariant] = useState(false);
  const [removeVariantTarget, setRemoveVariantTarget] = useState<PositionEmploymentCategory | null>(null);

  const canManagePositions = hasPermission('positions.manage');
  const canReadPositions = hasPermission('positions.read') || canManagePositions;

  const loadData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [positionsData, categoriesData, deductionTypesData, allowanceTypesData, monthlyTaxesData] = await Promise.all([
        getPositions(statusFilter),
        getEmploymentCategories(),
        getDeductionTypes().catch(() => []),
        getAllowanceTypes().catch(() => []),
        getMonthlyTaxes().catch(() => []),
      ]);
      setPositions(positionsData);
      setCategories(categoriesData);
      setDeductionTypes(Array.isArray(deductionTypesData) ? deductionTypesData : []);
      setAllowanceTypes(Array.isArray(allowanceTypesData) ? allowanceTypesData : []);
      setMonthlyTaxes(Array.isArray(monthlyTaxesData) ? monthlyTaxesData : []);
    } catch (error: any) {
      const message = userFriendlyError(error, "Please check your connection.");
      setLoadError(message);
      toast({
        variant: "destructive",
        title: "Failed to load positions",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthLoading) return;
    if (!canReadPositions) {
      setIsLoading(false);
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthLoading, canReadPositions, statusFilter]);

  // Keep the open detail dialog in sync with the list after any mutation.
  useEffect(() => {
    if (!detailPosition) return;
    const fresh = positions.find((p) => p.uuid === detailPosition.uuid);
    if (fresh) setDetailPosition(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const filteredPositions = useMemo(
    () => positions.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [positions, searchQuery],
  );
  const positionsTotalPages = Math.max(1, Math.ceil(filteredPositions.length / POSITIONS_PAGE_SIZE));
  const paginatedPositions = filteredPositions.slice(
    (positionsPage - 1) * POSITIONS_PAGE_SIZE,
    positionsPage * POSITIONS_PAGE_SIZE,
  );

  useEffect(() => {
    setPositionsPage(1);
  }, [searchQuery]);

  const openCreateForm = () => {
    setEditingPosition(null);
    setForm(emptyForm);
    setIsFormOpen(true);
  };

  const openEditForm = (position: Position) => {
    setEditingPosition(position);
    setForm({
      name: position.name,
      description: position.description ?? '',
    });
    setIsFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name) {
      toast({ variant: "destructive", title: "Missing information", description: "Position name is required." });
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
      };
      if (editingPosition) {
        await updatePosition(editingPosition.uuid, payload);
        toast({ title: "Position updated", description: `${form.name} was saved.` });
      } else {
        await createPosition(payload);
        toast({ title: "Position created", description: `Attach an employment-category variant (Monthly/Daily/Custom) next so employees can be assigned to it.` });
      }
      setIsFormOpen(false);
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Save failed",
        description: userFriendlyError(error, "Please check your input."),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archivePosition(archiveTarget.uuid);
      toast({ title: "Position archived", description: `${archiveTarget.name} no longer appears for new assignments.` });
      setArchiveTarget(null);
      setDetailPosition(null);
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Archive failed",
        description: userFriendlyError(error, "Please try again."),
      });
    }
  };

  const handleReactivatePosition = async (position: Position) => {
    try {
      await reactivatePosition(position.uuid);
      toast({ title: "Position reactivated", description: `${position.name} is available for new assignments again.` });
      setDetailPosition(null);
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Reactivation failed",
        description: userFriendlyError(error, "Please try again."),
      });
    }
  };

  const handleAttachDeductionType = async () => {
    if (!detailPosition || !selectedDeductionTypeId) return;
    try {
      await attachPositionDeductionType(detailPosition.uuid, selectedDeductionTypeId);
      setSelectedDeductionTypeId('');
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not attach deduction type",
        description: userFriendlyError(error, "Please try again."),
      });
    }
  };

  const handleDetachDeductionType = async (deductionTypeUuid: string) => {
    if (!detailPosition) return;
    try {
      await detachPositionDeductionType(detailPosition.uuid, deductionTypeUuid);
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not remove deduction type",
        description: userFriendlyError(error, "Please try again."),
      });
    }
  };

  const handleSelectAllowanceType = (allowanceTypeId: string) => {
    setSelectedAllowanceTypeId(allowanceTypeId);
    const type = allowanceTypes.find((t) => t.id === allowanceTypeId || t.uuid === allowanceTypeId);
    setNewAllowance({
      title: type?.name ?? '',
      default_amount: type?.default_amount ?? '',
      description: type?.description ?? '',
      allowance_type_id: allowanceTypeId,
    });
  };

  const handleAddAllowanceTemplate = async () => {
    if (!detailPosition || !newAllowance.title || !newAllowance.default_amount) return;
    try {
      await addPositionAllowanceTemplate(detailPosition.uuid, newAllowance);
      setNewAllowance({ title: '', default_amount: '', description: '', allowance_type_id: '' });
      setSelectedAllowanceTypeId('');
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not add allowance template",
        description: userFriendlyError(error, "Please try again."),
      });
    }
  };

  const handleRemoveAllowanceTemplate = async (templateUuid: string) => {
    if (!detailPosition) return;
    try {
      await removePositionAllowanceTemplate(detailPosition.uuid, templateUuid);
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not remove allowance template",
        description: userFriendlyError(error, "Please try again."),
      });
    }
  };

  const openAddVariantForm = () => {
    setEditingVariant(null);
    setVariantForm(emptyVariantForm);
  };

  const openEditVariantForm = (variant: PositionEmploymentCategory) => {
    setEditingVariant(variant);
    setVariantForm({
      employment_category_id: variant.employment_category_id,
      default_basic_salary: variant.default_basic_salary ?? '',
      default_daily_rate: variant.default_daily_rate ?? '',
      default_overtime_rate: variant.default_overtime_rate ?? '',
      default_custom_work_days: variant.default_custom_work_days?.toString() ?? '',
    });
  };

  const handleSaveVariant = async () => {
    if (!detailPosition || !variantForm.employment_category_id) return;
    setIsSavingVariant(true);
    try {
      const payload = {
        employment_category_id: variantForm.employment_category_id,
        default_basic_salary: variantForm.default_basic_salary || undefined,
        default_daily_rate: variantForm.default_daily_rate || undefined,
        default_overtime_rate: variantForm.default_overtime_rate || undefined,
        default_custom_work_days: variantForm.default_custom_work_days
          ? Number(variantForm.default_custom_work_days)
          : undefined,
      };
      if (editingVariant) {
        await updatePositionEmploymentCategory(detailPosition.uuid, editingVariant.uuid, payload);
        toast({ title: "Variant updated", description: `${editingVariant.name} defaults were saved.` });
      } else {
        await attachPositionEmploymentCategory(detailPosition.uuid, payload);
        toast({ title: "Variant attached", description: `Employees can now be assigned to ${detailPosition.name} on this category.` });
      }
      setEditingVariant(null);
      setVariantForm(emptyVariantForm);
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not save employment-category variant",
        description: userFriendlyError(error, "Please try again."),
      });
    } finally {
      setIsSavingVariant(false);
    }
  };

  const handleRemoveVariant = async () => {
    if (!detailPosition || !removeVariantTarget) return;
    try {
      await detachPositionEmploymentCategory(detailPosition.uuid, removeVariantTarget.uuid);
      toast({ title: "Variant removed", description: `${removeVariantTarget.name} is no longer offered on ${detailPosition.name}.` });
      setRemoveVariantTarget(null);
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not remove employment-category variant",
        description: userFriendlyError(error, "Transfer affected employees to a different category first."),
      });
    }
  };

  const availableDeductionTypes = deductionTypes.filter(
    (dt) => !detailPosition?.deduction_types.some((d) => d.uuid === dt.uuid),
  );

  const availableCategoriesForVariant = categories.filter(
    (c) => !detailPosition?.employment_categories.some((v) => v.employment_category_id === c.uuid || v.name === c.name)
      || editingVariant?.employment_category_id === c.uuid,
  );

  if (isAuthLoading) {
    return (
      <LoadingState
        title="Loading positions"
        description="Checking position configuration access and payroll defaults."
      />
    );
  }

  if (!canReadPositions) {
    return (
      <PermissionDeniedState
        title="Position access required"
        description="Your current role cannot view job positions or their payroll defaults."
      />
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Positions"
        description="Job titles employees are assigned to. Each position can offer several employment-category variants (Monthly / Daily / Custom), each with its own default pay."
        actions={
          canManagePositions && (
            <Button className="h-11 px-6 shadow-sm shadow-primary/20" onClick={openCreateForm}>
              <Plus className="mr-2 h-4 w-4" size={16} /> Create Position
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          icon={<Briefcase className="h-5 w-5" size={20} />}
          label="Active positions"
          value={positions.filter((p) => p.status === 'ACTIVE').length}
          tone="accent"
        />
        <StatCard
          icon={<LayersTwo02 className="h-5 w-5" size={20} />}
          label="Employment-category variants configured"
          value={positions.reduce((sum, p) => sum + p.employment_categories.length, 0)}
          tone="primary"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" size={16} />
          <Input
            placeholder="Filter by name..."
            className="pl-10 h-11 border border-border bg-card shadow-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex bg-card p-1 rounded-lg border shadow-sm">
          <Button
            type="button"
            variant={statusFilter === 'ACTIVE' ? 'default' : 'ghost'}
            size="sm"
            className="h-9 px-4 rounded-md font-semibold"
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Active
          </Button>
          <Button
            type="button"
            variant={statusFilter === 'INACTIVE' ? 'default' : 'ghost'}
            size="sm"
            className="h-9 px-4 rounded-md font-semibold"
            onClick={() => setStatusFilter('INACTIVE')}
          >
            Archived
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Position</TableHead>
              <TableHead className="font-bold">Employment Category Variants</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableStateRow
                colSpan={4}
                tone="info"
                title="Loading positions"
                description="Preparing employment categories, salary defaults, deductions, and allowance templates."
              />
            ) : loadError ? (
              <TableStateRow
                colSpan={4}
                tone="destructive"
                title="Positions could not load"
                description={loadError}
              />
            ) : filteredPositions.length === 0 ? (
              <TableStateRow
                colSpan={4}
                title="No positions found"
                description="Create a position or adjust the search before assigning payroll defaults."
              />
            ) : (
              paginatedPositions.map((position) => (
                <TableRow
                  key={position.uuid}
                  className="hover:bg-secondary/10 transition-colors cursor-pointer"
                  onClick={() => setDetailPosition(position)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-accent/5 flex items-center justify-center">
                        <Briefcase className="h-5 w-5 text-accent" size={20} />
                      </div>
                      <span className="font-bold text-sm">{position.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {position.employment_categories.length === 0 ? (
                      <span className="text-sm text-muted-foreground">No variants configured</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {position.employment_categories.map((variant) => (
                          <StatusBadge key={variant.uuid} label={variant.name} tone="secondary" />
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={position.status}
                      tone={position.status === 'ACTIVE' ? 'success' : 'warning'}
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {canManagePositions && (
                      position.status === 'INACTIVE' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReactivatePosition(position)}
                          aria-label={`Reactivate ${position.name}`}
                        >
                          Reactivate
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditForm(position)}
                          aria-label={`Edit ${position.name}`}
                        >
                          <Edit className="h-3.5 w-3.5" size={14} />
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination
          page={positionsPage}
          totalPages={positionsTotalPages}
          total={filteredPositions.length}
          limit={POSITIONS_PAGE_SIZE}
          onPageChange={setPositionsPage}
        />
      </div>

      {/* Create/Edit form */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPosition ? 'Edit Position' : 'Create New Position'}</DialogTitle>
            <DialogDescription>
              Positions are what employees are assigned to. Employment-category variants, salary defaults, taxes, and allowances are attached afterward from the position's detail view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Position Name</Label>
              <Input
                placeholder="e.g. Driver"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            {!editingPosition && (
              <InlineStateNote>
                After creating this position, attach at least one employment-category variant (Monthly, Daily, or Custom) from its detail view — a position can offer up to all three, each with its own default salary.
              </InlineStateNote>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingPosition ? 'Save Changes' : 'Create Position'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog: employment-category variants + deduction types + allowance templates */}
      <Dialog
        open={!!detailPosition}
        onOpenChange={(open) => {
          if (!open) {
            setDetailPosition(null);
            setEditingVariant(null);
            setVariantForm(emptyVariantForm);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-6">
              <div>
                <DialogTitle>{detailPosition?.name}</DialogTitle>
                <DialogDescription>
                  {detailPosition?.description || 'No description provided.'}
                </DialogDescription>
              </div>
              {canManagePositions && detailPosition?.status === 'ACTIVE' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive shrink-0"
                  onClick={() => setArchiveTarget(detailPosition)}
                >
                  <Archive className="mr-2 h-4 w-4" size={16} /> Archive
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">
            <div>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                <LayersTwo02 className="h-4 w-4" size={16} /> Employment Category Variants
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                A position can offer up to three variants — Monthly, Daily, and Custom — each with its own default salary. When assigning an employee to this position, the variant chosen determines their payroll frequency, tax behavior, and default pay.
              </p>
              <div className="space-y-2">
                {(detailPosition?.employment_categories ?? []).length === 0 && (
                  <InlineStateNote>
                    No employment-category variants attached yet — employees cannot be assigned to this position until at least one is added.
                  </InlineStateNote>
                )}
                {detailPosition?.employment_categories.map((variant) => (
                  <div key={variant.uuid} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium flex items-center gap-2">
                        {variant.name}
                        <StatusBadge label={variant.payroll_frequency} tone="info" />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {variant.default_basic_salary
                          ? `RWF ${Number(variant.default_basic_salary).toLocaleString()} / mo`
                          : variant.default_daily_rate
                            ? `RWF ${Number(variant.default_daily_rate).toLocaleString()} / day`
                            : 'No default salary set'}
                        {variant.default_overtime_rate ? ` · OT RWF ${Number(variant.default_overtime_rate).toLocaleString()}` : ''}
                        {variant.default_custom_work_days ? ` · ${variant.default_custom_work_days} default work days` : ''}
                      </span>
                    </div>
                    {canManagePositions && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditVariantForm(variant)}
                          aria-label={`Edit ${variant.name} defaults`}
                        >
                          <Edit className="h-3.5 w-3.5" size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRemoveVariantTarget(variant)}
                          aria-label={`Remove ${variant.name} from ${detailPosition?.name}`}
                        >
                          <Trash01 className="h-3.5 w-3.5 text-destructive" size={14} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {canManagePositions && (editingVariant || availableCategoriesForVariant.length > 0) && (
                  <div className="rounded-lg border border-dashed p-3 space-y-3 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs">Employment Category</Label>
                        <Select
                          value={variantForm.employment_category_id}
                          onValueChange={(value) => setVariantForm({ ...variantForm, employment_category_id: value })}
                          disabled={!!editingVariant}
                        >
                          <SelectTrigger><SelectValue placeholder="Select Monthly / Daily / Custom" /></SelectTrigger>
                          <SelectContent>
                            {availableCategoriesForVariant.map((c) => (
                              <SelectItem key={c.uuid} value={c.uuid}>{c.name} ({c.payroll_frequency})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Default Monthly Salary (RWF)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 380000"
                          value={variantForm.default_basic_salary}
                          onChange={(e) => setVariantForm({ ...variantForm, default_basic_salary: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Default Daily Rate (RWF)</Label>
                        <Input
                          type="number"
                          placeholder="e.g. 6000"
                          value={variantForm.default_daily_rate}
                          onChange={(e) => setVariantForm({ ...variantForm, default_daily_rate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Default Overtime Rate</Label>
                        <Input
                          type="number"
                          value={variantForm.default_overtime_rate}
                          onChange={(e) => setVariantForm({ ...variantForm, default_overtime_rate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Default Custom Work Days</Label>
                        <Input
                          type="number"
                          placeholder="Custom-frequency only"
                          value={variantForm.default_custom_work_days}
                          onChange={(e) => setVariantForm({ ...variantForm, default_custom_work_days: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      {editingVariant && (
                        <Button variant="outline" size="sm" onClick={openAddVariantForm}>Cancel</Button>
                      )}
                      <Button
                        size="sm"
                        onClick={handleSaveVariant}
                        disabled={!variantForm.employment_category_id || isSavingVariant}
                      >
                        {isSavingVariant ? 'Saving...' : editingVariant ? 'Save Variant' : 'Attach Variant'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                <Percent01 className="h-4 w-4" size={16} /> Default Taxes &amp; Deductions
              </h4>
              <p className="text-xs text-muted-foreground mb-3">
                Fetched from the taxes and deduction types already created in the system. More than one can apply, and they can be added or removed here at any time — even after the position was created.
              </p>
              <div className="space-y-2">
                {(detailPosition?.deduction_types ?? []).length === 0 && (
                  <InlineStateNote>
                    No taxes or deductions are attached to this position yet.
                  </InlineStateNote>
                )}
                {detailPosition?.deduction_types.map((dt) => {
                  const matchingTax = !isPitTaxName(dt.name)
                    ? monthlyTaxes.find((tax) => normalizeTaxName(tax.name) === normalizeTaxName(dt.name))
                    : undefined;
                  return (
                    <div key={dt.uuid} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                      <span className="text-sm flex items-center gap-2">
                        {dt.name}
                        <StatusBadge
                          label={matchingTax ? 'Tax' : 'Deduction'}
                          tone={matchingTax ? 'info' : 'secondary'}
                        />
                        <span className="text-xs text-muted-foreground">({dt.deduction_mode})</span>
                      </span>
                      {canManagePositions && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDetachDeductionType(dt.uuid)}
                          aria-label={`Remove ${dt.name} from ${detailPosition?.name}`}
                        >
                          <Trash01 className="h-3.5 w-3.5 text-destructive" size={14} />
                        </Button>
                      )}
                    </div>
                  );
                })}
                {canManagePositions && availableDeductionTypes.length > 0 && (
                  <div className="flex gap-2 pt-1">
                    <Select value={selectedDeductionTypeId} onValueChange={setSelectedDeductionTypeId}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="Attach a tax or deduction type" /></SelectTrigger>
                      <SelectContent>
                        {availableDeductionTypes.map((dt: any) => (
                          <SelectItem key={dt.uuid} value={dt.uuid}>{dt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={handleAttachDeductionType} disabled={!selectedDeductionTypeId}>Attach</Button>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-bold mb-2 flex items-center gap-2">
                <Coins01 className="h-4 w-4" size={16} /> Default Allowance Templates
              </h4>
              <div className="space-y-2">
                {(detailPosition?.allowance_templates ?? []).length === 0 && (
                  <InlineStateNote>
                    No default allowance templates are attached to this position yet.
                  </InlineStateNote>
                )}
                {detailPosition?.allowance_templates.map((template) => (
                  <div key={template.uuid} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{template.title}</span>
                      <span className="text-xs text-muted-foreground">RWF {Number(template.default_amount).toLocaleString()}{template.description ? ` · ${template.description}` : ''}</span>
                    </div>
                    {canManagePositions && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAllowanceTemplate(template.uuid)}
                        aria-label={`Remove ${template.title} from ${detailPosition?.name}`}
                      >
                        <Trash01 className="h-3.5 w-3.5 text-destructive" size={14} />
                      </Button>
                    )}
                  </div>
                ))}
                {canManagePositions && allowanceTypes.length > 0 && (
                  <div className="grid grid-cols-[1fr_120px_auto] gap-2 pt-1">
                    <Select value={selectedAllowanceTypeId} onValueChange={handleSelectAllowanceType}>
                      <SelectTrigger><SelectValue placeholder="Pick an allowance type" /></SelectTrigger>
                      <SelectContent>
                        {allowanceTypes.map((type) => (
                          <SelectItem key={type.uuid} value={type.id}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      placeholder="Amount"
                      value={newAllowance.default_amount}
                      onChange={(e) => setNewAllowance({ ...newAllowance, default_amount: e.target.value })}
                    />
                    <Button
                      variant="outline"
                      onClick={handleAddAllowanceTemplate}
                      disabled={!newAllowance.title || !newAllowance.default_amount}
                    >
                      Attach
                    </Button>
                  </div>
                )}
                {canManagePositions && allowanceTypes.length === 0 && (
                  <p className="text-[10px] text-warning italic">
                    No allowance types are defined yet — add one from the Allowance Setup page first.
                  </p>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive {archiveTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This position will stop appearing when assigning new employees. Employees already assigned to it keep it unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} className="bg-destructive text-destructive-foreground">
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeVariantTarget} onOpenChange={(open) => !open && setRemoveVariantTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeVariantTarget?.name} from {detailPosition?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This fails if any employee is currently assigned to this exact position + employment category. Transfer them to a different category first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveVariant} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
