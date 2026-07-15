"use client";

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, MoreVertical,
  Ban, UserPlus, Shield, Edit, Trash2, Power, Image as ImageIcon, Upload, X,
  CheckCircle2, XCircle, Clock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { User } from '@/types/auth';
import { useAuth } from '@/context/auth-context';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getUsers, suspendUser, reactivateUser, updateUserPermissionOverride, bulkUploadProfileImages, assignUserRoles, approveUser, rejectUser } from '@/api/users';
import { getRoles } from '@/api/roles';
import { getPermissions } from '@/api/permissions';
import { getWorkingLocations, getDepartments } from '@/api/working_locations';
import { useSearchParams, useRouter } from 'next/navigation';
import { userFriendlyError } from '@/lib/error-message';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl, cn } from '@/lib/utils';
import { PermissionGate } from '@/components/auth/permission-gate';
import { ProtectedRoute } from '@/components/auth/protected-route';

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
    avatar_url: apiUser.avatar_url,
  };
}

export default function UsersManagementPage() {
  return (
    <ProtectedRoute requiredPermission="users.read">
      <Suspense fallback={null}>
        <UsersManagementContent />
      </Suspense>
    </ProtectedRoute>
  );
}

function flattenPermissionModules(modules: any[]): any[] {
  if (!Array.isArray(modules)) return [];
  return modules.flatMap((m) =>
    (m?.permissions ?? []).map((p: any) => ({
      key: p.key ?? p.permission_key,
      permission_key: p.key ?? p.permission_key,
      name: p.name,
      module: m.module,
    })),
  );
}

function UsersManagementContent() {
  const { user: currentUser, hasPermission } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [, setIsSaving] = useState(false);

  // Pending-user approval panel state
  const [approveWorkingLocationId, setApproveWorkingLocationId] = useState('');
  const [approveDepartmentId, setApproveDepartmentId] = useState('');
  const [approveRoleIds, setApproveRoleIds] = useState<string[]>([]);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const hasHandledDeepLink = useRef(false);
  
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    // Users, roles, and permissions each require their own permission
    // (users.read, roles.manage, permissions.read respectively). A
    // BRANCH_MANAGER may legitimately have users.read but not
    // roles.manage/permissions.read. Previously these three calls were
    // combined in a single Promise.all, so a 403 on either of the
    // roles/permissions calls rejected the whole batch and the page
    // rendered as if the user had no access at all, even though they
    // could see users just fine. Fetch independently instead, and only
    // request roles/permissions when the current user actually has the
    // permission to use them (avoids noisy 403s and wasted requests).
    try {
      const usersData = await getUsers();
      const userList = usersData.users || usersData;
      setUsers(userList.map(mapApiUser));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Failed to load users",
        description: userFriendlyError(error, "Please check your connection and try again."),
      });
    }

    const canSeeRoleList =
      hasPermission('roles.manage') ||
      hasPermission('roles.manage_own_location') ||
      hasPermission('users.update') ||
      hasPermission('users.approve');

    if (canSeeRoleList) {
      try {
        const rolesData = await getRoles();
        setRoles(rolesData);
      } catch (error: any) {
        // Non-fatal: role assignment UI just stays empty.
        console.error('Failed to load roles:', error);
      }
    }

    if (hasPermission('permissions.read') || hasPermission('permissions.assign')) {
      try {
        const permsData = await getPermissions();
        setAllPermissions(flattenPermissionModules(permsData));
      } catch (error: any) {
        // Non-fatal: permission override UI just stays empty.
        console.error('Failed to load permissions:', error);
      }
    }

    if (hasPermission('users.approve')) {
      try {
        const [locRes, depRes] = await Promise.all([getWorkingLocations(), getDepartments()]);
        setLocations(locRes.working_locations || (Array.isArray(locRes) ? locRes : []));
        setDepartments(depRes.departments || (Array.isArray(depRes) ? depRes : []));
      } catch (error) {
        // Non-fatal: the approval panel's branch/department selects just stay empty.
        console.error('Failed to load locations/departments:', error);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (hasHandledDeepLink.current) return;
    const editUuid = searchParams?.get('edit');
    if (!editUuid || users.length === 0) return;
    const target = users.find(u => u.id === editUuid || u.uuid === editUuid);
    if (target) {
      hasHandledDeepLink.current = true;
      openUserSheet(target);
    }
  }, [users, searchParams]);

  const handleUpdateRoles = async (userId: string, roleIds: string[]) => {
    setIsSaving(true);
    try {
      await assignUserRoles(userId, roleIds);
      toast({ title: "Roles Updated", description: "The user's roles have been successfully updated." });
      loadData();
    } catch (error) {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update roles." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePermission = async (userId: string, permissionKey: string, currentAllowed: boolean) => {
    try {
      await updateUserPermissionOverride(userId, permissionKey, !currentAllowed);
      toast({ title: "Permission Updated", description: `Permission override for ${permissionKey} updated.` });
      // Update local state for immediate feedback
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          const newOverrides = [...(u.permission_overrides || [])];
          const idx = newOverrides.findIndex(o => o.permission_key === permissionKey);
          if (idx > -1) {
            newOverrides[idx] = { ...newOverrides[idx], is_allowed: !currentAllowed };
          } else {
            newOverrides.push({ permission_id: '', permission_key: permissionKey, is_allowed: !currentAllowed });
          }
          return { ...u, permission_overrides: newOverrides };
        }
        return u;
      }));
    } catch (error) {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update permission override." });
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      await suspendUser(userId);
      toast({ title: "User Suspended", description: "Account access has been revoked." });
      loadData();
      setIsEditSheetOpen(false);
    } catch (error) {
      toast({ variant: "destructive", title: "Action Failed", description: "Could not suspend user." });
    }
  };

  const openUserSheet = (u: User) => {
    setSelectedUser(u);
    setApproveWorkingLocationId(currentUser?.location_id ?? '');
    setApproveDepartmentId('');
    setApproveRoleIds([]);
    setRejectReason('');
    setIsEditSheetOpen(true);
  };

  const handleApproveUser = async (userId: string) => {
    if (approveRoleIds.length === 0) {
      toast({ variant: "destructive", title: "Select a role", description: "Choose at least one role before approving this account." });
      return;
    }
    setIsApproving(true);
    try {
      await approveUser(userId, {
        working_location_id: approveWorkingLocationId || undefined,
        department_id: approveDepartmentId || undefined,
        role_ids: approveRoleIds,
      });
      toast({ title: "User Approved", description: "The account is now active." });
      setIsEditSheetOpen(false);
      router.replace(window.location.pathname);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Approval Failed", description: userFriendlyError(error, "Could not approve this user.") });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectUser = async (userId: string) => {
    setIsRejecting(true);
    try {
      await rejectUser(userId, rejectReason || "Rejected by administrator.");
      toast({ variant: "destructive", title: "User Rejected", description: "The registration has been rejected." });
      setRejectConfirmOpen(false);
      setIsEditSheetOpen(false);
      router.replace(window.location.pathname);
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Rejection Failed", description: userFriendlyError(error, "Could not reject this user.") });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleBulkUpload = async () => {
    if (uploadingFiles.length === 0) return;
    setIsUploading(true);
    try {
      // Build mappings: Filename -> Email (assume filename is email.png or similar)
      const mappings: Record<string, string> = {};
      uploadingFiles.forEach(file => {
        const identifier = file.name.split('.')[0]; // Use filename without extension as email/ID
        mappings[file.name] = identifier;
      });

      await bulkUploadProfileImages(uploadingFiles, mappings);
      toast({ title: "Upload Success", description: `${uploadingFiles.length} profile pictures updated.` });
      setIsBulkUploadOpen(false);
      setUploadingFiles([]);
      loadData();
    } catch (error) {
      toast({ variant: "destructive", title: "Upload Failed", description: "Check file names and try again." });
    } finally {
      setIsUploading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    (u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     u.email.toLowerCase().includes(searchTerm.toLowerCase())) &&
    u.id !== currentUser?.id &&
    !u.roles?.some(role => ['SUPER_ADMIN'].includes(role))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Personnel Infrastructure</h1>
          <p className="text-muted-foreground">Manage corporate identities and role-based access.</p>
        </div>
        <div className="flex gap-2">
            <PermissionGate permission="users.update">
                <Button variant="outline" className="h-11 border-dashed" onClick={() => setIsBulkUploadOpen(true)}>
                    <ImageIcon className="mr-2 h-4 w-4" /> Bulk Avatars
                </Button>
            </PermissionGate>
            <PermissionGate permission="users.create">
                <Button className="h-11 px-6 shadow-lg shadow-primary/20">
                    <UserPlus className="mr-2 h-4 w-4" /> Create User
                </Button>
            </PermissionGate>
        </div>
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
                    <Avatar className="h-10 w-10 border shadow-sm">
                      <AvatarImage src={getAvatarUrl(user.avatar_url)} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold">{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
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
                <TableCell>
                    <Badge variant={user.status === 'APPROVED' ? 'default' : user.status === 'PENDING' ? 'secondary' : 'destructive'} className={user.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''}>
                        {user.status}
                    </Badge>
                </TableCell>
                <TableCell>
                  <PermissionGate permission="users.update">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => openUserSheet(user)}>
                          <Edit className="mr-2 h-4 w-4 text-primary" /> Edit user
                        </DropdownMenuItem>
                        {user.status === 'PENDING' && (
                          <PermissionGate permission="users.approve">
                            <DropdownMenuItem onClick={() => openUserSheet(user)} className="text-emerald-600">
                              <CheckCircle2 className="mr-2 h-4 w-4" /> Review &amp; approve
                            </DropdownMenuItem>
                          </PermissionGate>
                        )}
                        <DropdownMenuSeparator />
                        <PermissionGate permission="users.delete">
                          <DropdownMenuItem 
                            className="text-destructive" 
                            onClick={() => { setUserToDelete(user.id); setDeleteConfirmOpen(true); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remove user
                          </DropdownMenuItem>
                        </PermissionGate>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </PermissionGate>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Administrative User Control</SheetTitle>
            <SheetDescription>
              Adjust permissions, roles, and account status for {selectedUser?.name}.
            </SheetDescription>
          </SheetHeader>

          {selectedUser && (
            <div className="space-y-8 py-4">
              <div className="bg-secondary/20 p-4 rounded-xl flex items-center gap-4 border">
                <Avatar className="h-14 w-14 border shadow-sm">
                  <AvatarImage src={getAvatarUrl(selectedUser.avatar_url)} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xl">{selectedUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-bold text-lg">{selectedUser.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <Badge className="ml-auto uppercase text-[10px] tracking-widest">{selectedUser.status}</Badge>
              </div>

              {selectedUser.status === 'PENDING' ? (
                <PermissionGate permission="users.approve" fallback={
                  <p className="text-sm text-muted-foreground italic p-4 bg-secondary/20 rounded-xl border">
                    This account is awaiting approval. You don't have permission to approve or reject registrations.
                  </p>
                }>
                  <div className="space-y-4 p-4 rounded-xl border-2 border-amber-300 bg-amber-50/50">
                    <div className="flex items-center gap-2 text-amber-700">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-bold">Awaiting approval</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Choose a branch and at least one role, then approve to activate this account, or reject to deny it.
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Branch</Label>
                        <select
                          className="w-full h-9 rounded-lg border bg-white px-2 text-sm"
                          value={approveWorkingLocationId}
                          onChange={(e) => { setApproveWorkingLocationId(e.target.value); setApproveDepartmentId(''); }}
                        >
                          <option value="">Select branch</option>
                          {locations.map((l: any) => (
                            <option key={l.uuid ?? l.id} value={l.uuid ?? l.id}>{l.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Department (optional)</Label>
                        <select
                          className="w-full h-9 rounded-lg border bg-white px-2 text-sm"
                          value={approveDepartmentId}
                          onChange={(e) => setApproveDepartmentId(e.target.value)}
                        >
                          <option value="">No department</option>
                          {departments
                            .filter((d: any) => !approveWorkingLocationId || String(d.working_location_id) === String(approveWorkingLocationId) || d.working_location?.uuid === approveWorkingLocationId)
                            .map((d: any) => (
                              <option key={d.uuid ?? d.id} value={d.uuid ?? d.id}>{d.name}</option>
                            ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Assign role(s)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {roles.map((role: any) => (
                          <label key={role.uuid ?? role.id} className="flex items-center gap-2 text-xs bg-white rounded-lg border px-2 py-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={approveRoleIds.includes(role.uuid ?? role.id)}
                              onChange={(e) => {
                                const id = role.uuid ?? role.id;
                                setApproveRoleIds(prev => e.target.checked ? [...prev, id] : prev.filter(r => r !== id));
                              }}
                            />
                            {role.name}
                            {role.working_location?.name && (
                              <span className="text-[9px] text-muted-foreground ml-auto">({role.working_location.name})</span>
                            )}
                          </label>
                        ))}
                        {roles.length === 0 && <p className="text-xs text-muted-foreground col-span-2">No roles available.</p>}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        disabled={isApproving}
                        onClick={() => handleApproveUser(selectedUser.id)}
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" /> {isApproving ? 'Approving...' : 'Approve account'}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 text-destructive border-destructive/20 hover:bg-destructive/5"
                        onClick={() => setRejectConfirmOpen(true)}
                      >
                        <XCircle className="mr-2 h-4 w-4" /> Reject
                      </Button>
                    </div>
                  </div>
                </PermissionGate>
              ) : (
              <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-bold">Primary Account Roles</Label>
                  <Badge variant="outline">{selectedUser.roles?.length} Assigned</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {!(hasPermission('roles.manage') || hasPermission('roles.manage_own_location') || hasPermission('users.update')) && (
                    <p className="col-span-2 text-xs text-muted-foreground italic">
                      You do not have permission to manage roles.
                    </p>
                  )}
                  {roles.map((role) => {
                    const isAssigned = selectedUser.roles?.includes(role.name);
                    const isSystemRole = ['SUPER_ADMIN'].includes(role.name);
                    
                    return (
                      <Button
                        key={role.uuid}
                        variant={isAssigned ? "default" : "outline"}
                        size="sm"
                        disabled={isSystemRole && currentUser?.role !== 'SUPER_ADMIN'}
                        className={cn(
                          "justify-start h-auto py-2 px-3 text-xs font-semibold rounded-lg",
                          isAssigned ? "shadow-md shadow-primary/20" : "bg-transparent"
                        )}
                        onClick={() => {
                          if (!selectedUser) return;
                          const isAssigned = (selectedUser.roles || []).includes(role.name);
                          const nextRoles = isAssigned
                            ? (selectedUser.roles || []).filter((r) => r !== role.name)
                            : [...(selectedUser.roles || []), role.name];

                          const roleIds = roles
                            .filter((r) => nextRoles.includes(r.name))
                            .map((r) => r.uuid);

                          handleUpdateRoles(selectedUser.id, roleIds);

                          // Optimistic update
                          setSelectedUser({
                            ...selectedUser,
                            roles: nextRoles,
                          });
                        }}
                      >
                        <Shield className={cn("mr-2 h-3.5 w-3.5", isAssigned ? "text-white" : "text-muted-foreground")} />
                        {role.name.replace('_', ' ')}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {hasPermission('permissions.assign') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-bold">Security Overrides</Label>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Direct Permission Injection</span>
                  </div>
                  <ScrollArea className="h-[250px] border rounded-xl p-4 bg-slate-50">
                    <div className="space-y-4">
                      {allPermissions.map((perm) => {
                        const override = selectedUser.permission_overrides?.find(o => o.permission_key === perm.key);
                        const isAllowed = override ? override.is_allowed : selectedUser.permissions.includes(perm.key);
                        
                        return (
                          <div key={perm.key} className="flex items-center justify-between group">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold group-hover:text-primary transition-colors">{perm.name}</span>
                              <span className="text-[10px] text-muted-foreground">{perm.key}</span>
                            </div>
                            <Switch 
                              checked={isAllowed} 
                              onCheckedChange={() => {
                                handleTogglePermission(selectedUser.id, perm.key, isAllowed);
                                // Optimistic update
                                const newOverrides = [...(selectedUser.permission_overrides || [])];
                                const idx = newOverrides.findIndex(o => o.permission_key === perm.key);
                                if (idx > -1) {
                                  newOverrides[idx] = { ...newOverrides[idx], is_allowed: !isAllowed };
                                } else {
                                  newOverrides.push({ permission_id: perm.key, permission_key: perm.key, is_allowed: !isAllowed });
                                }
                                
                                // Also update permissions list for immediate UI consistency
                                let nextPermissions = [...selectedUser.permissions];
                                if (!isAllowed) {
                                    if (!nextPermissions.includes(perm.key)) nextPermissions.push(perm.key);
                                } else {
                                    nextPermissions = nextPermissions.filter(p => p !== perm.key);
                                }

                                setSelectedUser({ ...selectedUser, permission_overrides: newOverrides, permissions: nextPermissions });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <p className="text-[10px] text-muted-foreground italic">
                    * Overrides take precedence over role-based permissions. Denying a permission here will remove it even if it's granted by a role.
                  </p>
                </div>
              )}

              <div className="pt-4 border-t flex items-center justify-between gap-4">
                <div className="flex flex-col">
                  <span className="text-sm font-bold">Account Status</span>
                  <span className="text-xs text-muted-foreground">Manage user accessibility and sessions.</span>
                </div>
                {selectedUser.status === 'SUSPENDED' ? (
                  <Button variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100 font-bold" onClick={() => reactivateUser(selectedUser.id).then(() => loadData())}>
                    <Power className="mr-2 h-4 w-4" /> Reactive Account
                  </Button>
                ) : (
                  <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/5 font-bold" onClick={() => handleSuspendUser(selectedUser.id)}>
                    <Ban className="mr-2 h-4 w-4" /> Suspend Account
                  </Button>
                )}
              </div>
              </>
              )}
            </div>
          )}
          
          <SheetFooter className="mt-8">
              <Button variant="secondary" className="w-full" onClick={() => setIsEditSheetOpen(false)}>Close Interface</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Bulk Upload Dialog */}
      <Dialog open={isBulkUploadOpen} onOpenChange={setIsBulkUploadOpen}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>Bulk Profile Pictures</DialogTitle>
                <DialogDescription>
                    Upload multiple PNG/JPEG files. Name each file with the user's email or National ID (e.g., "jean@reg.rw.jpg").
                </DialogDescription>
            </DialogHeader>
            <div className="py-6 space-y-4">
                <div 
                    className="border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Upload className="h-8 w-8" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-slate-900">Click to select files</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG or JPEG up to 2MB each</p>
                    </div>
                    <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={(e) => setUploadingFiles(Array.from(e.target.files || []))}
                    />
                </div>

                {uploadingFiles.length > 0 && (
                    <ScrollArea className="max-h-48 border rounded-xl p-2 bg-white">
                        <div className="space-y-2">
                            {uploadingFiles.map((f, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs">
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="h-3 w-3 text-slate-400" />
                                        <span className="truncate max-w-[200px]">{f.name}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setUploadingFiles(prev => prev.filter((_, idx) => idx !== i))}>
                                        <X className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsBulkUploadOpen(false)}>Cancel</Button>
                <Button onClick={handleBulkUpload} disabled={uploadingFiles.length === 0 || isUploading} className="min-w-32">
                    {isUploading ? "Uploading..." : `Upload ${uploadingFiles.length} Images`}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will suspend the user account. They will no longer be able to log in or access the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => userToDelete && handleSuspendUser(userToDelete)}
            >
              Confirm Suspension
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectConfirmOpen} onOpenChange={setRejectConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this registration?</AlertDialogTitle>
            <AlertDialogDescription>
              The account will be marked as rejected and the person will not be able to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-xs font-bold">Reason (optional)</Label>
            <Input
              placeholder="e.g. Duplicate account, wrong branch..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isRejecting}
              onClick={() => selectedUser && handleRejectUser(selectedUser.id)}
            >
              {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
