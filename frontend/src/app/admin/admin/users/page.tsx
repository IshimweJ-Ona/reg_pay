"use client";

import React, { useEffect, useState } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, Filter, MoreVertical, CheckCircle, 
  Ban, UserPlus, Shield, Fingerprint, Calendar, Edit, Trash2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { User, UserStatus } from '@/types/auth';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { approveUser, getUsers, rejectUser, suspendUser } from '@/api/users';
import { getWorkingLocations, getDepartments } from '@/api/working_locations';
import { getRoles } from '@/api/roles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function mapApiUser(apiUser: any): User {
  const role = apiUser.roles?.[0]?.name ?? 'USER';
  return {
    id: apiUser.uuid,
    uuid: apiUser.uuid,
    name: `${apiUser.first_name} ${apiUser.last_name}`.trim(),
    email: apiUser.email,
    role: role as User['role'],
    roles: apiUser.roles?.map((item: any) => item.name) ?? [role],
    status: apiUser.status === 'ACTIVE' ? 'APPROVED' : apiUser.status === 'SUSPENDED' ? 'SUSPENDED' : apiUser.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
    permissions: apiUser.permissions?.map((item: any) => item.permission_key).filter(Boolean) ?? [],
    department: apiUser.department?.name,
    location: apiUser.working_location?.name,
    department_id: apiUser.department?.uuid,
    location_id: apiUser.working_location?.uuid,
    createdAt: apiUser.created_at,
  };
}

export default function UsersManagementPage() {
  const { user: currentUser, updateUserPermissions } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  
  const { toast } = useToast();

  const loadData = async () => {
    try {
      const [usersData, rolesData, locsData] = await Promise.all([
        getUsers(),
        getRoles(),
        getWorkingLocations()
      ]);
      setUsers(usersData.map(mapApiUser));
      setRoles(rolesData);
      setLocations(locsData.working_locations || locsData);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load data",
        description: error?.response?.data?.message ?? "Please check your connection.",
      });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLocationChange = async (locationUuid: string) => {
    if (!selectedUser) return;
    setSelectedUser({ ...selectedUser, location_id: locationUuid, department_id: '' });
    setDepartments([]);
    if (locationUuid) {
      try {
        const data = await getDepartments(locationUuid);
        setDepartments(data.departments || data);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    }
  };

  const handleSheetOpen = async (user: User) => {
    setSelectedUser(user);
    setIsSheetOpen(true);
    if (user.location_id) {
      try {
        const data = await getDepartments(user.location_id);
        setDepartments(data.departments || data);
      } catch (error) {
        console.error('Failed to fetch departments:', error);
      }
    } else {
      setDepartments([]);
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    try {
      await approveUser(updatedUser.id, {
        working_location_id: updatedUser.location_id,
        department_id: updatedUser.department_id,
        role_ids: roles.filter(r => updatedUser.roles?.includes(r.name)).map(r => r.uuid)
      });
      
      toast({ title: "Identity Updated", description: "The user's corporate profile has been synchronized." });
      setIsSheetOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error?.response?.data?.message ?? "Please try again.",
      });
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case 'APPROVED': return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Approved</Badge>;
      case 'PENDING': return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pending</Badge>;
      case 'SUSPENDED': return <Badge variant="destructive">Suspended</Badge>;
      case 'REJECTED': return <Badge variant="outline">Rejected</Badge>;
    }
  };

  const handleStatusChange = async (userId: string, newStatus: UserStatus) => {
    try {
      if (newStatus === 'APPROVED') await approveUser(userId, {});
      if (newStatus === 'SUSPENDED') await suspendUser(userId);
      await loadData();
      toast({ title: "Status Updated", description: `User status changed to ${newStatus}.` });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Status update failed",
        description: error?.response?.data?.message ?? "Please try again.",
      });
    }
  };

  const handleDeleteUser = async () => {
    if (userToDelete) {
      try {
        await rejectUser(userToDelete, "Soft deleted from user management.");
        await loadData();
        toast({
          variant: "destructive",
          title: "User Decommissioned",
          description: "The identity has been soft-deleted and access revoked."
        });
        setUserToDelete(null);
        setDeleteConfirmOpen(false);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Deletion failed",
          description: error?.response?.data?.message ?? "Please try again.",
        });
      }
    }
  };

  const togglePermission = (perm: string) => {
    if (!selectedUser) return;
    const hasPerm = selectedUser.permissions.includes(perm);
    const newPerms = hasPerm 
      ? selectedUser.permissions.filter(p => p !== perm) 
      : [...selectedUser.permissions, perm];
    
    const updatedUser = { ...selectedUser, permissions: newPerms };
    setSelectedUser(updatedUser);
    updateUserPermissions(selectedUser.id, newPerms);
  };

  const filteredUsers = users.filter(u => 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    u.id !== currentUser?.id
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">User Assets</h1>
          <p className="text-muted-foreground">Comprehensive identity management and access control.</p>
        </div>
        <Button className="h-11 px-6 shadow-lg shadow-primary/20">
          <UserPlus className="mr-2 h-4 w-4" /> Provision Corporate Identity
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search identities by name or email..." 
            className="pl-10 h-11 border-none bg-secondary/30"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" className="h-11 gap-2 border-dashed">
          <Filter className="h-4 w-4" /> Policy Filters
        </Button>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">Identity</TableHead>
              <TableHead className="font-bold">Classification</TableHead>
              <TableHead className="font-bold">Active Policies</TableHead>
              <TableHead className="font-bold">Status</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} className="hover:bg-secondary/20 transition-colors">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold">{user.name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-bold tracking-tight">
                    {user.role.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium">{user.permissions.length} Permissions</span>
                </TableCell>
                <TableCell>{getStatusBadge(user.status)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => handleSheetOpen(user)}>
                        <Edit className="mr-2 h-4 w-4 text-primary" /> Edit & Manage
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'APPROVED')}>
                        <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" /> Grant Access
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'SUSPENDED')}>
                        <Ban className="mr-2 h-4 w-4 text-amber-600" /> Suspend Asset
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive" 
                        onClick={() => { setUserToDelete(user.id); setDeleteConfirmOpen(true); }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Decommission
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader className="pb-6">
            <SheetTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> User Identity Control
            </SheetTitle>
            <SheetDescription>
              Modify profile details and fine-grained access policies.
            </SheetDescription>
          </SheetHeader>
          
          <ScrollArea className="h-[calc(100vh-160px)] py-4">
            <div className="space-y-8 pr-4">
              <div className="bg-secondary/20 p-6 rounded-xl space-y-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input 
                    value={selectedUser?.name || ''} 
                    onChange={(e) => setSelectedUser(prev => prev ? {...prev, name: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Corporate Email</Label>
                  <Input 
                    value={selectedUser?.email || ''} 
                    onChange={(e) => setSelectedUser(prev => prev ? {...prev, email: e.target.value} : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role Assignment</Label>
                  <Select 
                    onValueChange={(v) => setSelectedUser(prev => prev ? {...prev, role: v as any, roles: [v]} : null)} 
                    value={selectedUser?.role}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select primary role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.uuid} value={r.name}>{r.name.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Working Location</Label>
                  <Select onValueChange={handleLocationChange} value={selectedUser?.location_id}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.uuid} value={loc.uuid}>{loc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select 
                    onValueChange={(v) => setSelectedUser(prev => prev ? {...prev, department_id: v} : null)} 
                    value={selectedUser?.department_id}
                    disabled={!selectedUser?.location_id}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedUser?.location_id ? "Select department" : "Select location first"} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.uuid} value={dept.uuid}>{dept.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Fingerprint className="h-3 w-3" /> ID: {selectedUser?.id}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> Joined: {selectedUser?.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Permission Matrix
                </h4>
                <div className="space-y-6">
                  {Object.entries(PERMISSIONS).map(([category, perms]) => (
                    <div key={category} className="space-y-3">
                      <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-secondary/50 p-2 rounded">
                        {category.replace('_', ' ')}
                      </h3>
                      <div className="grid grid-cols-1 gap-2">
                        {perms.map((p) => (
                          <div key={p} className="flex items-center justify-between space-x-2 p-2.5 rounded-lg border hover:bg-secondary/10 transition-colors">
                            <div className="flex flex-col gap-0.5">
                              <Label htmlFor={p} className="text-xs font-semibold cursor-pointer">
                                {p.split('.')[1].charAt(0).toUpperCase() + p.split('.')[1].slice(1)}
                              </Label>
                              <span className="text-[9px] text-muted-foreground font-mono">{p}</span>
                            </div>
                            <Checkbox 
                              id={p} 
                              checked={selectedUser?.permissions.includes(p)}
                              onCheckedChange={() => togglePermission(p)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="pt-6 border-t mt-auto flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setIsSheetOpen(false)}>Discard</Button>
            <Button 
              className="flex-[2] h-12 shadow-lg shadow-primary/20" 
              onClick={() => selectedUser && handleUpdateUser(selectedUser)}
            >
              Update Identity Profile
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decommission Identity Asset?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will soft-delete the user record. They will lose all access immediately, but history will be preserved for audit purposes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground">
              Confirm Deletion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
