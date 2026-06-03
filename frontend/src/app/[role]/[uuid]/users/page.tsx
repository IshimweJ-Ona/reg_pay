"use client";

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Search, MoreVertical, CheckCircle, 
  Ban, UserPlus, Shield, Fingerprint, Calendar, Edit, Trash2, Power, PowerOff, Image as ImageIcon, Upload, X
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
import { approveUser, getUsers, rejectUser, suspendUser, updateUserPermissionOverride, bulkUploadProfileImages } from '@/api/users';
import { getWorkingLocations, getDepartments } from '@/api/working_locations';
import { getRoles } from '@/api/roles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { userFriendlyError } from '@/lib/error-message';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils';

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
  const { user: currentUser } = useAuth();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const assignableRoles = useMemo(
    () => roles.filter((role) => !['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ON_MANAGER'].includes(role.name)),
    [roles]
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
    !u.roles?.some(role => ['ADMIN', 'SUPER_ADMIN'].includes(role))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold">Personnel Infrastructure</h1>
          <p className="text-muted-foreground">Manage corporate identities and role-based access.</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" className="h-11 border-dashed" onClick={() => setIsBulkUploadOpen(true)}>
                <ImageIcon className="mr-2 h-4 w-4" /> Bulk Avatars
            </Button>
            <Button className="h-11 px-6 shadow-lg shadow-primary/20">
                <UserPlus className="mr-2 h-4 w-4" /> Create User
            </Button>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => {}}>
                        <Edit className="mr-2 h-4 w-4 text-primary" /> Edit user
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
    </div>
  );
}
