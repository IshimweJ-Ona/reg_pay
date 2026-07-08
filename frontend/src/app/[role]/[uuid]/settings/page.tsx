"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, RotateCw, Save, ShieldCheck } from 'lucide-react';
import { createRole, getRoles, updateRole, type Role } from '@/api/roles';
import { PERMISSION_MODULES, ALL_PERMISSION_KEYS } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';

const emptyRoleForm = {
  name: '',
  description: '',
  permission_keys: [] as string[],
};

export default function SystemSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [savingRole, setSavingRole] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const { toast } = useToast();
  const { user, refreshSession, hasPermission } = useAuth();
  const router = useRouter();
  const canManageRoles = hasPermission('roles.manage');

  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  const permissionsByModule = useMemo(() => {
    return PERMISSION_MODULES.reduce<Record<string, Array<{ key: string; name: string }>>>(
      (acc, mod) => {
        acc[mod.module] = mod.permissions;
        return acc;
      },
      {},
    );
  }, []);

  useEffect(() => {
    if (user && !canManageRoles) {
      router.replace('/unauthorized');
      return;
    }
    if (canManageRoles) loadData();
  }, [canManageRoles, user, router]);

  useEffect(() => {
    if (!selectedRole) return;
    setRoleForm({
      name: selectedRole.name,
      description: selectedRole.description ?? '',
      permission_keys: selectedRole.permission_keys ?? [],
    });
  }, [selectedRole]);

  const loadData = async () => {
    setLoading(true);
    try {
      const rolesData = await getRoles();
      setRoles(rolesData);
      const firstRole = rolesData[0];
      if (firstRole && !selectedRoleId) {
        setSelectedRoleId(firstRole.id);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Settings failed to load',
        description: error?.response?.data?.message ?? 'Could not load roles.',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedRoleId('');
    setRoleForm(emptyRoleForm);
  };

  const togglePermission = (permissionKey: string, checked: boolean) => {
    setRoleForm((prev) => ({
      ...prev,
      permission_keys: checked
        ? Array.from(new Set([...prev.permission_keys, permissionKey]))
        : prev.permission_keys.filter((k) => k !== permissionKey),
    }));
  };

  const handleSaveRole = async () => {
    if (!roleForm.name.trim()) {
      toast({ variant: 'destructive', title: 'Role name required', description: 'Enter a role name before saving.' });
      return;
    }

    setSavingRole(true);
    try {
      const payload = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim(),
        permission_keys: roleForm.permission_keys,
      };
      const saved = selectedRoleId
        ? await updateRole(selectedRoleId, selectedRole?.is_system_role ? {
            description: payload.description,
            permission_keys: payload.permission_keys,
          } : payload)
        : await createRole(payload);

      await loadData();
      setSelectedRoleId(saved.id);
      await refreshSession({ reload: true });
      toast({
        title: selectedRoleId ? 'Role updated' : 'Role created',
        description: 'Permissions changed immediately. The page is reloading with fresh access.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Role save failed',
        description: error?.response?.data?.message ?? 'Please check the role details.',
      });
    } finally {
      setSavingRole(false);
    }
  };

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManageRoles) return null;

  return (
    <div className="max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-headline font-bold">Settings</h1>
        <p className="text-muted-foreground">Create roles and control the permissions each role grants across the system.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Roles
            </CardTitle>
            <CardDescription>Select an existing role or create a new one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={resetCreateForm}>
              <Plus className="h-4 w-4" />
              New role
            </Button>
            <ScrollArea className="h-[520px] pr-3">
              <div className="space-y-2">
                {roles.map((role) => {
                  const permissionCount = role.permission_keys?.length ?? 0;
                  const active = role.id === selectedRoleId;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        active ? 'border-primary bg-primary/5' : 'bg-white hover:bg-secondary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold truncate">{role.name}</span>
                        {role.is_system_role && <Badge variant="outline">System</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{permissionCount} permissions</p>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>{selectedRoleId ? 'Update Role Permissions' : 'Create Role'}</CardTitle>
                <CardDescription>
                  Users assigned to this role receive these permissions on their next request and after the frontend reloads.
                </CardDescription>
              </div>
              <Button variant="outline" className="gap-2" onClick={loadData}>
                <RotateCw className="h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-4">
              <div className="space-y-2">
                <Label>Role Name</Label>
                <Input
                  value={roleForm.name}
                  disabled={selectedRole?.is_system_role}
                  onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g. REGIONAL_MANAGER"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={roleForm.description}
                  onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Short purpose of this role"
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-secondary/20 px-4 py-3">
              <div>
                <p className="text-sm font-bold">Assigned permissions</p>
                <p className="text-xs text-muted-foreground">{roleForm.permission_keys.length} of {ALL_PERMISSION_KEYS.length} selected</p>
              </div>
              <Select
                value="bulk"
                onValueChange={(value) => {
                  if (value === 'all') {
                    setRoleForm((prev) => ({
                      ...prev,
                      permission_keys: ALL_PERMISSION_KEYS,
                    }));
                  }
                  if (value === 'none') {
                    setRoleForm((prev) => ({ ...prev, permission_keys: [] }));
                  }
                }}
              >
                <SelectTrigger className="w-[160px] bg-white">
                  <SelectValue placeholder="Bulk actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bulk">Bulk actions</SelectItem>
                  <SelectItem value="all">Select all</SelectItem>
                  <SelectItem value="none">Clear all</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ScrollArea className="h-[520px] rounded-lg border">
              <div className="divide-y">
                {Object.entries(permissionsByModule).map(([moduleName, modulePermissions]) => (
                  <section key={moduleName} className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-bold">{moduleName}</h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{modulePermissions.length}</Badge>
                        <button
                          type="button"
                          className="text-xs text-primary underline underline-offset-2"
                          onClick={() => {
                            const moduleKeys = modulePermissions.map((p) => p.key);
                            const allChecked = moduleKeys.every((k) => roleForm.permission_keys.includes(k));
                            if (allChecked) {
                              setRoleForm((prev) => ({
                                ...prev,
                                permission_keys: prev.permission_keys.filter((k) => !moduleKeys.includes(k)),
                              }));
                            } else {
                              setRoleForm((prev) => ({
                                ...prev,
                                permission_keys: Array.from(new Set([...prev.permission_keys, ...moduleKeys])),
                              }));
                            }
                          }}
                        >
                          {modulePermissions.every((p) => roleForm.permission_keys.includes(p.key)) ? 'Deselect all' : 'Select all'}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {modulePermissions.map((permission) => {
                        const checked = roleForm.permission_keys.includes(permission.key);
                        return (
                          <label
                            key={permission.key}
                            className="flex min-h-16 cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 hover:bg-secondary/30"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => togglePermission(permission.key, Boolean(value))}
                              className="mt-1"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">{permission.name}</span>
                              <span className="block truncate text-xs text-muted-foreground">{permission.key}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end">
              <Button className="h-11 px-8 shadow-lg shadow-primary/20" onClick={handleSaveRole} disabled={savingRole}>
                {savingRole ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                {selectedRoleId ? 'Save role permissions' : 'Create role'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
