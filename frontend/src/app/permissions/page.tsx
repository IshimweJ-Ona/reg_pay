"use client";

import { useEffect, useState } from "react";
import { getPermissions } from "@/api/permissions";
import { AdminLayout } from "@/components/layouts/admin-layout";

const accessText: Record<string, string> = {
    "employees.create": "Create, view, update, transfer, and soft delete employees",
    "attendance.create": "Record daily attendance, update back records, view, and approve",
    "payroll.create": "Create payment batches and view batch history",
    "payroll.manage": "Create, view, manage, approve, and reject payroll",
    "payment-structures.create": "Create, view, update, and delete payment structures",
    "users.create": "Create, view, approve, update, and suspend users",
    "permissions.manage": "Create, view, and assign permissions",
    "branch-manager.manage": "Manage one working location",
};

export default function PermissionsPage() {
    const [permissions, setPermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getPermissions()
            .then((data) => setPermissions(Array.isArray(data) ? data : data?.data ?? []))
            .catch(() => setPermissions([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <AdminLayout title="Permissions" subtitle="System access catalog">
            <main className="min-h-screen p-4 text-white sm:p-6">
                <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4 sm:p-6">
                    <div className="mb-5">
                        <h1 className="text-xl font-bold text-white">Permissions</h1>
                        <p className="mt-1 text-sm text-white/45">
                            Each permission controls one system area. Some permissions include related actions.
                        </p>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-white/10">
                        <table className="w-full min-w-[760px] border-collapse text-sm">
                            <thead className="bg-white/[0.025] text-xs uppercase tracking-wide text-white/45">
                                <tr>
                                    <th className="px-4 py-3 text-left">Permission</th>
                                    <th className="px-4 py-3 text-left">Module</th>
                                    <th className="px-4 py-3 text-left">Key</th>
                                    <th className="px-4 py-3 text-left">Access Included</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td className="px-4 py-6 text-center text-white/35" colSpan={4}>
                                            Loading permissions...
                                        </td>
                                    </tr>
                                ) : permissions.length ? (
                                    permissions.map((permission) => (
                                        <tr key={permission.uuid ?? permission.id} className="border-t border-white/10">
                                            <td className="px-4 py-3 font-medium text-white">
                                                {permission.name}
                                            </td>
                                            <td className="px-4 py-3 text-white/70">
                                                {permission.module_name}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs text-white/50">
                                                {permission.permission_key}
                                            </td>
                                            <td className="px-4 py-3 text-white/60">
                                                {accessText[permission.permission_key] ?? "Direct access to this action"}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td className="px-4 py-6 text-center text-white/35" colSpan={4}>
                                            No permissions found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            </main>
        </AdminLayout>
    );
}
