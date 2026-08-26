"use client";

import { useEffect, useState, useRef, Suspense } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/ui/pagination";
import {
  SearchMd, DotsVertical,
  SlashCircle01 as Ban, UserPlus01 as UserPlus, Shield01 as Shield, Edit05 as Edit, Power01 as Power,
  Image03 as ImageIcon, Upload01 as Upload, XClose as X,
  CheckCircle, XCircle, Clock
} from '@untitledui/icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { getUsers, suspendUser, reactivateUser, updateUserPermissionOverride, bulkUploadProfileImages, assignUserRoles, approveUser, rejectUser, updateUser, uploadUserAvatar, createUser } from '@/api/users';
import { getRoles } from '@/api/roles';
import { getPermissions } from '@/api/permissions';
import { getWorkingLocations, getDepartments } from '@/api/working_locations';
import { useSearchParams, useRouter } from 'next/navigation';
import { userFriendlyError } from '@/lib/error-message';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { getAvatarUrl, cn } from '@/lib/utils';
import { PermissionGate } from '@/components/auth/permission-gate';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { PageHeader } from '@/components/layout/page-header';
import { InlineStateNote, LoadingState, TableStateRow } from '@/components/layout/page-state';
import { StatusBadge } from '@/components/ui/status-badge';

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

const createUserSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required."),
  last_name: z.string().trim().min(1, "Last name is required."),
  email: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9._%+-]+@(gmail\.com|reg\.com|yahoo\.com|reg\.rw)$/, "Use a Gmail, Yahoo, reg.com, or reg.rw email."),
  phone_number: z
    .string()
    .trim()
    .regex(/^\+2507[2389][0-9]{7}$/, "Use a valid Rwanda number, for example +250788000000."),
  gender: z.enum(["MALE", "FEMALE"]),
  working_location_id: z.string().optional(),
  department_id: z.string().optional(),
  role_ids: z.array(z.string()).min(1, "Select at least one role."),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;

const createUserDefaults: CreateUserFormValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone_number: "",
  gender: "MALE",
  working_location_id: "",
  department_id: "",
  role_ids: [],
};

export default function UsersManagementPage() {
  return (
    <ProtectedRoute requiredPermission="users.read">
      <Suspense
        fallback={
          <LoadingState
            title="Loading user administration"
            description="Preparing accounts, roles, permissions, and approval queues."
          />
        }
      >
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
      description: p.description,
      module: m.module,
    })),
  );
}

function UsersManagementContent() {
  const { user: currentUser, hasPermission, accessToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canReadAllBranches = hasPermission('branches.read_all');
  const canUpdateUsers = hasPermission('users.update');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [allPermissions, setAllPermissions] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const USERS_PAGE_SIZE = 25;
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [, setIsSaving] = useState(false);
  const [editWorkingLocationId, setEditWorkingLocationId] = useState('');
  const [editDepartmentId, setEditDepartmentId] = useState('');
  const [isUpdatingAssignment, setIsUpdatingAssignment] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const createUserForm = useForm<CreateUserFormValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: createUserDefaults,
  });
  const createWorkingLocationId = createUserForm.watch('working_location_id');
  const createDepartmentId = createUserForm.watch('department_id');
  const createRoleIds = createUserForm.watch('role_ids');
  const createGender = createUserForm.watch('gender');

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
  const permissionSignature = (currentUser?.permissions ?? []).join('|');

  const loadData = async () => {
    // Users, roles, and permissions each need their own permission. Fetch
    // independently (not Promise.all) so a 403 on roles/permissions doesn't
    // also blank out the users list for someone who only lacks those two.
    setIsDataLoading(true);
    setLoadError(null);
    try {
      try {
        const usersData = await getUsers();
        const userList = usersData.users || usersData;
        setUsers(userList.map(mapApiUser));
      } catch (error: any) {
        const message = userFriendlyError(error, "Please check your connection and try again.");
        setLoadError(message);
        toast({
          variant: "destructive",
          title: "Failed to load users",
          description: message,
        });
      }

      const canSeeRoleList =
        hasPermission('roles.manage') ||
        hasPermission('roles.manage_own_location') ||
        hasPermission('users.create') ||
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

      if (hasPermission('users.create') || hasPermission('users.approve') || canUpdateUsers) {
        try {
          const [locRes, depRes] = await Promise.all([
            canReadAllBranches ? getWorkingLocations() : Promise.resolve({ working_locations: [] }),
            getDepartments(undefined, { forAssignment: true }),
          ]);
          setLocations(
            canReadAllBranches
              ? locRes.working_locations || (Array.isArray(locRes) ? locRes : [])
              : [],
          );
          setDepartments(depRes.departments || (Array.isArray(depRes) ? depRes : []));
        } catch (error) {
          // Non-fatal: the approval panel's branch/department selects just stay empty.
          console.error('Failed to load locations/departments:', error);
        }
      }
    } finally {
      setIsDataLoading(false);
    }
  };

  const resetCreateUserForm = () => {
    createUserForm.reset({
      ...createUserDefaults,
      working_location_id: canReadAllBranches ? "" : (currentUser?.location_id ?? ""),
    });
  };

  const openCreateUserDialog = () => {
    resetCreateUserForm();
    setIsCreateUserOpen(true);
  };

  const toggleCreateUserRole = (roleId: string, checked: boolean) => {
    const currentRoles = createUserForm.getValues("role_ids");
    createUserForm.setValue(
      "role_ids",
      checked
        ? Array.from(new Set([...currentRoles, roleId]))
        : currentRoles.filter((id) => id !== roleId),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const handleCreateUser = async (values: CreateUserFormValues) => {
    const workingLocationId = canReadAllBranches
      ? values.working_location_id
      : (currentUser?.location_id ?? values.working_location_id);

    if (canReadAllBranches && !workingLocationId) {
      createUserForm.setError("working_location_id", {
        message: "Select a branch before creating this user.",
      });
      return;
    }

    setIsCreatingUser(true);
    try {
      await createUser({
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        email: values.email.trim(),
        phone_number: values.phone_number.trim(),
        gender: values.gender,
        working_location_id: workingLocationId || undefined,
        department_id: values.department_id || undefined,
        role_ids: values.role_ids,
      });
      toast({
        title: "User Created",
        description: "The account is active and a password setup link was sent by email.",
      });
      setIsCreateUserOpen(false);
      resetCreateUserForm();
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Create Failed",
        description: userFriendlyError(error, "Could not create this user."),
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [accessToken, currentUser?.id, permissionSignature]);

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
    } catch {
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
    } catch {
      toast({ variant: "destructive", title: "Update Failed", description: "Could not update permission override." });
    }
  };

  const handleSuspendUser = async (userId: string) => {
    try {
      await suspendUser(userId);
      toast({ title: "User Suspended", description: "Account access has been revoked." });
      loadData();
      setIsEditSheetOpen(false);
    } catch {
      toast({ variant: "destructive", title: "Action Failed", description: "Could not suspend user." });
    }
  };

  const departmentBelongsToLocation = (department: any, locationId: string) => {
    if (!canReadAllBranches) return true;
    if (!locationId) return true;
    return String(department.working_location_id) === String(locationId)
      || department.working_location?.uuid === locationId
      || String(department.working_location?.id) === String(locationId);
  };

  const handleUpdateAssignment = async () => {
    if (!selectedUser) return;
    if (canReadAllBranches && !editWorkingLocationId) {
      toast({ variant: "destructive", title: "Select a branch", description: "Choose a branch before saving this user." });
      return;
    }

    setIsUpdatingAssignment(true);
    try {
      const response = await updateUser(selectedUser.id, {
        ...(canReadAllBranches ? { working_location_id: editWorkingLocationId } : {}),
        department_id: editDepartmentId || null,
      });
      const mappedUser = mapApiUser(response.user ?? response);
      setSelectedUser(mappedUser);
      setUsers((current) => current.map((item) => item.id === mappedUser.id ? mappedUser : item));
      toast({ title: "User Updated", description: "Branch and department assignment saved." });
      loadData();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Update Failed", description: userFriendlyError(error, "Could not update this user.") });
    } finally {
      setIsUpdatingAssignment(false);
    }
  };

  const openUserSheet = (u: User) => {
    setSelectedUser(u);
    setEditWorkingLocationId(u.location_id ?? currentUser?.location_id ?? '');
    setEditDepartmentId(u.department_id ?? '');
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
    } catch {
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
  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PAGE_SIZE));
  const paginatedUsers = filteredUsers.slice(
    (usersPage - 1) * USERS_PAGE_SIZE,
    usersPage * USERS_PAGE_SIZE,
  );

  useEffect(() => {
    setUsersPage(1);
  }, [searchTerm]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personnel Infrastructure"
        description="Manage corporate identities and role-based access."
        actions={
          <>
            <PermissionGate permission="users.update">
                <Button variant="outline" className="h-11 border-dashed" onClick={() => setIsBulkUploadOpen(true)}>
                    <ImageIcon className="mr-2 h-4 w-4" size={16} /> Bulk Avatars
                </Button>
            </PermissionGate>
            <PermissionGate permission="users.create">
                <Button className="h-11 px-6 shadow-sm shadow-primary/20" onClick={openCreateUserDialog}>
                    <UserPlus className="mr-2 h-4 w-4" size={16} /> Create User
                </Button>
            </PermissionGate>
          </>
        }
      />

      <div className="flex items-center gap-4 bg-card p-4 rounded-lg shadow-sm border border-border">
        <div className="relative flex-1">
          <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" size={16} />
          <Input
            placeholder="Search users by name or email..."
            className="pl-10 h-11 border border-border bg-secondary/30"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden overflow-x-auto">
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
            {isDataLoading ? (
              <TableStateRow
                colSpan={5}
                tone="info"
                title="Loading users"
                description="Preparing accounts, roles, permissions, and approval queues."
              />
            ) : loadError ? (
              <TableStateRow
                colSpan={5}
                tone="destructive"
                title="Users could not load"
                description={loadError}
              />
            ) : filteredUsers.length === 0 ? (
              <TableStateRow
                colSpan={5}
                title="No users found"
                description="Adjust search, role, branch, or status filters before inviting or approving users."
              />
            ) : paginatedUsers.map((user) => (
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
                  <Badge variant="outline" className="font-bold">
                    {user.role.replace('_', ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-medium">{user.permissions.length} permissions</span>
                </TableCell>
                <TableCell>
                    <StatusBadge
                      label={user.status}
                      tone={
                        user.status === 'APPROVED' ? 'success'
                        : user.status === 'PENDING' ? 'warning'
                        : 'destructive'
                      }
                    />
                </TableCell>
                <TableCell>
                  <PermissionGate permission="users.update">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Open actions for ${user.name}`}>
                          <DotsVertical className="h-4 w-4" size={16} />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => openUserSheet(user)}>
                          <Edit className="mr-2 h-4 w-4 text-primary" size={16} /> Edit user
                        </DropdownMenuItem>
                        {user.status === 'PENDING' && (
                          <PermissionGate permission="users.approve">
                            <DropdownMenuItem onClick={() => openUserSheet(user)} className="text-success">
                              <CheckCircle className="mr-2 h-4 w-4" size={16} /> Review &amp; approve
                            </DropdownMenuItem>
                          </PermissionGate>
                        )}
                        <DropdownMenuSeparator />
                        <PermissionGate permission="users.delete">
                          <DropdownMenuItem 
                            className="text-destructive" 
                            onClick={() => { setUserToDelete(user.id); setDeleteConfirmOpen(true); }}
                          >
                            <Ban className="mr-2 h-4 w-4" size={16} /> Remove user
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
        <Pagination
          page={usersPage}
          totalPages={usersTotalPages}
          total={filteredUsers.length}
          limit={USERS_PAGE_SIZE}
          onPageChange={setUsersPage}
        />
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
              <div className="bg-secondary/20 p-4 rounded-lg flex items-center gap-4 border">
                <AvatarUpload
                  size="md"
                  avatarUrl={selectedUser.avatar_url}
                  fallbackText={selectedUser.name}
                  onUpload={(file) => uploadUserAvatar(selectedUser.id, file)}
                  onUploaded={(avatar_url) => {
                    setSelectedUser((current) => current ? { ...current, avatar_url } : current);
                    setUsers((current) => current.map((item) => item.id === selectedUser.id ? { ...item, avatar_url } : item));
                  }}
                />
                <div>
                  <h3 className="font-bold text-lg">{selectedUser.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                </div>
                <Badge className="ml-auto uppercase text-[10px]">{selectedUser.status}</Badge>
              </div>

              {selectedUser.status === 'PENDING' ? (
                <PermissionGate permission="users.approve" fallback={
                  <p className="text-sm text-muted-foreground italic p-4 bg-secondary/20 rounded-lg border border-border">
                    This account is awaiting approval. You don't have permission to approve or reject registrations.
                  </p>
                }>
                  <div className="space-y-4 p-4 rounded-lg border-2 border-warning/30 bg-warning/5">
                    <div className="flex items-center gap-2 text-warning">
                      <Clock className="h-4 w-4" size={16} />
                      <span className="text-sm font-bold">Awaiting approval</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Choose a branch and at least one role, then approve to activate this account, or reject to deny it.
                    </p>

                    <div className={cn("grid gap-3", canReadAllBranches ? "grid-cols-2" : "grid-cols-1")}>
                      {canReadAllBranches && (
                        <div className="space-y-1.5">
                          <Label className="text-xs font-bold">Branch</Label>
                          <Select
                            value={approveWorkingLocationId || 'none'}
                            onValueChange={(value) => { setApproveWorkingLocationId(value === 'none' ? '' : value); setApproveDepartmentId(''); }}
                          >
                            <SelectTrigger className="h-9 bg-card text-sm">
                              <SelectValue placeholder="Select branch" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Select branch</SelectItem>
                              {locations.map((l: any) => (
                                <SelectItem key={l.uuid ?? l.id} value={l.uuid ?? l.id}>{l.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Department (optional)</Label>
                        <Select
                          value={approveDepartmentId || 'none'}
                          onValueChange={(value) => setApproveDepartmentId(value === 'none' ? '' : value)}
                        >
                          <SelectTrigger className="h-9 bg-card text-sm">
                            <SelectValue placeholder="No department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No department</SelectItem>
                            {departments
                              .filter((d: any) => !approveWorkingLocationId || String(d.working_location_id) === String(approveWorkingLocationId) || d.working_location?.uuid === approveWorkingLocationId)
                              .map((d: any) => (
                                <SelectItem key={d.uuid ?? d.id} value={d.uuid ?? d.id}>{d.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Assign role(s)</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {roles.map((role: any) => (
                          <label key={role.uuid ?? role.id} className="flex items-center gap-2 text-xs bg-card rounded-lg border border-border px-2 py-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              className="accent-primary h-3.5 w-3.5"
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
                        {roles.length === 0 && (
                          <InlineStateNote className="col-span-2">
                            No roles are available for this scope. Create a role before approving this account.
                          </InlineStateNote>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        className="flex-1 bg-success text-success-foreground hover:bg-success/90"
                        disabled={isApproving}
                        onClick={() => handleApproveUser(selectedUser.id)}
                      >
                        <CheckCircle className="mr-2 h-4 w-4" size={16} /> {isApproving ? 'Approving...' : 'Approve account'}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 text-destructive border-destructive/20 hover:bg-destructive/5"
                        onClick={() => setRejectConfirmOpen(true)}
                      >
                        <XCircle className="mr-2 h-4 w-4" size={16} /> Reject
                      </Button>
                    </div>
                  </div>
                </PermissionGate>
              ) : (
              <>
              <div className="space-y-4 rounded-lg border border-border bg-secondary/30 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label className="text-base font-bold">{canReadAllBranches ? 'Branch & Department' : 'Department'}</Label>
                    {canReadAllBranches && (
                      <p className="text-xs text-muted-foreground">Update where this user belongs for access and reporting.</p>
                    )}
                  </div>
                  {canReadAllBranches && <Badge variant="outline">{selectedUser.location ?? 'No branch'}</Badge>}
                </div>
                {canUpdateUsers ? (
                  <div className={cn("grid gap-3", canReadAllBranches ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
                    {canReadAllBranches ? (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold">Branch</Label>
                        <Select
                          value={editWorkingLocationId || 'none'}
                          onValueChange={(value) => {
                            setEditWorkingLocationId(value === 'none' ? '' : value);
                            setEditDepartmentId('');
                          }}
                        >
                          <SelectTrigger className="h-9 bg-card text-sm">
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select branch</SelectItem>
                            {locations.map((location: any) => (
                              <SelectItem key={location.uuid ?? location.id} value={location.uuid ?? location.id}>{location.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold">Department</Label>
                      <Select
                        value={editDepartmentId || 'none'}
                        onValueChange={(value) => setEditDepartmentId(value === 'none' ? '' : value)}
                      >
                        <SelectTrigger className="h-9 bg-card text-sm">
                          <SelectValue placeholder="No department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No department</SelectItem>
                          {departments
                            .filter((department: any) => departmentBelongsToLocation(department, editWorkingLocationId || selectedUser.location_id || ''))
                            .map((department: any) => (
                              <SelectItem key={department.uuid ?? department.id} value={department.uuid ?? department.id}>{department.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2 flex justify-end">
                      <Button
                        size="sm"
                        className="min-w-32"
                        onClick={handleUpdateAssignment}
                        disabled={isUpdatingAssignment}
                      >
                        {isUpdatingAssignment ? 'Saving...' : 'Save Assignment'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">You do not have permission to update user assignments.</p>
                )}
              </div>

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
                        <Shield className={cn("mr-2 h-3.5 w-3.5", isAssigned ? "text-primary-foreground" : "text-muted-foreground")} size={14} />
                        {role.name.replace('_', ' ')}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {hasPermission('permissions.assign') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-bold">Permission Overrides</Label>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Per-user exceptions to their role</span>
                  </div>
                  <ScrollArea className="h-[250px] border border-border rounded-lg p-4 bg-secondary/30">
                    <div className="space-y-4">
                      {allPermissions.map((perm) => {
                        const override = selectedUser.permission_overrides?.find(o => o.permission_key === perm.key);
                        const isAllowed = override ? override.is_allowed : selectedUser.permissions.includes(perm.key);
                        
                        return (
                          <div key={perm.key} className="flex items-center justify-between gap-4 group">
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold group-hover:text-primary transition-colors">{perm.name}</span>
                              {perm.description && (
                                <span className="text-[10px] text-muted-foreground">{perm.description}</span>
                              )}
                              <span className="text-[10px] text-muted-foreground/60">{perm.key}</span>
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
                  <Button variant="outline" className="text-success border-success/20 bg-success/5 hover:bg-success/10 font-bold" onClick={() => reactivateUser(selectedUser.id).then(() => loadData())}>
                    <Power className="mr-2 h-4 w-4" size={16} /> Reactive Account
                  </Button>
                ) : (
                  <Button variant="outline" className="text-destructive border-destructive/20 hover:bg-destructive/5 font-bold" onClick={() => handleSuspendUser(selectedUser.id)}>
                    <Ban className="mr-2 h-4 w-4" size={16} /> Suspend Account
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

      <Dialog open={isCreateUserOpen} onOpenChange={(open) => {
        setIsCreateUserOpen(open);
        if (!open) resetCreateUserForm();
      }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={createUserForm.handleSubmit(handleCreateUser)} className="space-y-6">
            <DialogHeader>
              <DialogTitle>Create User</DialogTitle>
              <DialogDescription>
                Create an active account and email a one-time password setup link to the user.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="create-first-name">First name</Label>
                <Input
                  id="create-first-name"
                  {...createUserForm.register("first_name")}
                  autoComplete="given-name"
                />
                {createUserForm.formState.errors.first_name?.message && (
                  <p className="text-xs font-medium text-destructive">
                    {createUserForm.formState.errors.first_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-last-name">Last name</Label>
                <Input
                  id="create-last-name"
                  {...createUserForm.register("last_name")}
                  autoComplete="family-name"
                />
                {createUserForm.formState.errors.last_name?.message && (
                  <p className="text-xs font-medium text-destructive">
                    {createUserForm.formState.errors.last_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  {...createUserForm.register("email")}
                  autoComplete="email"
                />
                {createUserForm.formState.errors.email?.message && (
                  <p className="text-xs font-medium text-destructive">
                    {createUserForm.formState.errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="create-phone">Phone number</Label>
                <Input
                  id="create-phone"
                  {...createUserForm.register("phone_number")}
                  placeholder="+250788000000"
                  autoComplete="tel"
                />
                {createUserForm.formState.errors.phone_number?.message && (
                  <p className="text-xs font-medium text-destructive">
                    {createUserForm.formState.errors.phone_number.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select
                  value={createGender}
                  onValueChange={(value) =>
                    createUserForm.setValue(
                      "gender",
                      value as CreateUserFormValues["gender"],
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={cn("grid gap-4", canReadAllBranches ? "sm:grid-cols-2" : "sm:grid-cols-1")}>
              {canReadAllBranches && (
                <div className="space-y-1.5">
                  <Label>Branch</Label>
                  <Select
                    value={createWorkingLocationId || "none"}
                    onValueChange={(value) => {
                      createUserForm.setValue("working_location_id", value === "none" ? "" : value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      createUserForm.setValue("department_id", "", {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                  >
                    <SelectTrigger className="bg-card">
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent position="item-aligned" className="max-h-[320px]">
                      <SelectItem value="none">Select branch</SelectItem>
                      {locations.map((location: any) => (
                        <SelectItem key={location.uuid ?? location.id} value={location.uuid ?? location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {createUserForm.formState.errors.working_location_id?.message && (
                    <p className="text-xs font-medium text-destructive">
                      {createUserForm.formState.errors.working_location_id.message}
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Select
                  value={createDepartmentId || "none"}
                  onValueChange={(value) =>
                    createUserForm.setValue("department_id", value === "none" ? "" : value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="No department" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned" className="max-h-[320px]">
                    <SelectItem value="none">No department</SelectItem>
                    {departments
                      .filter((department: any) =>
                        departmentBelongsToLocation(
                          department,
                          createWorkingLocationId || currentUser?.location_id || "",
                        ),
                      )
                      .map((department: any) => (
                        <SelectItem key={department.uuid ?? department.id} value={department.uuid ?? department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-base font-bold">Role</Label>
                <Badge variant="outline">{createRoleIds.length} selected</Badge>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {roles.map((role: any) => {
                  const roleId = role.uuid ?? role.id;
                  const isAssigned = createRoleIds.includes(roleId);
                  const isProtected = role.name === "SUPER_ADMIN" && !currentUser?.roles?.includes("SUPER_ADMIN");

                  return (
                    <label
                      key={roleId}
                      className={cn(
                        "flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm",
                        isProtected ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-secondary/30",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={isAssigned}
                        disabled={isProtected}
                        onChange={(event) => toggleCreateUserRole(roleId, event.target.checked)}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {role.name.replace("_", " ")}
                      </span>
                      {role.working_location?.name && (
                        <span className="text-[10px] text-muted-foreground">
                          {role.working_location.name}
                        </span>
                      )}
                    </label>
                  );
                })}
                {roles.length === 0 && (
                  <InlineStateNote className="sm:col-span-2">
                    No roles are available for this scope. Create a role before creating users.
                  </InlineStateNote>
                )}
              </div>
              {createUserForm.formState.errors.role_ids?.message && (
                <p className="text-xs font-medium text-destructive">
                  {createUserForm.formState.errors.role_ids.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingUser || roles.length === 0} className="min-w-36">
                {isCreatingUser ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                <button
                    type="button"
                    className="w-full border-2 border-dashed border-border rounded-lg p-10 flex flex-col items-center justify-center gap-4 bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Select profile image files for bulk upload"
                >
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <Upload className="h-8 w-8" size={32} />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-foreground">Click to select files</p>
                        <p className="text-xs text-muted-foreground mt-1">PNG or JPEG up to 2MB each</p>
                    </div>
                </button>
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={(e) => setUploadingFiles(Array.from(e.target.files || []))}
                />

                {uploadingFiles.length > 0 && (
                    <ScrollArea className="max-h-48 border border-border rounded-lg p-2 bg-card">
                        <div className="space-y-2">
                            {uploadingFiles.map((f, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-xs">
                                    <div className="flex items-center gap-2">
                                        <ImageIcon className="h-3 w-3 text-muted-foreground" size={12} />
                                        <span className="truncate max-w-[200px]">{f.name}</span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => setUploadingFiles(prev => prev.filter((_, idx) => idx !== i))}
                                      aria-label={`Remove ${f.name}`}
                                    >
                                        <X className="h-3 w-3" size={12} />
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
