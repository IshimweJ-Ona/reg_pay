"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, UserRoundCheck } from "lucide-react";

import { clearTokens, getCurrentUserFromToken, type JwtUser } from "@/api/auth";

export default function AdminPage() {
    const router = useRouter();
    const [user, setUser] = useState<JwtUser | null>(null);

    useEffect(() => {
        const currentUser = getCurrentUserFromToken();

        if (!currentUser) {
            router.replace("/login");
            return;
        }

        setUser(currentUser);
    }, [router]);

    const primaryRole = useMemo(() => user?.roles[0] || "USER", [user]);

    const handleLogout = () => {
        clearTokens();
        router.replace("/login");
    };

    if (!user) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-[#071426] text-slate-200">
                Checking session...
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-[#071426] p-6 text-slate-950">
            <section className="mx-auto max-w-5xl">
                <div className="mb-6 flex flex-col gap-4 rounded-lg border border-white/10 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="text-sm font-semibold text-red-600">REG Payment System</p>
                        <h1 className="mt-2 text-2xl font-bold">Simple Admin Page</h1>
                        <p className="mt-1 text-sm text-zinc-600">
                            You are logged in as {user.email || user.phone_number}.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={handleLogout}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-50"
                    >
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    <InfoCard
                        icon={<ShieldCheck size={20} />}
                        label="Primary role"
                        value={primaryRole}
                    />
                    <InfoCard
                        icon={<UserRoundCheck size={20} />}
                        label="User ID"
                        value={user.sub}
                    />
                    <InfoCard
                        icon={<ShieldCheck size={20} />}
                        label="Permissions"
                        value={`${user.permissions.length}`}
                    />
                </div>

                <div className="mt-6 rounded-lg border border-white/10 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold">Session details</h2>
                    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <Detail label="Roles" value={user.roles.join(", ") || "No roles in token"} />
                        <Detail label="Phone" value={user.phone_number || "Not available"} />
                        <Detail label="Working location ID" value={user.working_location_id || "Not assigned"} />
                        <Detail label="Department ID" value={user.department_id || "Not assigned"} />
                    </div>
                </div>
            </section>
        </main>
    );
}

function InfoCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-red-50 text-red-600">
                {icon}
            </div>
            <p className="text-sm text-zinc-600">{label}</p>
            <p className="mt-1 break-words text-xl font-semibold">{value}</p>
        </div>
    );
}

function Detail({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md bg-zinc-50 p-3">
            <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
            <p className="mt-1 break-words text-zinc-900">{value}</p>
        </div>
    );
}
