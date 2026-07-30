
"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Building2, Plus, Search, Users, UserCog, Layers, Edit, Trash2, ChevronRight, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/api/working_locations';
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
  const [archiveId, setArchiveId] = useState<string | null>(null);

  // Drill-down: department (grouped by name) -> its working locations -> that
  // location's employees and users.
  const [selectedGroup, setSelectedGroup] = useState<any | null>(null);
  const [selectedLocationDept, setSelectedLocationDept] = useState<any | null>(null);
  const [locationUsers, setLocationUsers] = useState<any[]>([]);
  const [locationEmployees, setLocationEmployees] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

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

  useEffect(() => {
    if (isLoading) return;
    if (!canManageDepartments) {
      router.replace('/unauthorized');
      return;
    }

    loadData();

    // Listen for global system updates (via SSE) to refresh data instantly
    const handleSystemUpdate = (event: any) => {
      if (event.detail?.type === 'departments_updated') {
        loadData();
      }
    };

    window.addEventListener('system_update', handleSystemUpdate);
    return () => window.removeEventListener('system_update', handleSystemUpdate);
  }, [isLoading, canManageDepartments, router]);

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

  const filteredDepartments = departmentRows.filter(dept =>
    dept.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading || !canManageDepartments) return null;

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
        await deleteDepartment(dept.uuid);
        toast({ variant: "destructive", title: "Department Archived", description: "The unit has been removed from active view." });
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Department Directory</h1>
          <p className="text-muted-foreground">
            {canReadAllBranches
              ? 'Browse departments across all branches. Select one to see its working locations.'
              : `Manage departments in ${user?.location ?? 'your branch'}.`}
          </p>
        </div>
        {canManageDepartments && (
          <Button className="h-11 px-6 shadow-lg shadow-primary/20" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Department
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-accent/10 flex items-center justify-center">
            <Layers className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{departmentRows.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Department{canReadAllBranches ? ' names' : 's'}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border shadow-sm p-5 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold leading-none">{departments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Department instances across branches</p>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Filter by name..."
          className="pl-10 h-11 border-none bg-white shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Affiliation</TableHead>
              <TableHead className="font-bold">Branches</TableHead>
              <TableHead className="w-[200px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDepartments.map((dept) => (
              <TableRow
                key={dept.id}
                className="hover:bg-secondary/10 transition-colors cursor-pointer"
                onClick={() => setSelectedGroup(dept)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-accent/5 flex items-center justify-center">
                      <Layers className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm">{dept.name}</span>
                      {dept.working_location && (dept.branchCount === 1 || !canReadAllBranches) && (
                         <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                            <Building2 className="h-3 w-3" /> {dept.working_location.name}
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
                    View All Branches <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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

      {/* Step 2: every working location that has this department */}
      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedGroup?.name}</DialogTitle>
            <DialogDescription>
              This department exists in {selectedGroup?.branchCount} working location{selectedGroup?.branchCount === 1 ? '' : 's'}.
              Select one to see its employees and users.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto divide-y">
            {(selectedGroup?.locations || []).map((loc: any) => (
              <button
                key={loc.id}
                className="w-full flex items-center justify-between py-3 px-1 hover:bg-secondary/40 rounded-lg transition-colors text-left"
                onClick={() => openLocationDetail(loc)}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm">{loc.working_location?.name ?? 'Unknown location'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-bold">
                    <Users className="h-3 w-3 mr-1" /> {loc.user_count ?? 0}
                  </Badge>
                  <Badge variant="outline" className="font-bold">
                    <UserCog className="h-3 w-3 mr-1" /> {loc.employee_count ?? 0}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setArchiveId(selectedLocationDept.id)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Archive
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
          <Tabs defaultValue="employees" className="w-full">
            <TabsList className="bg-secondary/30">
              <TabsTrigger value="employees" className="gap-2">
                <UserCog className="h-4 w-4" /> Employees ({locationEmployees.length})
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" /> Users ({locationUsers.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="employees" className="max-h-[55vh] overflow-y-auto">
              {loadingEmployees ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading employees...
                </div>
              ) : locationEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No employees are assigned to this department yet.</p>
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
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading users...
                </div>
              ) : locationUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No users are assigned to this department yet.</p>
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
