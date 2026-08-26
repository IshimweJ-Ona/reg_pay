"use client";

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loading02 as Loader2, Plus, RefreshCw01 as RotateCw, Save01 as Save, ShieldTick as ShieldCheck } from '@untitledui/icons';
import { createRole, getRoles, updateRole, type Role } from '@/api/roles';
import { getSystemConfigs, updateSystemConfig } from '@/api/system-config';
import { PERMISSION_MODULES, ALL_PERMISSION_KEYS, expandPermissionKeys } from '@/lib/permissions';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/auth-context';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState, InlineStateNote, LoadingState, PermissionDeniedState } from '@/components/layout/page-state';

const emptyRoleForm = {
  name: '',
  description: '',
  permission_keys: [] as string[],
};
const OVERTIME_RATE_KEY = 'OVERTIME_RATE_PER_HOUR';
const DEFAULT_OVERTIME_RATE = '2500';

export default function SystemSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [savingOvertime, setSavingOvertime] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [overtimeRate, setOvertimeRate] = useState(DEFAULT_OVERTIME_RATE);
  const { toast } = useToast();
  const { user, refreshSession, hasPermission } = useAuth();
  const router = useRouter();
  const canManageRoles = hasPermission('roles.manage') || hasPermission('roles.manage_own_location');
  const canManageSystemConfig = hasPermission('system-config.manage');
  const canAccessSettings = canManageRoles || canManageSystemConfig;
  // A "manage_own_location" holder without the global "manage" permission
  // only ever sees/edits global roles plus their own branch's roles - the
  // server already enforces this (RolesService); this just labels it in the UI.
  const isBranchScopedRoleManager = !hasPermission('roles.manage') && hasPermission('roles.manage_own_location');

  const selectedRole = roles.find((role) => role.id === selectedRoleId);
  // A branch-scoped role manager can see global roles (so they understand
  // what SUPER_ADMIN/HR/etc. can do) but the server rejects any edit to one -
  // the checklist/save button must reflect that up front instead of letting
  // them fill out a form that always 400s on submit.
  const isReadOnlyGlobalRole =
    isBranchScopedRoleManager && !!selectedRoleId && !selectedRole?.working_location_id;

  const permissionsByModule = useMemo(() => {
    return PERMISSION_MODULES.reduce<Record<string, Array<{ key: string; name: string; description?: string }>>>(
      (acc, mod) => {
        acc[mod.module] = mod.permissions;
        return acc;
      },
      {},
    );
  }, []);

  // A permission can be granted two ways: explicitly checked, or implied by
  // another checked permission (e.g. "payroll.approve_final" always implies
  // "payroll.read"). Showing implied permissions as unchecked would be
  // misleading — the role effectively has them the moment it's saved, even
  // though the raw permission_keys array doesn't literally list them. This
  // set lets the checklist reflect what a role can ACTUALLY do, not just
  // what was manually ticked.
  const effectivePermissionKeys = useMemo(
    () => new Set(expandPermissionKeys(roleForm.permission_keys)),
    [roleForm.permission_keys],
  );

  useEffect(() => {
    if (user && !canAccessSettings) {
      router.replace('/unauthorized');
      return;
    }
  }, [canAccessSettings, user, router]);

  useEffect(() => {
    if (canAccessSettings) {
      loadData();
    }
  }, [canAccessSettings]);

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
    setLoadError(null);
    try {
      if (canManageRoles) {
        const rolesData = await getRoles();
        setRoles(rolesData);
        const firstRole = rolesData[0];
        if (firstRole && !selectedRoleId) {
          setSelectedRoleId(firstRole.id);
        }
      }

      if (canManageSystemConfig) {
        const configs = await getSystemConfigs();
        const overtimeConfig = configs.find((config) => config.key === OVERTIME_RATE_KEY);
        setOvertimeRate(overtimeConfig?.value ?? DEFAULT_OVERTIME_RATE);
      }
    } catch (error: any) {
      const message = error?.response?.data?.message ?? 'Could not load settings.';
      setLoadError(message);
      toast({
        variant: 'destructive',
        title: 'Settings failed to load',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOvertimeRate = async () => {
    const normalizedRate = Number(overtimeRate);
    if (!Number.isFinite(normalizedRate) || normalizedRate < 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid overtime rate',
        description: 'Enter a non-negative RWF amount.',
      });
      return;
    }

    setSavingOvertime(true);
    try {
      const saved = await updateSystemConfig(
        OVERTIME_RATE_KEY,
        normalizedRate.toString(),
        'RWF amount paid per overtime hour across all working locations.',
      );
      setOvertimeRate(saved.value);
      toast({
        title: 'Overtime rate updated',
        description: `Payroll will use RWF ${Number(saved.value).toLocaleString()} per overtime hour.`,
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Overtime save failed',
        description: error?.response?.data?.message ?? 'Could not update overtime settings.',
      });
    } finally {
      setSavingOvertime(false);
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
    if (isReadOnlyGlobalRole) return;
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
      const userHasThisRole = user?.roles?.includes(roleForm.name) || (selectedRole && user?.roles?.includes(selectedRole.name));
      await refreshSession();
      toast({
        title: selectedRoleId ? 'Role updated' : 'Role created',
        description: userHasThisRole
          ? 'Permissions changed immediately. Your access was refreshed.'
          : 'Permissions updated successfully.',
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
      <LoadingState
        title="Loading system settings"
        description="Checking role access, permission modules, and payroll configuration."
      />
    );
  }

  if (!canAccessSettings) {
    return (
      <PermissionDeniedState
        title="Settings permission required"
        description="Role and payroll settings are restricted to administrators with configuration or role-management access."
      />
    );
  }

  if (loadError) {
    return (
      <ErrorState
        title="Settings could not load"
        description={loadError}
        action={<Button onClick={loadData}>Retry</Button>}
      />
    );
  }

  return (
    <div className="max-w-[1800px] space-y-8">
      <PageHeader
        title="Settings"
        description={
          isBranchScopedRoleManager
            ? 'Manage roles and permissions for your own branch.'
            : 'Manage system-wide payroll settings and access controls.'
        }
      />

      {canManageSystemConfig && (
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle>Overtime Settings</CardTitle>
            <CardDescription>Set the RWF amount paid for each overtime hour across all working locations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label>Overtime Rate Per Hour (RWF)</Label>
                <Input
                  type="number"
                  min={0}
                  value={overtimeRate}
                  onChange={(event) => setOvertimeRate(event.target.value)}
                  placeholder={DEFAULT_OVERTIME_RATE}
                />
              </div>
              <Button className="h-10 gap-2" onClick={handleSaveOvertimeRate} disabled={savingOvertime}>
                {savingOvertime ? <Loader2 className="h-4 w-4 animate-spin" size={16} /> : <Save className="h-4 w-4" size={16} />}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {canManageRoles && (
      <div className="space-y-4">
        {isBranchScopedRoleManager && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
            You can manage roles for <span className="font-bold">{user?.location ?? 'your branch'}</span> only.
            Global roles are visible here but can't be edited from your account.
          </div>
        )}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" size={20} /> Roles
            </CardTitle>
            <CardDescription>Select an existing role or create a new one.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={resetCreateForm}>
              <Plus className="h-4 w-4" size={16} />
              New role
            </Button>
            <ScrollArea className="h-[520px] pr-3">
              <div className="space-y-2">
                {roles.length === 0 ? (
                  <InlineStateNote>
                    No roles are available for this scope. Create a role before assigning permissions.
                  </InlineStateNote>
                ) : roles.map((role) => {
                  const permissionCount = role.permission_keys?.length ?? 0;
                  const active = role.id === selectedRoleId;
                  const isGlobalRole = !role.working_location_id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRoleId(role.id)}
                      className={`w-full rounded-lg border px-3 py-3 text-left transition-colors ${
                        active ? 'border-primary bg-primary/5' : 'bg-card hover:bg-secondary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold truncate">{role.name}</span>
                        {role.is_system_role && <Badge variant="outline">System</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{permissionCount} permissions</p>
                      <Badge
                        variant="secondary"
                        className={`mt-2 text-[10px] font-medium ${isGlobalRole ? '' : 'bg-primary/10 text-primary'}`}
                      >
                        {isGlobalRole ? 'Global' : role.working_locations?.name ?? 'Branch-scoped'}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>{selectedRoleId ? 'Update Role Permissions' : 'Create Role'}</CardTitle>
                <CardDescription>
                  {isReadOnlyGlobalRole
                    ? "Viewing a global role's permissions. Global roles can only be edited by a Super Admin."
                    : 'Users assigned to this role receive these permissions immediately through live access refresh.'}
                </CardDescription>
              </div>
              <Button variant="outline" className="gap-2" onClick={loadData}>
                <RotateCw className="h-4 w-4" size={16} />
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
                  disabled={selectedRole?.is_system_role || isReadOnlyGlobalRole}
                  onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="e.g. REGIONAL_MANAGER"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={roleForm.description}
                  disabled={isReadOnlyGlobalRole}
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
                disabled={isReadOnlyGlobalRole}
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
                <SelectTrigger className="w-[160px] bg-card">
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
                          disabled={isReadOnlyGlobalRole}
                          className="text-xs text-primary underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                        const explicitlyChecked = roleForm.permission_keys.includes(permission.key);
                        const impliedOnly = !explicitlyChecked && effectivePermissionKeys.has(permission.key);
                        const checked = explicitlyChecked || impliedOnly;
                        return (
                          <label
                            key={permission.key}
                            className={`flex min-h-16 items-start gap-3 rounded-lg border p-3 ${
                              impliedOnly ? 'bg-secondary/20 cursor-default' : 'cursor-pointer bg-card hover:bg-secondary/30'
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={impliedOnly || isReadOnlyGlobalRole}
                              onCheckedChange={(value) => togglePermission(permission.key, Boolean(value))}
                              className="mt-1"
                            />
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className="text-sm font-semibold">{permission.name}</span>
                                {impliedOnly && (
                                  <Badge variant="secondary" className="text-[10px] font-normal">
                                    Included automatically
                                  </Badge>
                                )}
                              </span>
                              {permission.description && (
                                <span className="block text-xs text-muted-foreground mt-0.5">{permission.description}</span>
                              )}
                              <span className="block truncate text-[10px] text-muted-foreground/70 mt-0.5">{permission.key}</span>
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
              <Button
                className="h-11 px-8 shadow-sm shadow-primary/20"
                onClick={handleSaveRole}
                disabled={savingRole || isReadOnlyGlobalRole}
                title={isReadOnlyGlobalRole ? "Global roles can only be edited by a Super Admin." : undefined}
              >
                {savingRole ? <Loader2 className="mr-2 h-4 w-4 animate-spin" size={16} /> : <Save className="mr-2 h-4 w-4" size={16} />}
                {selectedRoleId ? 'Save role permissions' : 'Create role'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </div>
      )}
    </div>
  );
}
