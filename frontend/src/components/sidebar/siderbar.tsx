"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { JwtUser } from "@/api/auth";

// ── icon primitives (pure SVG — no AI icon libs) ──────────────────────────
function Icon({ d, size = 16 }: { d: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d={d} />
        </svg>
    );
}

const ICONS = {
    dashboard: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10",
    users: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    employees: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    attendance: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
    payroll: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    structures: "M2 20h20 M4 20V10l8-8 8 8v10",
    permissions: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    departments: "M3 21h18 M9 8h1 M9 12h1 M9 16h1 M14 8h1 M14 12h1 M14 16h1 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16",
    locations: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    activity: "M22 12h-4l-3 9L9 3l-3 9H2",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9",
    chevron: "M9 18l6-6-6-6",
    menu: "M3 12h18 M3 6h18 M3 18h18",
    close: "M18 6L6 18 M6 6l12 12",
};

type NavItem = {
    key: string;
    label: string;
    icon: keyof typeof ICONS;
    href: string;
    roles?: string[];
    permissions?: string[];
};

const NAV_ITEMS: NavItem[] = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard", href: "/admin" },
    { key: "users", label: "Users", icon: "users", href: "/admin/users", roles: ["ADMIN", "BRANCH_MANAGER"], permissions: ["users.read", "users.create", "users.update"] },
    { key: "employees", label: "Employees", icon: "employees", href: "/admin/employees", permissions: ["employees.read", "employees.create", "employees.update"] },
    { key: "departments", label: "Departments", icon: "departments", href: "/admin/departments", roles: ["ADMIN", "BRANCH_MANAGER"] },
    { key: "locations", label: "Locations", icon: "locations", href: "/admin/locations", roles: ["ADMIN"] },
    { key: "attendance", label: "Attendance", icon: "attendance", href: "/admin/attendance", permissions: ["attendance.read", "attendance.create", "attendance.update"] },
    { key: "payroll", label: "Payroll", icon: "payroll", href: "/admin/payroll", permissions: ["payroll.read", "payroll.create", "batch.read", "batch.create"] },
    { key: "structures", label: "Pay Structures", icon: "structures", href: "/admin/payment-structures", permissions: ["payment-structures.read", "payment-structures.create", "payment-structures.update"] },
    { key: "permissions", label: "Permissions", icon: "permissions", href: "/admin/permissions", roles: ["ADMIN", "BRANCH_MANAGER"], permissions: ["permissions.read", "permissions.assign"] },
    { key: "activity", label: "Activity Log", icon: "activity", href: "/admin/activity" },
];

function canSeeItem(item: NavItem, user: JwtUser): boolean {
    const isAdmin = user.roles.includes("ADMIN") || user.roles.includes("SUPER_ADMIN");
    const isBM = user.roles.includes("BRANCH_MANAGER");
    if (isAdmin) return true;

    const roleOk = !item.roles || item.roles.some((r) => user.roles.includes(r));
    const permOk = !item.permissions || item.permissions.some((p) => user.permissions.includes(p));

    if (item.roles && item.permissions) return roleOk || permOk;
    if (item.roles) return roleOk || isBM;
    if (item.permissions) return permOk;
    return true;
}

interface SidebarProps {
    user: JwtUser;
    onLogout: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const visibleItems = NAV_ITEMS.filter((item) => canSeeItem(item, user));
    const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase();
    const primaryRole = user.roles[0] ?? "USER";

    const sidebarContent = (
        <aside
            style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                width: collapsed ? 64 : 240,
                background: "linear-gradient(180deg, #071426 0%, #081932 100%)",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                transition: "width 0.22s cubic-bezier(.4,0,.2,1)",
                overflow: "hidden",
                flexShrink: 0,
            }}
        >
            {/* Logo */}
            <div style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: collapsed ? "20px 0" : "20px 20px",
                justifyContent: collapsed ? "center" : "space-between",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
                minHeight: 64,
            }}>
                {!collapsed && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                            width: 30, height: 30,
                            background: "#e8294a",
                            borderRadius: 6,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.7rem", fontWeight: 800, color: "#fff", letterSpacing: "0.05em",
                            flexShrink: 0,
                        }}>REG</div>
                        <div>
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>REG System</div>
                            <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.35)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Payment Portal</div>
                        </div>
                    </div>
                )}
                {collapsed && (
                    <div style={{
                        width: 30, height: 30,
                        background: "#e8294a",
                        borderRadius: 6,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.7rem", fontWeight: 800, color: "#fff",
                    }}>REG</div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "rgba(255,255,255,0.35)", padding: 4, borderRadius: 4,
                        display: "flex", alignItems: "center",
                        flexShrink: 0,
                    }}
                >
                    <Icon d={collapsed ? ICONS.chevron : "M15 18l-6-6 6-6"} size={14} />
                </button>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto", overflowX: "hidden" }}>
                {visibleItems.map((item) => {
                    const active = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.key}
                            href={item.href}
                            title={collapsed ? item.label : undefined}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: collapsed ? "9px 0" : "9px 12px",
                                justifyContent: collapsed ? "center" : "flex-start",
                                borderRadius: 8,
                                marginBottom: 2,
                                textDecoration: "none",
                                fontSize: "0.82rem",
                                fontWeight: active ? 600 : 400,
                                color: active ? "#fff" : "rgba(255,255,255,0.5)",
                                background: active ? "rgba(232,41,74,0.15)" : "transparent",
                                borderLeft: active ? "2px solid #e8294a" : "2px solid transparent",
                                transition: "all 0.15s ease",
                                whiteSpace: "nowrap",
                            }}
                        >
                            <span style={{ color: active ? "#e8294a" : "rgba(255,255,255,0.4)", flexShrink: 0 }}>
                                <Icon d={ICONS[item.icon]} size={15} />
                            </span>
                            {!collapsed && item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* User + Logout */}
            <div style={{
                padding: collapsed ? "12px 8px" : "12px 16px",
                borderTop: "1px solid rgba(255,255,255,0.05)",
            }}>
                {!collapsed && (
                    <div style={{
                        display: "flex", alignItems: "center", gap: 10,
                        marginBottom: 10,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "rgba(255,255,255,0.04)",
                    }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            background: "linear-gradient(135deg, #e8294a, #ff6b35)",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "0.7rem", fontWeight: 700, color: "#fff", flexShrink: 0,
                        }}>{initials}</div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {user.first_name} {user.last_name}
                            </div>
                            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                                {primaryRole.replace("_", " ")}
                            </div>
                        </div>
                    </div>
                )}
                <button
                    onClick={onLogout}
                    title="Logout"
                    style={{
                        display: "flex", alignItems: "center", gap: 8,
                        justifyContent: collapsed ? "center" : "flex-start",
                        width: "100%", padding: collapsed ? "8px 0" : "8px 12px",
                        background: "none", border: "none", cursor: "pointer",
                        borderRadius: 8, color: "rgba(255,255,255,0.4)",
                        fontSize: "0.82rem", fontWeight: 400,
                        transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#e8294a"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(232,41,74,0.08)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.4)"; (e.currentTarget as HTMLButtonElement).style.background = "none"; }}
                >
                    <Icon d={ICONS.logout} size={15} />
                    {!collapsed && "Sign out"}
                </button>
            </div>
        </aside>
    );

    return (
        <>
            {/* Desktop sidebar */}
            <div className="hidden md:flex" style={{ height: "100vh", position: "sticky", top: 0 }}>
                {sidebarContent}
            </div>

            {/* Mobile toggle button */}
            <button
                className="md:hidden"
                onClick={() => setMobileOpen(true)}
                style={{
                    position: "fixed", top: 12, left: 12, zIndex: 200,
                    background: "#0b1e3d", border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8, padding: "7px 10px", cursor: "pointer",
                    color: "rgba(255,255,255,0.7)", display: "flex",
                }}
            >
                <Icon d={ICONS.menu} size={18} />
            </button>

            {/* Mobile drawer */}
            {mobileOpen && (
                <>
                    <div
                        onClick={() => setMobileOpen(false)}
                        style={{
                            position: "fixed", inset: 0, zIndex: 300,
                            background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)",
                        }}
                    />
                    <div style={{
                        position: "fixed", left: 0, top: 0, bottom: 0, zIndex: 301,
                        width: 240,
                    }}>
                        {sidebarContent}
                        <button
                            onClick={() => setMobileOpen(false)}
                            style={{
                                position: "absolute", top: 12, right: -40,
                                background: "rgba(255,255,255,0.1)", border: "none",
                                borderRadius: 8, padding: 8, cursor: "pointer", color: "#fff",
                            }}
                        >
                            <Icon d={ICONS.close} size={16} />
                        </button>
                    </div>
                </>
            )}
        </>
    );
}
