
"use client";

import React, { useEffect, useState } from 'react';
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
import { getDepartments } from '@/api/working_locations';

export default function DepartmentsManagementPage() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [editingDep, setEditingDep] = useState<any | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    getDepartments()
      .then((items) => setDepartments(items))
      .catch((error) => {
        toast({
          variant: "destructive",
          title: "Departments failed to load",
          description: error?.response?.data?.message ?? "Please check your backend connection.",
        });
      });
  }, [toast]);

  const handleUpdate = () => {
    setDepartments(departments.map(d => d.id === editingDep.id ? editingDep : d));
    toast({ title: "Department Updated", description: "Metadata has been synchronized." });
    setEditingDep(null);
  };

  const handleArchive = () => {
    setDepartments(departments.filter(d => d.id !== archiveId));
    toast({ variant: "destructive", title: "Department Archived", description: "The unit has been removed from active view." });
    setArchiveId(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Department Directory</h1>
          <p className="text-muted-foreground">Define functional units and hierarchies within the organization.</p>
        </div>
        <Button className="h-11 px-6 shadow-lg shadow-primary/20">
          <Plus className="mr-2 h-4 w-4" /> Create Department
        </Button>
      </div>

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Filter by code or name..." 
          className="pl-10 h-11 border-none bg-white shadow-sm"
        />
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Department</TableHead>
              <TableHead className="font-bold">Code</TableHead>
              <TableHead className="font-bold">Head of Dept</TableHead>
              <TableHead className="font-bold">Personnel</TableHead>
              <TableHead className="font-bold">Primary Location</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((dept) => (
              <TableRow key={dept.id} className="hover:bg-secondary/10 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-accent/5 flex items-center justify-center">
                      <Layers className="h-5 w-5 text-accent" />
                    </div>
                    <span className="font-semibold">{dept.name}</span>
                  </div>
                </TableCell>
                <TableCell><Badge variant="secondary">{dept.code}</Badge></TableCell>
                <TableCell className="font-medium">{dept.manager?.name ?? 'Unassigned'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 font-bold">
                    <Users className="h-4 w-4 text-primary" /> {dept._count?.users ?? 0}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{dept.working_location?.name ?? dept.working_location_id}</TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editingDep} onOpenChange={() => setEditingDep(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Unit Parameters</DialogTitle>
            <DialogDescription>Synchronize department metadata with current organization structure.</DialogDescription>
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
              <Label>Unit Manager</Label>
              <Input 
                value={editingDep?.manager || ''} 
                onChange={(e) => setEditingDep({...editingDep, manager: e.target.value})}
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
