
"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Building2, Plus, Search, Users, MoreVertical, Layers, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
        console.log('Instant sync: Refreshing department database...');
        loadData();
      }
    };

    window.addEventListener('system_update', handleSystemUpdate);
    return () => window.removeEventListener('system_update', handleSystemUpdate);
  }, [isLoading, canManageDepartments, router]);

  const departmentRows = useMemo(() => {
    const grouped = new Map<string, any>();
    departments.forEach((dept) => {
      // In scoped view, don't group across branches.
      const key = canReadAllBranches ? (dept.code || dept.name) : dept.uuid;
      
      const existing = grouped.get(key);
      if (existing && canReadAllBranches) {
        existing.personnel += dept._count?.users ?? 0;
        existing.employees += dept._count?.employees ?? 0;
        existing.branchCount += 1;
      } else {
        grouped.set(key, {
          ...dept,
          personnel: dept._count?.users ?? 0,
          employees: dept._count?.employees ?? 0,
          branchCount: 1,
        });
      }
    });
    return Array.from(grouped.values());
  }, [departments, canReadAllBranches]);

  const filteredDepartments = departmentRows.filter(dept => 
    dept.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    dept.code.toLowerCase().includes(searchQuery.toLowerCase())
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
      toast({ title: "Department updated", description: "The department details were saved." });
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
              ? 'View department names and personnel totals across all branches.'
              : `Manage departments in ${user?.location ?? 'your branch'}.`}
          </p>
        </div>
        {canManageDepartments && (
          <Button className="h-11 px-6 shadow-lg shadow-primary/20" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Create Department
          </Button>
        )}
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Filter by code or name..." 
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
              <TableHead className="font-bold">Code</TableHead>
              <TableHead className="font-bold">Personnel</TableHead>
              <TableHead className="font-bold">Branches</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredDepartments.map((dept) => (
              <TableRow key={dept.id} className="hover:bg-secondary/10 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-accent/5 flex items-center justify-center">
                      <Layers className="h-5 w-5 text-accent" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm">{dept.name}</span>
                      {dept.working_location && (
                         <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                            <Building2 className="h-3 w-3" /> {dept.working_location.name}
                         </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary">{dept.code}</Badge></TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-bold">
                      <Users className="h-4 w-4 text-primary" /> {dept.personnel}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{dept.branchCount}</TableCell>
                <TableCell>
                  {canManageDepartments && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditingDep(dept)}>
                          <Edit className="mr-2 h-4 w-4" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={() => setArchiveId(dept.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Archive Unit
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
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
            <DialogDescription>Update the department name, code, or description.</DialogDescription>
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
              This will remove the department from active directory. Existing employees must be transferred first.
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
    </div>
  );
}
