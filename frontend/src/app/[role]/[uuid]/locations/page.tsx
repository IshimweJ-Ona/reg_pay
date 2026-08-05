
"use client";

import { useEffect, useMemo, useState } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import {
  MarkerPin01 as MapPin,
  Plus,
  SearchMd as Search,
  Building02 as Building2,
  Users01 as Users,
  DotsVertical as MoreVertical,
  Edit05 as Edit,
  Shield01 as ShieldAlert,
  Loading02 as Loader2,
  LayersTwo01 as Layers,
  Briefcase01 as Briefcase,
} from '@untitledui/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  getWorkingLocations,
  createWorkingLocation,
  updateWorkingLocation,
  getDepartments,
  deleteDepartment,
  enableDepartmentAtLocation,
} from '@/api/working_locations';
import { getUsers } from '@/api/users';
import { getEmployees } from '@/api/employees';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { userFriendlyError } from '@/lib/error-message';
import { useAuth } from '@/context/auth-context';
import { useRouter } from 'next/navigation';

export default function LocationsManagementPage() {
  const { hasPermission, isLoading } = useAuth();
  const router = useRouter();
  const [locations, setLocations] = useState<any[]>([]);
  const [editingLoc, setEditingLoc] = useState<any | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newLoc, setNewLoc] = useState({ name: '', type: 'BRANCH' as const, address: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [allDepartments, setAllDepartments] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [locationUsers, setLocationUsers] = useState<any[]>([]);
  const [locationEmployees, setLocationEmployees] = useState<any[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [togglingDeptCode, setTogglingDeptCode] = useState<string | null>(null);
  const { toast } = useToast();
  const canReadAllBranches = hasPermission('branches.read_all');
  const canManageBranches = hasPermission('branches.manage');
  const canManageDepartments = hasPermission('departments.manage');

  const loadLocations = async () => {
    try {
      const items = await getWorkingLocations();
      setLocations(items.working_locations || items);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Branches failed to load",
        description: userFriendlyError(error, "Please check your connection."),
      });
    }
  };

  const loadAllDepartments = async () => {
    try {
      const deps = await getDepartments();
      setAllDepartments(deps.departments || deps || []);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    if (!canReadAllBranches) {
      router.replace('/unauthorized');
      return;
    }
    loadLocations();
    loadAllDepartments();
  }, [isLoading, canReadAllBranches, router, toast]);

  // Every distinct department (grouped by its shared code across locations),
  // same grouping the Departments page uses - the data source for the
  // per-location toggle list below.
  const departmentGroups = useMemo(() => {
    const grouped = new Map<string, any>();
    allDepartments.forEach((dept) => {
      const existing = grouped.get(dept.code);
      if (existing) {
        existing.locations.push(dept);
      } else {
        grouped.set(dept.code, { code: dept.code, name: dept.name, description: dept.description, locations: [dept] });
      }
    });
    return Array.from(grouped.values());
  }, [allDepartments]);

  const locationDepartmentRows = useMemo(() => {
    if (!selectedLocation) return [];
    return departmentGroups.map((group) => {
      const departmentRow = group.locations.find(
        (l: any) => l.working_location_id === selectedLocation.id || l.working_location?.id === selectedLocation.id,
      );
      return { group, departmentRow: departmentRow ?? null, isActive: departmentRow?.status === 'ACTIVE' };
    });
  }, [selectedLocation, departmentGroups]);

  const openLocationDrilldown = async (loc: any) => {
    setSelectedLocation(loc);
    setLoadingRoster(true);
    setLocationUsers([]);
    setLocationEmployees([]);
    try {
      const [usersData, employeesData] = await Promise.all([
        getUsers({ working_location_id: loc.id }),
        getEmployees({ working_location_id: loc.id }),
      ]);
      setLocationUsers(usersData.users || usersData || []);
      setLocationEmployees(employeesData.employees || employeesData || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load branch roster",
        description: userFriendlyError(error, "Please try again."),
      });
    } finally {
      setLoadingRoster(false);
    }
  };

  const handleToggleDepartment = async (row: (typeof locationDepartmentRows)[number]) => {
    if (!selectedLocation) return;
    setTogglingDeptCode(row.group.code);
    try {
      if (row.isActive) {
        await deleteDepartment(row.departmentRow.uuid);
        toast({ title: "Removed", description: `${row.group.name} disabled at ${selectedLocation.name}.` });
      } else {
        await enableDepartmentAtLocation(row.group.code, selectedLocation.id, {
          name: row.group.name,
          description: row.group.description,
        });
        toast({ title: "Enabled", description: `${row.group.name} is now active at ${selectedLocation.name}.` });
      }
      await loadAllDepartments();
      await loadLocations();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: userFriendlyError(error, "Please try again."),
      });
    } finally {
      setTogglingDeptCode(null);
    }
  };

  const filteredLocations = locations.filter(loc => 
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    loc.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading || !canReadAllBranches) return null;

  const handleCreate = async () => {
    try {
      await createWorkingLocation(newLoc);
      toast({ title: "Branch created", description: "The new branch is now available." });
      setIsCreateModalOpen(false);
      setNewLoc({ name: '', type: 'BRANCH', address: '' });
      loadLocations();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Creation failed",
        description: userFriendlyError(error, "Check for duplicate names or invalid data."),
      });
    }
  };

  const handleUpdate = async () => {
    try {
      await updateWorkingLocation(editingLoc.uuid, {
        name: editingLoc.name,
        type: editingLoc.type,
        address: editingLoc.address
      });
      toast({ title: "Branch updated", description: "The branch details were saved." });
      setEditingLoc(null);
      loadLocations();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: userFriendlyError(error, "Please check your input."),
      });
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Branches"
        description="Manage headquarters and branch locations."
        actions={
          canManageBranches && (
            <Button className="h-11 px-6 shadow-lg shadow-primary/20" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" size={16} /> Create Branch
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={<MapPin className="h-5 w-5" size={20} />}
          label="Working locations"
          value={locations.length}
          tone="primary"
        />
        <StatCard
          icon={<Users className="h-5 w-5" size={20} />}
          label="Total users"
          value={locations.reduce((sum, loc) => sum + (loc.user_count ?? 0), 0)}
          tone="success"
        />
        <StatCard
          icon={<Building2 className="h-5 w-5" size={20} />}
          label="Total departments"
          value={locations.reduce((sum, loc) => sum + (loc.department_count ?? 0), 0)}
          tone="accent"
        />
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" size={16} />
        <Input
          placeholder="Search branches by name or address..."
          className="pl-10 h-11 border-none bg-card shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="bg-card rounded-2xl border shadow-sm overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Branch</TableHead>
              <TableHead className="font-bold">Type</TableHead>
              <TableHead className="font-bold">People and departments</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              {canManageBranches && <TableHead className="w-[80px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLocations.map((loc) => (
              <TableRow
                key={loc.id}
                className="hover:bg-secondary/10 transition-colors cursor-pointer"
                onClick={() => openLocationDrilldown(loc)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/5 flex items-center justify-center">
                      <MapPin className="h-5 w-5 text-primary" size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold">{loc.name}</span>
                      <span className="text-xs text-muted-foreground">{loc.address}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-bold tracking-wider">{loc.type}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" size={16} /> {loc.user_count ?? 0} people
                    </div>
                    <div className="flex items-center gap-1.5 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" size={16} /> {loc.department_count ?? 0} depts
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge label="Operational" tone="success" />
                </TableCell>
                {canManageBranches && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" size={16} /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingLoc(loc)}>
                          <Edit className="mr-2 h-4 w-4" size={16} /> Edit Details
                        </DropdownMenuItem>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuItem className="text-muted-foreground opacity-50 cursor-not-allowed">
                                <ShieldAlert className="mr-2 h-4 w-4" size={16} /> Deletion Restricted
                              </DropdownMenuItem>
                            </TooltipTrigger>
                            <TooltipContent>
                              Node deletion is restricted to protect corporate hierarchy.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <BranchFormDialog
        mode="create"
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        value={newLoc}
        onChange={(v) => setNewLoc(v as any)}
        onSubmit={handleCreate}
      />

      <BranchFormDialog
        mode="edit"
        open={!!editingLoc}
        onOpenChange={() => setEditingLoc(null)}
        value={{ name: editingLoc?.name || '', type: editingLoc?.type || 'BRANCH', address: editingLoc?.address || '' }}
        onChange={(v) => setEditingLoc({ ...editingLoc, ...v })}
        onSubmit={handleUpdate}
      />

      {/* Branch drill-down: departments active here (with per-department
          toggle switches, mirroring the Departments page's own view of the
          same relationship), plus the users and employees rosters. */}
      <Dialog open={!!selectedLocation} onOpenChange={(open) => !open && setSelectedLocation(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedLocation?.name}</DialogTitle>
            <DialogDescription>{selectedLocation?.address}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="departments" className="w-full">
            <TabsList className="bg-secondary/30">
              <TabsTrigger value="departments" className="gap-2">
                <Layers className="h-4 w-4" size={16} /> Departments ({locationDepartmentRows.filter((r) => r.isActive).length})
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2">
                <Users className="h-4 w-4" size={16} /> Users ({locationUsers.length})
              </TabsTrigger>
              <TabsTrigger value="employees" className="gap-2">
                <Briefcase className="h-4 w-4" size={16} /> Employees ({locationEmployees.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="departments" className="max-h-[55vh] overflow-y-auto divide-y">
              {locationDepartmentRows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No departments exist in the system yet.</p>
              ) : (
                locationDepartmentRows.map((row) => (
                  <div key={row.group.code} className="flex items-center justify-between py-3 px-1">
                    <div className="flex flex-col min-w-0">
                      <span className={`font-semibold text-sm ${row.isActive ? '' : 'text-muted-foreground'}`}>{row.group.name}</span>
                      {row.isActive && (
                        <span className="text-xs text-muted-foreground">
                          {row.departmentRow.user_count ?? 0} users · {row.departmentRow.employee_count ?? 0} employees
                        </span>
                      )}
                    </div>
                    {canManageDepartments && (
                      <Switch
                        checked={row.isActive}
                        disabled={togglingDeptCode === row.group.code}
                        onCheckedChange={() => handleToggleDepartment(row)}
                      />
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="users" className="max-h-[55vh] overflow-y-auto">
              {loadingRoster ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" size={20} /> Loading users...
                </div>
              ) : locationUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No users are assigned to this branch yet.</p>
              ) : (
                <div className="divide-y">
                  {locationUsers.map((u: any) => (
                    <div key={u.id || u.uuid} className="flex items-center justify-between py-3 gap-3">
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-sm">{u.first_name} {u.last_name}</span>
                        <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                      </div>
                      <Badge variant="outline" className="shrink-0">{u.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="employees" className="max-h-[55vh] overflow-y-auto">
              {loadingRoster ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" size={20} /> Loading employees...
                </div>
              ) : locationEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No employees are assigned to this branch yet.</p>
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
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface BranchFormValue {
  name: string;
  type: string;
  address: string;
}

interface BranchFormDialogProps {
  mode: 'create' | 'edit';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: BranchFormValue;
  onChange: (value: BranchFormValue) => void;
  onSubmit: () => void;
}

// Create and Edit branch dialogs are ~90% identical markup (name, type, address),
// so both flows share this single form dialog and differ only via `mode`.
function BranchFormDialog({ mode, open, onOpenChange, value, onChange, onSubmit }: BranchFormDialogProps) {
  const isCreate = mode === 'create';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCreate ? 'Create Branch' : 'Edit Branch'}</DialogTitle>
          <DialogDescription>
            {isCreate ? 'Add a headquarters or branch location.' : 'Update the branch name, type, or address.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Branch Name</Label>
            <Input
              placeholder={isCreate ? 'e.g. Kigali Branch' : undefined}
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select onValueChange={(v: any) => onChange({ ...value, type: v })} value={value.type}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="HQ">Headquarters (HQ)</SelectItem>
                <SelectItem value="BRANCH">Branch Office</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Address or Region</Label>
            <Input
              placeholder={isCreate ? 'Street address, City' : undefined}
              value={value.address}
              onChange={(e) => onChange({ ...value, address: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit}>{isCreate ? 'Create Branch' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
