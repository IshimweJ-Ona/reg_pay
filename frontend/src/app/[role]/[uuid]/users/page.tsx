"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, MoreVertical, CheckCircle, 
  Ban, UserPlus, Shield, Fingerprint, Calendar, Edit, Trash2, Power, PowerOff
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
import { User, UserStatus } from '@/types/auth';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { approveUser, getUsers, rejectUser, suspendUser, updateUserPermissionOverride } from '@/api/users';
import { getWorkingLocations, getDepartments } from '@/api/working_locations';
import { getRoles } from '@/api/roles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { userFriendlyError } from '@/lib/error-message';

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
    permission_overrides: apiUser.permission_overrides ?? [],
    department: apiUser.department?.name,
    location: apiUser.working_location?.name,
    department_id: apiUser.department?.uuid,
    location_id: apiUser.working_location?.uuid,
    createdAt: apiUser.created_at,
  };
}

export default function UsersManagementPage() {
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();
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
  const assignableRoles = useMemo(
    () => roles.filter((role) => !['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ON_MANAGER'].includes(role.name)),
    [roles]
  );
  const selectedRole = useMemo(
    () => roles.find((role) => role.name === selectedUser?.role),
    [roles, selectedUser?.role]
  );
  const selectedRolePermissions = selectedRole?.role_permissions?.map((item: any) => item.permission).filter(Boolean) ?? [];
  const selectedRoleIsBranchManager = ['BRANCH_MANAGER'].includes(selectedUser?.role ?? '');
  const disabledPermissionKeys = useMemo(
    () => new Set(
      selectedUser?.permission_overrides
        ?.filter((override) => override.is_allowed === false)
        .map((override) => override.permission_key) ?? []
    ),
    [selectedUser?.permission_overrides]
  );

  const loadData = async () => {
    try {
      const [usersData, rolesData, locsData] = await Promise.all([
        getUsers(),
        getRoles(),
        getWorkingLocations()
      ]);
      const userList = usersData.users || usersData;
      setUsers(userList.map(mapApiUser));
      setRoles(rolesData.filter((role: any) => !['SUPER_ADMIN', 'ADMIN'].includes(role.name)));
      setLocations(locsData.working_locations || locsData);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load data",
        description: userFriendlyError(error, "Please check your connection and try again."),
      });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const editUserId = searchParams.get('edit');
    if (!editUserId || !users.length) return;

    const userToEdit = users.find((item) => item.id === editUserId || item.uuid === editUserId);
    if (userToEdit) {
      handleSheetOpen(userToEdit);
      if (searchParams.get('needsRole')) {
        toast({
          title: "Choose a role",
          description: "Select a role for this user before approving the account.",
        });
      }
    }
  }, [searchParams, users]);

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
        department_id: selectedRoleIsBranchManager ? undefined : updatedUser.department_id,
        role_ids: updatedUser.roles?.length ? updatedUser.roles : undefined
      });
      
      toast({ title: "User updated", description: "The user profile and role were saved." });
      setIsSheetOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: userFriendlyError(error, "Please check the selected branch, department, and role."),
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
      const targetUser = users.find((user) => user.id === userId);
      if (newStatus === 'APPROVED') {
        if (!targetUser?.roles?.length || targetUser.role === 'USER') {
          if (targetUser) handleSheetOpen(targetUser);
          toast({ title: "Choose a role", description: "Select a role before approving this user." });
          return;
        }
        await approveUser(userId, {});
      }
      if (newStatus === 'SUSPENDED') await suspendUser(userId);
      await loadData();
      toast({ title: "Status updated", description: `User status changed to ${newStatus.toLowerCase()}.` });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Status update failed",
        description: userFriendlyError(error, "Please try again."),
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
          title: "User removed",
          description: "The user can no longer access the system."
        });
        setUserToDelete(null);
        setDeleteConfirmOpen(false);
      } catch (error: any) {
        toast({
          variant: "destructive",
          title: "Deletion failed",
          description: userFriendlyError(error, "Please try again."),
        });
      }
    }
  };

  const handlePermissionToggle = async (permission: any) => {
    if (!selectedUser) return;

    const isCurrentlyAllowed = !disabledPermissionKeys.has(permission.permission_key);
    try {
      const result = await updateUserPermissionOverride(
        selectedUser.id,
        permission.uuid ?? permission.permission_key,
        !isCurrentlyAllowed,
      );
      const updatedUser = mapApiUser(result.user);
      setSelectedUser(updatedUser);
      setUsers((items) => items.map((item) => item.id === updatedUser.id ? updatedUser : item));
      toast({
        title: !isCurrentlyAllowed ? "Permission activated" : "Permission deactivated",
        description: `${permission.name} was updated for ${selectedUser.name}.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Permission update failed",
        description: userFriendlyError(error, "Please try again."),
      });
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    u.id !== currentUser?.id &&
    !u.roles?.some(role => ['ADMIN', 'SUPER_ADMIN'].includes(role))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Users</h1>
          <p className="text-muted-foreground">Create users, approve registrations, and assign clear roles.</p>
        </div>
        <Button className="h-11 px-6 shadow-lg shadow-primary/20">
          <UserPlus className="mr-2 h-4 w-4" /> Create User
        </Button>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search users by name or email..." 
            className="pl-10 h-11 border-none bg-secondary/30"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-secondary/50">
            <TableRow>
              <TableHead className="font-bold">User</TableHead>
              <TableHead className="font-bold">Role</TableHead>
              <TableHead className="font-bold">Access</TableHead>
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
                  <span className="text-sm font-medium">{user.permissions.length} permissions</span>
                </TableCell>
                <TableCell>{getStatusBadge(user.status)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => handleSheetOpen(user)}>
                        <Edit className="mr-2 h-4 w-4 text-primary" /> Edit user
                      </DropdownMenuItem>
                      {user.status === 'PENDING' && (
                        <DropdownMenuItem onClick={() => handleSheetOpen(user)}>
                          <Edit className="mr-2 h-4 w-4 text-primary" /> Review pending user
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'APPROVED')}>
                        <CheckCircle className="mr-2 h-4 w-4 text-emerald-600" /> Approve user
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(user.id, 'SUSPENDED')}>
                        <Ban className="mr-2 h-4 w-4 text-amber-600" /> Suspend user
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive" 
                        onClick={() => { setUserToDelete(user.id); setDeleteConfirmOpen(true); }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Remove user
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-5 w-5 text-primary" /> Edit User
            </DialogTitle>
            <DialogDescription className="max-w-2xl">
              Assign the user to a branch and choose the role that controls access.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[calc(92vh-150px)]">
            <div className="grid gap-6 p-6 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="space-y-5">
                <div className="rounded-xl bg-secondary/20 p-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input 
                      value={selectedUser?.name || ''} 
                      onChange={(e) => setSelectedUser(prev => prev ? {...prev, name: e.target.value} : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      value={selectedUser?.email || ''} 
                      onChange={(e) => setSelectedUser(prev => prev ? {...prev, email: e.target.value} : null)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select 
                      onValueChange={(v) => setSelectedUser(prev => prev ? {...prev, role: v as any, roles: [v], department_id: v === 'BRANCH_MANAGER' ? undefined : prev.department_id} : null)} 
                      value={selectedUser?.role}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map((r) => (
                          <SelectItem key={r.uuid} value={r.name}>{r.name.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Select onValueChange={handleLocationChange} value={selectedUser?.location_id}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.uuid} value={loc.uuid}>{loc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!selectedRoleIsBranchManager && <div className="space-y-2">
                    <Label>Department</Label>
                    <Select 
                      onValueChange={(v) => setSelectedUser(prev => prev ? {...prev, department_id: v} : null)} 
                      value={selectedUser?.department_id}
                      disabled={!selectedUser?.location_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedUser?.location_id ? "Select department" : "Select branch first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {departments.map((dept) => (
                          <SelectItem key={dept.uuid} value={dept.uuid}>{dept.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>}
                </div>

                <div className="grid gap-3 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2 break-all">
                    <Fingerprint className="mt-0.5 h-3 w-3 shrink-0" /> ID: {selectedUser?.id}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3 w-3 shrink-0" /> Joined: {selectedUser?.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Permissions in this role
                </h4>
                <div className="max-h-[52vh] overflow-auto rounded-xl border bg-white">
                  <Table>
                    <TableHeader className="sticky top-0 bg-secondary/40">
                      <TableRow>
                        <TableHead className="min-w-[220px]">Permission</TableHead>
                        <TableHead className="min-w-[160px]">Area</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="w-[150px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedRolePermissions.map((permission: any) => {
                        const isAllowed = !disabledPermissionKeys.has(permission.permission_key);
                        return (
                          <TableRow key={permission.permission_key}>
                            <TableCell className="font-medium whitespace-normal">{permission.name}</TableCell>
                            <TableCell className="whitespace-nowrap">{permission.module_name}</TableCell>
                            <TableCell>
                              <Badge
                                variant={isAllowed ? "secondary" : "outline"}
                                className={isAllowed ? "whitespace-nowrap" : "whitespace-nowrap text-muted-foreground"}
                              >
                                {isAllowed ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant={isAllowed ? "outline" : "default"}
                                size="sm"
                                className="h-8 gap-2"
                                onClick={() => handlePermissionToggle(permission)}
                              >
                                {isAllowed ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                {isAllowed ? "Deactivate" : "Activate"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!selectedRolePermissions.length && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-sm text-muted-foreground">
                            Choose a role to see what this user can access.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="border-t px-6 py-4">
            <Button variant="outline" onClick={() => setIsSheetOpen(false)}>Cancel</Button>
            <Button 
              className="h-11 min-w-36 shadow-lg shadow-primary/20" 
              onClick={() => selectedUser && handleUpdateUser(selectedUser)}
            >
              Save user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
          <AlertDialogTitle>Remove user?</AlertDialogTitle>
            <AlertDialogDescription>
              This user will lose access immediately. Their history will stay available for records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive text-destructive-foreground">
              Remove user
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
