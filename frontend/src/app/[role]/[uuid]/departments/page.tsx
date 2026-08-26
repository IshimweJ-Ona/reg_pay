
"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Building02 as Building2,
  Plus,
  SearchMd as Search,
  Users01 as Users,
  Briefcase01 as Briefcase,
  LayersTwo01 as Layers,
  Edit05 as Edit,
  Archive,
  ChevronRight,
  MarkerPin01 as MapPin,
  Loading02 as Loader2,
} from '@untitledui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { InlineStateNote, LoadingState, PermissionDeniedState, TableStateRow } from '@/components/layout/page-state';
import { StatCard } from '@/components/ui/stat-card';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment, getWorkingLocations, enableDepartmentAtLocation, suspendAndArchiveDepartment, WorkingLocation } from '@/api/working_locations';
import { getUsers } from '@/api/users';
import { getEmployees } from '@/api/employees';
import { userFriendlyError } from '@/lib/error-message';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

export default function DepartmentsManagementPage() {
  const { user, hasPermission, isLoading } = useAuth();
  const router = useRouter();
  const [departments, setDepartments] = useState<any[]>([]);
  const [editingDep, setEditingDep] = useState<any | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newDep, setNewDep] = useState({ name: '', code: '', description: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [departmentsPage, setDepartmentsPage] = useState(1);
  const DEPARTMENTS_PAGE_SIZE = 25;
  const [archiveId, setArchiveId] = useState<string | null>(null);

  // Drill-down: department (grouped by name) -> its working locations -> that
  // location's employees and users.
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [selectedLocationDept, setSelectedLocationDept] = useState<any | null>(null);
  const [locationUsers, setLocationUsers] = useState<any[]>([]);
  const [locationEmployees, setLocationEmployees] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [allLocations, setAllLocations] = useState<WorkingLocation[]>([]);
  const [togglingLocationId, setTogglingLocationId] = useState<string | null>(null);
  const [deactivateConfirmRow, setDeactivateConfirmRow] = useState<any | null>(null);
  const [suspendConfirmRow, setSuspendConfirmRow] = useState<any | null>(null);
  const [isSuspending, setIsSuspending] = useState(false);

  const { toast } = useToast();
  const canManageDepartments = hasPermission('departments.manage');
  const canReadAllBranches = hasPermission('branches.read_all');

  const loadData = async () => {
    try {
      const deps = await getDepartments();
      setDepartments(deps.departments || deps);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load data",
        description: userFriendlyError(error, "Please check your connection."),
      });
    }
  };

  const loadLocations = async () => {
    try {
      const data = await getWorkingLocations();
      setAllLocations(data.working_locations || data || []);
    } catch (error) {
      console.error('Failed to load working locations:', error);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!canManageDepartments) {
      router.replace('/unauthorized');
      return;
    }

    loadData();
    if (canReadAllBranches) loadLocations();

    // Listen for global system updates (via SSE) to refresh data instantly
    const handleSystemUpdate = (event: any) => {
      if (event.detail?.type === 'departments_updated') {
        loadData();
      }
    };

    window.addEventListener('system_update', handleSystemUpdate);
    return () => window.removeEventListener('system_update', handleSystemUpdate);
  }, [isLoading, canManageDepartments, canReadAllBranches, router]);

  const departmentRows = useMemo(() => {
    const grouped = new Map<string, any>();
    departments.forEach((dept) => {
      // Group by name, not code: the same logical department (e.g.
      // "Administration") gets a different code per working location
      // (HQ-ADMIN, KIC-ADMIN, ...), so code can never be the group key.
      // In scoped view, don't group across branches.
      const key = canReadAllBranches ? dept.name : dept.uuid;

      const existing = grouped.get(key);
      if (existing && canReadAllBranches) {
        existing.personnel += dept.user_count ?? 0;
        existing.employees += dept.employee_count ?? 0;
        existing.branchCount += 1;
        existing.locations.push(dept);
      } else {
        grouped.set(key, {
          ...dept,
          personnel: dept.user_count ?? 0,
          employees: dept.employee_count ?? 0,
          branchCount: 1,
          locations: [dept],
        });
      }
    });
    return Array.from(grouped.values());
  }, [departments, canReadAllBranches]);

  const openLocationDetail = async (deptRow: any) => {
    setSelectedLocationDept(deptRow);
    setLoadingUsers(true);
    setLoadingEmployees(true);
    setLocationUsers([]);
    setLocationEmployees([]);
    try {
      const [usersData, employeesData] = await Promise.all([
        getUsers({ department_id: deptRow.id }),
        getEmployees({ department_id: deptRow.id }),
      ]);
      setLocationUsers(usersData.users || usersData || []);
      setLocationEmployees(employeesData.employees || employeesData || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load department roster",
        description: userFriendlyError(error, "Please try again."),
      });
    } finally {
      setLoadingUsers(false);
      setLoadingEmployees(false);
    }
  };

  // Keep the open group dialog in sync with `departments` after any toggle
  // triggers a reload - `selectedGroup` is otherwise a stale snapshot object.
  useEffect(() => {
    if (!selectedGroup) return;
    const fresh = departmentRows.find((d) =>
      canReadAllBranches ? d.name === selectedGroup.name : d.uuid === selectedGroup.uuid,
    );
    if (fresh) setSelectedGroup(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentRows]);

  // One row per working location, cross-referencing which ones currently
  // have an ACTIVE row for this department group - the data for the toggle
  // switches. Super-admin only; branch-scoped viewers never see this list.
  const locationToggleRows = useMemo(() => {
    if (!selectedGroup || !canReadAllBranches) return [];
    return allLocations.map((loc) => {
      const departmentRow = (selectedGroup.locations || []).find(
        (l: any) => l.working_location_id === loc.id || l.working_location?.id === loc.id,
      );
      return {
        location: loc,
        departmentRow: departmentRow ?? null,
        isPendingArchive: Boolean(departmentRow?.pending_deactivation),
        isActive:
          departmentRow?.status === 'ACTIVE' &&
          !departmentRow?.pending_deactivation,
      };
    });
  }, [selectedGroup, allLocations, canReadAllBranches]);

  // Turning a department OFF is destructive-ish (it starts winding the
  // department down, possibly suspending staff down the line), so it goes
  // through a confirmation dialog rather than firing immediately on toggle.
  // Turning one back ON is non-destructive and stays a direct call.
  const handleToggleLocation = (row: (typeof locationToggleRows)[number]) => {
    if (!selectedGroup) return;
    if (row.isActive) {
      setDeactivateConfirmRow(row);
      return;
    }
    performEnable(row);
  };

  const performEnable = async (row: (typeof locationToggleRows)[number]) => {
    if (!selectedGroup) return;
    setTogglingLocationId(row.location.id);
    try {
      await enableDepartmentAtLocation(selectedGroup.code, row.location.id, {
        name: selectedGroup.name,
        description: selectedGroup.description,
      });
      toast({ title: "Enabled", description: `${selectedGroup.name} is now active at ${row.location.name}.` });
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: userFriendlyError(error, "Please try again."),
      });
    } finally {
      setTogglingLocationId(null);
    }
  };

  const performDeactivate = async () => {
    const row = deactivateConfirmRow;
    if (!row || !selectedGroup) return;
    setDeactivateConfirmRow(null);
    setTogglingLocationId(row.location.id);
    try {
      const result = await deleteDepartment(row.departmentRow.uuid);
      if (result?.status === 'PENDING_TRANSFER') {
        toast({
          title: "Transfer required",
          description: result.message ?? `${selectedGroup.name} will be archived once all employees are transferred out — or suspend everyone still assigned to close it immediately.`,
        });
      } else {
        toast({ title: "Removed", description: `${selectedGroup.name} disabled at ${row.location.name}.` });
      }
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: userFriendlyError(error, "Please try again."),
      });
    } finally {
      setTogglingLocationId(null);
    }
  };

  // Alternate resolution for a department stuck in "pending transfer": close
  // it immediately by suspending every employee/user still assigned instead
  // of waiting for them to be moved out one by one.
  const performSuspendAndArchive = async () => {
    const row = suspendConfirmRow;
    if (!row?.departmentRow) return;
    setIsSuspending(true);
    try {
      const result = await suspendAndArchiveDepartment(row.departmentRow.uuid);
      toast({
        title: "Department closed",
        description: result?.message ?? `${row.location.name} department archived; staff suspended.`,
      });
      setSuspendConfirmRow(null);
      await loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Could not close department",
        description: userFriendlyError(error, "Please try again."),
      });
    } finally {
      setIsSuspending(false);
    }
  };

  const filteredDepartments = departmentRows.filter(dept =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const departmentsTotalPages = Math.max(1, Math.ceil(filteredDepartments.length / DEPARTMENTS_PAGE_SIZE));
  const paginatedDepartments = filteredDepartments.slice(
    (departmentsPage - 1) * DEPARTMENTS_PAGE_SIZE,
    departmentsPage * DEPARTMENTS_PAGE_SIZE,
  );

  useEffect(() => {
    setDepartmentsPage(1);
  }, [searchQuery]);

  if (isLoading) {
    return (
      <LoadingState
        title="Loading department controls"
        description="Checking your branch scope and department permissions."
      />
    );
  }

  if (!canManageDepartments) {
    return (
      <PermissionDeniedState
        title="Department management access required"
        description="Your role can view permitted areas only. Department configuration requires an HR or administrator permission."
      />
    );
  }

  const handleCreate = async () => {
    try {
      await createDepartment(newDep);
      toast({ title: "Department created", description: "This department was added to all branches." });
      setIsCreateModalOpen(false);
      setNewDep({ name: '', code: '', description: '' });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: userFriendlyError(error, "Check for duplicate department code or missing details."),
      });
    }
  };

  const handleUpdate = async () => {
    try {
      await updateDepartment(editingDep.uuid, {
        name: editingDep.name,
        code: editingDep.code,
        description: editingDep.description
      });
      toast({ title: "Department updated", description: "The department details were saved for this working location." });
      setEditingDep(null);
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: userFriendlyError(error, "Please check your input."),
      });
    }
  };

  const handleArchive = async () => {
    if (!archiveId) return;
    try {
      const dept = departments.find(d => d.id === archiveId);
      if (dept) {
        const result = await deleteDepartment(dept.uuid);
        if (result?.status === 'PENDING_TRANSFER') {
          toast({
            title: "Transfer required",
            description: result.message ?? "The department will be archived after employees are transferred.",
          });
        } else {
          toast({ variant: "destructive", title: "Department Archived", description: "The unit has been removed from active view." });
        }
        setSelectedLocationDept(null);
        loadData();
      }
      setArchiveId(null);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Archive failed",
        description: userFriendlyError(error, "Make sure no active employees remain in this department."),
      });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Department Directory"
        description={
          canReadAllBranches
            ? 'Browse departments across all branches. Select one to see its working locations.'
            : `Manage departments in ${user?.location ?? 'your branch'}.`
        }
        actions={
          canManageDepartments && (
            <Button className="h-11 px-6 shadow-sm shadow-primary/20" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" size={16} /> Create Department
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          icon={<Layers className="h-5 w-5" size={20} />}
          label={`Department${canReadAllBranches ? ' names' : 's'}`}
          value={departmentRows.length}
          tone="accent"
        />
        <StatCard
          icon={<Building2 className="h-5 w-5" size={20} />}
          label="Department instances across branches"
          value={departments.length}
          tone="primary"
        />
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" size={16} />
        <Input
          placeholder="Filter by name..."
          className="pl-10 h-11 border border-border bg-card shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="bg-card rounded-lg border shadow-sm overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Affiliation</TableHead>
              <TableHead className="font-bold">Branches</TableHead>
              <TableHead className="w-[200px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDepartments.length === 0 ? (
              <TableStateRow
                colSpan={3}
                title="No departments found"
                description="Adjust search filters or create a department when your role permits it."
              />
            ) : paginatedDepartments.map((dept) => (
              <TableRow
                key={dept.id}
                className="hover:bg-secondary/10 transition-colors cursor-pointer"
                onClick={() => setSelectedGroup(dept)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-accent/5 flex items-center justify-center">
                      <Layers className="h-5 w-5 text-accent" size={20} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm">{dept.name}</span>
                      {dept.working_location && (dept.branchCount === 1 || !canReadAllBranches) && (
                         <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                            <Building2 className="h-3 w-3" size={12} /> {dept.working_location.name}
                         </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {dept.branchCount}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setSelectedGroup(dept)}
                  >
                    View All Branches <ChevronRight className="h-3.5 w-3.5" size={14} />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          page={departmentsPage}
          totalPages={departmentsTotalPages}
          total={filteredDepartments.length}
          limit={DEPARTMENTS_PAGE_SIZE}
          onPageChange={setDepartmentsPage}
        />
      </div>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Department</DialogTitle>
            <DialogDescription>
              {canReadAllBranches
                ? 'This department will be available in every current and future branch.'
                : 'This department will be created in your assigned branch.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Department Name</Label>
              <Input
                placeholder="e.g. Human Resources"
                value={newDep.name}
                onChange={(e) => setNewDep({...newDep, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Department Code</Label>
              <Input
                placeholder="e.g. HR-001"
                value={newDep.code}
                onChange={(e) => setNewDep({...newDep, code: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Optional description"
                value={newDep.description}
                onChange={(e) => setNewDep({...newDep, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingDep} onOpenChange={() => setEditingDep(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>
              Updates apply only to this department at {editingDep?.working_location?.name ?? 'this working location'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Department Name</Label>
              <Input
                value={editingDep?.name || ''}
                onChange={(e) => setEditingDep({...editingDep, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Department Code</Label>
              <Input
                value={editingDep?.code || ''}
                onChange={(e) => setEditingDep({...editingDep, code: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editingDep?.description || ''}
                onChange={(e) => setEditingDep({...editingDep, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDep(null)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!archiveId} onOpenChange={() => setArchiveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Functional Unit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the department from active directory at this working location only. Existing employees must be transferred first.
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

      <AlertDialog open={!!deactivateConfirmRow} onOpenChange={(open) => !open && setDeactivateConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate {selectedGroup?.name} at {deactivateConfirmRow?.location?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateConfirmRow?.departmentRow?.employee_count > 0
                ? `This department has ${deactivateConfirmRow.departmentRow.employee_count} employee(s) assigned. The branch manager will be notified to transfer them out before the department fully deactivates — or you can suspend everyone still assigned to close it immediately.`
                : 'This department will be deactivated immediately at this working location. It will no longer appear when creating new employees, users, or payroll batches here.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={performDeactivate} className="bg-destructive text-destructive-foreground">
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!suspendConfirmRow} onOpenChange={(open) => !open && setSuspendConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend everyone in {selectedGroup?.name} at {suspendConfirmRow?.location?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This immediately suspends every active employee and user still assigned to this department, revokes their sessions, and closes the department. This cannot be undone automatically — suspended staff would need to be individually reactivated afterward. Use this only when transferring people out isn't practical.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSuspending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={performSuspendAndArchive}
              disabled={isSuspending}
              className="bg-destructive text-destructive-foreground"
            >
              {isSuspending ? 'Suspending...' : 'Suspend all & close department'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Step 2: every working location that has this department */}
      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              {canReadAllBranches
                ? 'Toggle which working locations this department is active at, or select an active one to see its employees and users.'
                : `This department exists in ${selectedGroup?.branchCount} working location${selectedGroup?.branchCount === 1 ? '' : 's'}. Select one to see its employees and users.`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto divide-y">
            {canReadAllBranches
              ? locationToggleRows.map((row) => (
                  <div
                    key={row.location.id}
                    className={`w-full flex items-center justify-between py-3 px-1 rounded-lg transition-colors ${row.departmentRow ? 'hover:bg-secondary/40 cursor-pointer' : ''}`}
                    onClick={() => row.departmentRow && openLocationDetail(row.departmentRow)}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" size={16} />
                      <div className="flex flex-col">
                        <span className={`font-semibold text-sm ${row.isActive ? '' : 'text-muted-foreground'}`}>{row.location.name}</span>
                        {row.isPendingArchive && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-medium text-amber-600">
                              Pending transfer: {row.departmentRow.pending_deactivation?.remaining_employee_count ?? row.departmentRow.employee_count ?? 0} employee{(row.departmentRow.pending_deactivation?.remaining_employee_count ?? row.departmentRow.employee_count ?? 0) === 1 ? '' : 's'}
                            </span>
                            <button
                              type="button"
                              className="text-[11px] font-semibold text-destructive underline underline-offset-2 hover:no-underline"
                              onClick={(e) => { e.stopPropagation(); setSuspendConfirmRow(row); }}
                            >
                              Suspend all instead
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {row.departmentRow && (
                        <>
                          <Badge variant="secondary" className="font-bold">
                            <Users className="h-3 w-3 mr-1" size={12} /> {row.departmentRow.user_count ?? 0}
                          </Badge>
                          <Badge variant="outline" className="font-bold">
                            <Briefcase className="h-3 w-3 mr-1" size={12} /> {row.departmentRow.employee_count ?? 0}
                          </Badge>
                        </>
                      )}
                      <Switch
                        checked={row.isActive}
                        disabled={togglingLocationId === row.location.id}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => handleToggleLocation(row)}
                      />
                      {row.departmentRow && <ChevronRight className="h-4 w-4 text-muted-foreground" size={16} />}
                    </div>
                  </div>
                ))
              : (selectedGroup?.locations || []).map((loc: any) => (
                  <button
                    key={loc.id}
                    className="w-full flex items-center justify-between py-3 px-1 hover:bg-secondary/40 rounded-lg transition-colors text-left"
                    onClick={() => openLocationDetail(loc)}
                  >
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" size={16} />
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{loc.working_location?.name ?? 'Unknown location'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-bold">
                        <Users className="h-3 w-3 mr-1" size={12} /> {loc.user_count ?? 0}
                      </Badge>
                      <Badge variant="outline" className="font-bold">
                        <Briefcase className="h-3 w-3 mr-1" size={12} /> {loc.employee_count ?? 0}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" size={16} />
                    </div>
                  </button>
                ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Step 3: this department at one specific working location - employees
          and users are shown separately, and editing/archiving happen here. */}
      <Dialog
        open={!!selectedLocationDept}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedLocationDept(null);
            setLocationUsers([]);
            setLocationEmployees([]);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 pr-6">
              <div>
                <DialogTitle>
                  {selectedLocationDept?.name}
                  {selectedLocationDept?.working_location && (
                    <span className="text-muted-foreground font-normal"> · {selectedLocationDept.working_location.name}</span>
                  )}
                </DialogTitle>
                <DialogDescription>Employees and users assigned to this department at this working location.</DialogDescription>
              </div>
              {canManageDepartments && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => setEditingDep(selectedLocationDept)}>
                    <Edit className="mr-2 h-4 w-4" size={16} /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setArchiveId(selectedLocationDept.id)}
                  >
                    <Archive className="mr-2 h-4 w-4" size={16} /> Archive
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          <Tabs defaultValue="employees" className="w-full">
            <TabsList className="bg-secondary/30">
              <TabsTrigger value="employees" className="gap-2">
                <Briefcase className="h-4 w-4" size={16} /> Employees ({locationEmployees.length})
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" size={16} /> Users ({locationUsers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="employees" className="max-h-[55vh] overflow-y-auto">
              {loadingEmployees ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" size={20} /> Loading employees...
                </div>
              ) : locationEmployees.length === 0 ? (
                <InlineStateNote className="my-4">No employees are assigned to this department yet.</InlineStateNote>
              ) : (
                <div className="divide-y">
                  {locationEmployees.map((emp: any) => (
                    <div key={emp.id || emp.uuid} className="flex items-center justify-between py-3 gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm">{emp.first_name} {emp.last_name}</span>
                        <span className="text-xs text-muted-foreground truncate">{emp.email || emp.phone_number || emp.national_id}</span>
                      </div>
                      <Badge variant="outline" className="shrink-0">{emp.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="users" className="max-h-[55vh] overflow-y-auto">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" size={20} /> Loading users...
                </div>
              ) : locationUsers.length === 0 ? (
                <InlineStateNote className="my-4">No users are assigned to this department yet.</InlineStateNote>
              ) : (
                <div className="divide-y">
                  {locationUsers.map((u: any) => (
                    <div key={u.id || u.uuid} className="flex items-center justify-between py-3 gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm">{u.first_name} {u.last_name}</span>
                        <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(u.roles && u.roles.length > 0) ? (
                            u.roles.map((r: any) => (
                              <Badge key={r.id ?? r.role_id ?? r.name} variant="secondary" className="text-[10px] font-medium">
                                {r.name}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">No role assigned</span>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">{u.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
