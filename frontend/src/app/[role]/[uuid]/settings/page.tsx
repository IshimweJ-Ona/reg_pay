"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  ChevronRight,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createRole, getRoles, updateRole, type Role } from "@/api/roles";
import { getSystemConfigs, updateSystemConfig } from "@/api/system-config";
import {
  ALL_PERMISSION_KEYS,
  expandPermissionKeys,
  PERMISSION_MODULES,
  type PermissionDefinition,
} from "@/lib/permissions";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import {
  ErrorState,
  InlineStateNote,
  LoadingState,
  PermissionDeniedState,
} from "@/components/layout/page-state";
import { cn } from "@/lib/utils";

const emptyRoleForm = {
  name: "",
  description: "",
  permission_keys: [] as string[],
};

const OVERTIME_RATE_KEY = "OVERTIME_RATE_PER_HOUR";
const DEFAULT_OVERTIME_RATE = "2500";

type SettingsView =
  | "home"
  | "role-edit"
  | "role-create-details"
  | "role-create-permissions"
  | "overtime";

function humanizeModuleName(module: string) {
  return module
    .toLowerCase()
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const PERMISSION_ACTION_COLUMNS = [
  { id: "read", label: "Read" },
  { id: "all-branches", label: "All Branches" },
  { id: "create", label: "Create" },
  { id: "update", label: "Update" },
  { id: "transfer", label: "Transfer" },
  { id: "delete", label: "Delete" },
  { id: "approve", label: "Approve" },
  { id: "manage", label: "Manage" },
  { id: "more", label: "More" },
] as const;

type PermissionActionId = (typeof PERMISSION_ACTION_COLUMNS)[number]["id"];

function getPermissionSuffix(permission: PermissionDefinition) {
  return permission.key.split(".").pop() ?? "";
}

function getPermissionActionId(permission: PermissionDefinition): PermissionActionId {
  const suffix = getPermissionSuffix(permission);
  const name = permission.name.toLowerCase();

  if (suffix === "read_all" || name.includes("all branches")) return "all-branches";
  if (suffix.includes("approve")) return "approve";
  if (suffix === "read" || suffix === "view") return "read";
  if (suffix === "create") return "create";
  if (suffix === "update") return "update";
  if (suffix === "transfer") return "transfer";
  if (suffix === "delete" || suffix === "suspend") return "delete";
  if (suffix.includes("manage") || suffix === "assign") return "manage";
  return "more";
}

function groupPermissionsByAction(permissions: PermissionDefinition[]) {
  const groups = PERMISSION_ACTION_COLUMNS.reduce(
    (acc, column) => {
      acc[column.id] = [];
      return acc;
    },
    {} as Record<PermissionActionId, PermissionDefinition[]>,
  );

  permissions.forEach((permission) => {
    groups[getPermissionActionId(permission)].push(permission);
  });

  return groups;
}

function getPermissionRows() {
  return PERMISSION_MODULES.map((module) => ({
    module: module.module,
    label: humanizeModuleName(module.module),
    permissions: module.permissions,
  }));
}

function moduleDomId(moduleName: string) {
  return `permissions-${moduleName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export default function SystemSettingsPage() {
  const [activeView, setActiveView] = useState<SettingsView>("home");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingRole, setSavingRole] = useState(false);
  const [savingOvertime, setSavingOvertime] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [overtimeRate, setOvertimeRate] = useState(DEFAULT_OVERTIME_RATE);
  const { toast } = useToast();
  const { user, refreshSession, hasPermission } = useAuth();
  const router = useRouter();

  const canManageRoles =
    hasPermission("roles.manage") || hasPermission("roles.manage_own_location");
  const canManageSystemConfig = hasPermission("system-config.manage");
  const canAccessSettings = canManageRoles || canManageSystemConfig;
  const isBranchScopedRoleManager =
    !hasPermission("roles.manage") && hasPermission("roles.manage_own_location");

  const selectedRole = roles.find((role) => role.id === selectedRoleId);
  const isCreatingRole = activeView === "role-create-permissions";
  const isRoleEditor = activeView === "role-edit" || isCreatingRole;
  const isReadOnlyGlobalRole =
    isBranchScopedRoleManager && !!selectedRoleId && !selectedRole?.working_location_id;

  const permissionRows = useMemo(() => getPermissionRows(), []);
  const effectivePermissionKeys = useMemo(
    () => new Set(expandPermissionKeys(roleForm.permission_keys)),
    [roleForm.permission_keys],
  );

  useEffect(() => {
    if (user && !canAccessSettings) {
      router.replace("/unauthorized");
    }
  }, [canAccessSettings, user, router]);

  useEffect(() => {
    if (canAccessSettings) {
      loadData();
    }
  }, [canAccessSettings]);

  useEffect(() => {
    if (!selectedRole || activeView !== "role-edit") return;
    setRoleForm({
      name: selectedRole.name,
      description: selectedRole.description ?? "",
      permission_keys: selectedRole.permission_keys ?? [],
    });
  }, [activeView, selectedRole]);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (canManageRoles) {
        const rolesData = await getRoles();
        setRoles(rolesData);
      }

      if (canManageSystemConfig) {
        const configs = await getSystemConfigs();
        const overtimeConfig = configs.find(
          (config) => config.key === OVERTIME_RATE_KEY,
        );
        setOvertimeRate(overtimeConfig?.value ?? DEFAULT_OVERTIME_RATE);
      }
    } catch (error: any) {
      const message = error?.response?.data?.message ?? "Could not load settings.";
      setLoadError(message);
      toast({
        variant: "destructive",
        title: "Settings failed to load",
        description: message,
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshRolesAfterSave = async (roleId: string) => {
    const rolesData = await getRoles();
    setRoles(rolesData);
    const refreshed = rolesData.find((role) => role.id === roleId);
    if (refreshed) {
      setSelectedRoleId(refreshed.id);
      setRoleForm({
        name: refreshed.name,
        description: refreshed.description ?? "",
        permission_keys: refreshed.permission_keys ?? [],
      });
    }
  };

  const openRole = (roleId: string) => {
    const role = roles.find((item) => item.id === roleId);
    if (!role) return;

    setSelectedRoleId(role.id);
    setRoleForm({
      name: role.name,
      description: role.description ?? "",
      permission_keys: role.permission_keys ?? [],
    });
    setActiveView("role-edit");
  };

  const startNewRole = () => {
    setSelectedRoleId("");
    setRoleForm(emptyRoleForm);
    setActiveView("role-create-details");
  };

  const returnHome = () => {
    setActiveView("home");
    setSelectedRoleId("");
    setRoleForm(emptyRoleForm);
  };

  const handleNextForNewRole = () => {
    if (!roleForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "Role name required",
        description: "Enter the role name before assigning permissions.",
      });
      return;
    }

    setActiveView("role-create-permissions");
  };

  const setPermissionKeys = (keys: string[]) => {
    setRoleForm((prev) => ({
      ...prev,
      permission_keys: Array.from(new Set(keys)),
    }));
  };

  const togglePermission = (permissionKey: string, checked: boolean) => {
    setRoleForm((prev) => ({
      ...prev,
      permission_keys: checked
        ? Array.from(new Set([...prev.permission_keys, permissionKey]))
        : prev.permission_keys.filter((key) => key !== permissionKey),
    }));
  };

  const toggleModule = (permissionKeys: string[], checked: boolean) => {
    setRoleForm((prev) => ({
      ...prev,
      permission_keys: checked
        ? Array.from(new Set([...prev.permission_keys, ...permissionKeys]))
        : prev.permission_keys.filter((key) => !permissionKeys.includes(key)),
    }));
  };

  const handleSaveOvertimeRate = async () => {
    const normalizedRate = Number(overtimeRate);
    if (!Number.isFinite(normalizedRate) || normalizedRate < 0) {
      toast({
        variant: "destructive",
        title: "Invalid overtime rate",
        description: "Enter a non-negative RWF amount.",
      });
      return;
    }

    setSavingOvertime(true);
    try {
      const saved = await updateSystemConfig(
        OVERTIME_RATE_KEY,
        normalizedRate.toString(),
        "RWF amount paid per overtime hour across all working locations.",
      );
      setOvertimeRate(saved.value);
      toast({
        title: "Overtime rate updated",
        description: `Payroll will use RWF ${Number(saved.value).toLocaleString()} per overtime hour.`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Overtime save failed",
        description:
          error?.response?.data?.message ?? "Could not update overtime settings.",
      });
    } finally {
      setSavingOvertime(false);
    }
  };

  const handleSaveRole = async () => {
    if (isReadOnlyGlobalRole) return;
    if (!roleForm.name.trim()) {
      toast({
        variant: "destructive",
        title: "Role name required",
        description: "Enter a role name before saving.",
      });
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
        ? await updateRole(
            selectedRoleId,
            selectedRole?.is_system_role
              ? {
                  description: payload.description,
                  permission_keys: payload.permission_keys,
                }
              : payload,
          )
        : await createRole(payload);

      await refreshRolesAfterSave(saved.id);
      setActiveView("role-edit");

      const userHadThisRole =
        user?.roles?.includes(roleForm.name) ||
        (selectedRole && user?.roles?.includes(selectedRole.name));
      await refreshSession();
      toast({
        title: selectedRoleId ? "Role updated" : "Role created",
        description: userHadThisRole
          ? "Permissions changed immediately. Your access was refreshed."
          : "Permissions updated successfully.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Role save failed",
        description:
          error?.response?.data?.message ?? "Please check the role details.",
      });
    } finally {
      setSavingRole(false);
    }
  };

  const scrollToModule = (moduleName: string) => {
    document.getElementById(moduleDomId(moduleName))?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const renderPermissionMatrixToggle = (permission: PermissionDefinition) => {
    const explicitlyChecked = roleForm.permission_keys.includes(permission.key);
    const impliedOnly =
      !explicitlyChecked && effectivePermissionKeys.has(permission.key);
    const checked = explicitlyChecked || impliedOnly;
    const switchDisabled = impliedOnly || isReadOnlyGlobalRole;

    return (
      <div
        key={permission.key}
        className={cn(
          "flex min-h-11 items-center justify-center rounded-md px-1.5 py-1.5",
          impliedOnly ? "bg-secondary/40" : "hover:bg-secondary/40",
          switchDisabled && "cursor-not-allowed",
        )}
        title={
          permission.description
            ? `${permission.name} - ${permission.description}`
            : permission.name
        }
      >
        <Switch
          checked={checked}
          disabled={switchDisabled}
          onCheckedChange={(value) =>
            togglePermission(permission.key, Boolean(value))
          }
          aria-label={`${checked ? "Remove" : "Add"} ${permission.name}`}
        />
      </div>
    );
  };

  const renderPermissionMatrixCell = (permissions: PermissionDefinition[]) => {
    if (permissions.length === 0) {
      return (
        <div className="flex min-h-11 items-center justify-center text-muted-foreground/40">
          -
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {permissions.map(renderPermissionMatrixToggle)}
      </div>
    );
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

  if (activeView === "role-create-details") {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader
          title="New Role"
          description="Name the role first. Permissions are assigned on the next screen."
          actions={
            <Button variant="outline" onClick={returnHome}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          }
        />

        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle>Role Details</CardTitle>
            <CardDescription>
              The role name is normalized by the server when it is saved.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="role-name">Role Name</Label>
              <Input
                id="role-name"
                value={roleForm.name}
                onChange={(event) =>
                  setRoleForm((prev) => ({ ...prev, name: event.target.value }))
                }
                placeholder="e.g. Regional Manager"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">Description</Label>
              <Input
                id="role-description"
                value={roleForm.description}
                onChange={(event) =>
                  setRoleForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder="Short purpose of this role"
              />
            </div>
            <div className="flex justify-end">
              <Button className="min-w-32" onClick={handleNextForNewRole}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeView === "overtime") {
    return (
      <div className="max-w-4xl space-y-6">
        <PageHeader
          title="Overtime Payment"
          description="Set the global RWF amount paid for each overtime hour."
          actions={
            <Button variant="outline" onClick={returnHome}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Back
            </Button>
          }
        />

        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle>Payment Rate</CardTitle>
            <CardDescription>
              Payroll calculations use this value for attendance overtime hours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="overtime-rate">Overtime Rate Per Hour (RWF)</Label>
                <Input
                  id="overtime-rate"
                  type="number"
                  min={0}
                  value={overtimeRate}
                  onChange={(event) => setOvertimeRate(event.target.value)}
                  placeholder={DEFAULT_OVERTIME_RATE}
                />
              </div>
              <Button
                className="h-10 gap-2"
                onClick={handleSaveOvertimeRate}
                disabled={savingOvertime}
              >
                {savingOvertime ? (
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isRoleEditor) {
    if (activeView === "role-edit" && !selectedRole) {
      return (
        <ErrorState
          title="Role could not load"
          description="Choose the role again from settings."
          action={<Button onClick={returnHome}>Back to Settings</Button>}
        />
      );
    }

    const currentRoleTitle = selectedRole?.name ?? roleForm.name.trim() ?? "New Role";
    const roleScope = selectedRole
      ? selectedRole.working_location_id
        ? selectedRole.working_locations?.name ?? "Branch-scoped"
        : "Global"
      : isBranchScopedRoleManager
        ? user?.location ?? "Your branch"
        : "Global";

    return (
      <div className="max-w-none space-y-6">
        <PageHeader
          title={isCreatingRole ? "Assign Permissions" : currentRoleTitle}
          description={
            isCreatingRole
              ? `Choose permissions for ${roleForm.name.trim()}.`
              : "Update this role's permissions and save the changes."
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={returnHome}>
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Back
              </Button>
              {!isCreatingRole && (
                <Button variant="outline" onClick={loadData}>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Refresh
                </Button>
              )}
              <Button
                className="min-w-40"
                onClick={handleSaveRole}
                disabled={savingRole || isReadOnlyGlobalRole}
                title={
                  isReadOnlyGlobalRole
                    ? "Global roles can only be edited by a Super Admin."
                    : undefined
                }
              >
                {savingRole ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {isCreatingRole ? "Create Role" : "Save Role"}
              </Button>
            </div>
          }
        />

        {isReadOnlyGlobalRole && (
          <InlineStateNote tone="warning">
            You can view this global role, but only a Super Admin can edit it.
          </InlineStateNote>
        )}

        <div className="grid gap-5 xl:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Role Summary</CardTitle>
                <CardDescription>Permission coverage for this role.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-secondary/30 p-3">
                    <p className="text-xs text-muted-foreground">Selected</p>
                    <p className="text-xl font-bold">{roleForm.permission_keys.length}</p>
                  </div>
                  <div className="rounded-lg border bg-secondary/30 p-3">
                    <p className="text-xs text-muted-foreground">Effective</p>
                    <p className="text-xl font-bold">{effectivePermissionKeys.size}</p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Scope</span>
                    <Badge variant="outline">{roleScope}</Badge>
                  </div>
                  {selectedRole?.is_system_role && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Type</span>
                      <Badge variant="secondary">System role</Badge>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isReadOnlyGlobalRole}
                    onClick={() => setPermissionKeys(ALL_PERMISSION_KEYS)}
                  >
                    Select all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isReadOnlyGlobalRole}
                    onClick={() => setPermissionKeys([])}
                  >
                    Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Modules</CardTitle>
                <CardDescription>Jump to a permission area.</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[420px] pr-3">
                  <div className="space-y-1.5">
                    {permissionRows.map((row) => {
                      const moduleKeys = row.permissions.map((permission) => permission.key);
                      const selectedCount = moduleKeys.filter((key) =>
                        effectivePermissionKeys.has(key),
                      ).length;

                      return (
                        <button
                          key={row.module}
                          type="button"
                          onClick={() => scrollToModule(row.module)}
                          className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60"
                        >
                          <span className="min-w-0 truncate font-medium">{row.label}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {selectedCount}/{row.permissions.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </aside>

          <main className="min-w-0 space-y-4">
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle>Role Details</CardTitle>
                <CardDescription>
                  Name, describe, and save the role with the permissions below.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
                <div className="space-y-2">
                  <Label htmlFor="editor-role-name">Role Name</Label>
                  <Input
                    id="editor-role-name"
                    value={roleForm.name}
                    disabled={
                      selectedRole?.is_system_role ||
                      isReadOnlyGlobalRole ||
                      activeView === "role-create-permissions"
                    }
                    onChange={(event) =>
                      setRoleForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="e.g. REGIONAL_MANAGER"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editor-role-description">Description</Label>
                  <Input
                    id="editor-role-description"
                    value={roleForm.description}
                    disabled={isReadOnlyGlobalRole}
                    onChange={(event) =>
                      setRoleForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Short purpose of this role"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardHeader className="border-b bg-secondary/20">
                <CardTitle className="text-lg">Permissions Matrix</CardTitle>
                <CardDescription>
                  {roleForm.permission_keys.length} selected,{" "}
                  {effectivePermissionKeys.size} effective permissions by module.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table className="min-w-[1120px] table-fixed">
                  <TableHeader className="bg-secondary/20">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="sticky left-0 z-20 w-[200px] border-r bg-secondary text-foreground">
                        Module
                      </TableHead>
                      <TableHead className="w-[82px] border-r text-center">
                        All
                      </TableHead>
                      {PERMISSION_ACTION_COLUMNS.map((column) => (
                        <TableHead
                          key={column.id}
                          className="w-[94px] border-r px-2 text-center last:border-r-0"
                        >
                          {column.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {permissionRows.map((row) => {
                      const rowKeys = row.permissions.map((permission) => permission.key);
                      const explicitCount = rowKeys.filter((key) =>
                        roleForm.permission_keys.includes(key),
                      ).length;
                      const effectiveCount = rowKeys.filter((key) =>
                        effectivePermissionKeys.has(key),
                      ).length;
                      const rowChecked = row.permissions.every((permission) =>
                        effectivePermissionKeys.has(permission.key),
                      );
                      const groupedPermissions = groupPermissionsByAction(row.permissions);

                      return (
                        <TableRow
                          key={row.module}
                          id={moduleDomId(row.module)}
                          className="scroll-mt-6 hover:bg-transparent"
                        >
                          <TableCell className="sticky left-0 z-10 border-r bg-card p-3 align-top">
                            <div className="space-y-1">
                              <p className="truncate text-sm font-semibold">
                                {row.label}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {explicitCount} selected, {effectiveCount} effective
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="border-r p-2 align-top">
                            <div className="flex min-h-11 flex-col items-center justify-center gap-1">
                              <Switch
                                checked={rowChecked}
                                disabled={isReadOnlyGlobalRole}
                                onCheckedChange={(value) =>
                                  toggleModule(rowKeys, Boolean(value))
                                }
                                aria-label={`Toggle all ${row.label} permissions`}
                              />
                              <span className="text-[10px] font-medium text-muted-foreground">
                                {effectiveCount}/{row.permissions.length}
                              </span>
                            </div>
                          </TableCell>
                          {PERMISSION_ACTION_COLUMNS.map((column) => (
                            <TableCell
                              key={column.id}
                              className="border-r p-2 align-top last:border-r-0"
                            >
                              {renderPermissionMatrixCell(groupedPermissions[column.id])}
                            </TableCell>
                          ))}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-lg border bg-card/95 p-3 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
              <div className="text-sm">
                <p className="font-semibold">{currentRoleTitle}</p>
                <p className="text-muted-foreground">
                  {roleForm.permission_keys.length} selected permissions ready to save.
                </p>
              </div>
              <Button
                className="min-w-40"
                onClick={handleSaveRole}
                disabled={savingRole || isReadOnlyGlobalRole}
              >
                {savingRole ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {isCreatingRole ? "Create Role" : "Save Role"}
              </Button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Settings"
        description={
          isBranchScopedRoleManager
            ? "Manage roles and permissions for your own branch."
            : "Choose the setting you want to update."
        }
      />

      {isBranchScopedRoleManager && (
        <InlineStateNote tone="info">
          You can manage roles for{" "}
          <span className="font-bold">{user?.location ?? "your branch"}</span>.
          Global roles are visible but read-only.
        </InlineStateNote>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {canManageRoles && (
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
                Role
              </CardTitle>
              <CardDescription>
                Select a role to open its permissions, or start a new role.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select onValueChange={openRole}>
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Choose a role" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned" className="max-h-[320px]">
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {roles.length === 0 && (
                <InlineStateNote>
                  No roles are available in this scope yet.
                </InlineStateNote>
              )}

              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={startNewRole}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Role
              </Button>
            </CardContent>
          </Card>
        )}

        {canManageSystemConfig && (
          <Card className="border border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" aria-hidden="true" />
                Overtime Payment
              </CardTitle>
              <CardDescription>
                Open the overtime payment setting and update the hourly rate.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Overtime Payment</Label>
                <Select onValueChange={() => setActiveView("overtime")}>
                  <SelectTrigger className="bg-card">
                    <SelectValue placeholder="Choose overtime setting" />
                  </SelectTrigger>
                  <SelectContent position="item-aligned">
                    <SelectItem value="overtime-rate">
                      Rate per overtime hour
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg border bg-secondary/30 px-3 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">Current rate</span>
                  <Badge variant="outline">
                    RWF {Number(overtimeRate).toLocaleString()}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {!canManageRoles && !canManageSystemConfig && (
        <Card className="border border-border shadow-sm">
          <CardContent className="flex min-h-44 items-center justify-center text-center">
            <div className="max-w-md space-y-2">
              <SlidersHorizontal
                className="mx-auto h-6 w-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="font-semibold">No settings available</p>
              <p className="text-sm text-muted-foreground">
                Your current role does not include configurable settings.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === "home" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-info" aria-hidden="true" />
          Permission controls open only after a role is selected.
        </div>
      )}
    </div>
  );
}
