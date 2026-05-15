"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    clearTokens,
    getCurrentUserFromToken,
    getMyProfile,
    type JwtUser,
} from "@/api/auth";
import * as attendanceApi from "@/api/attendance";
import * as employeesApi from "@/api/employees";
import * as paymentStructuresApi from "@/api/payment-structures";
import * as payrollApi from "@/api/payroll";
import * as permissionsApi from "@/api/permissions";
import * as usersApi from "@/api/users";
import * as organizationApi from "@/api/working_locations";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Navbar } from "@/components/navbar/navbar";

// ─── tiny icon primitive ───────────────────────────────────────────────────
function Ico({ d, size = 15, color }: { d: string; size?: number; color?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            stroke={color ?? "currentColor"} strokeWidth={1.8}
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d={d} />
        </svg>
    );
}

const IC = {
    user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
    phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.1 2.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16.92z",
    location: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    dept: "M3 21h18 M9 8h1 M9 12h1 M9 16h1 M14 8h1 M14 12h1 M14 16h1 M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    activity: "M22 12h-4l-3 9L9 3l-3 9H2",
    plus: "M12 5v14 M5 12h14",
    edit: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z",
    trash: "M3 6h18 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6",
    check: "M20 6L9 17l-5-5",
    x: "M18 6L6 18 M6 6l12 12",
    eye: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    refresh: "M23 4v6h-6 M1 20v-6h6 M3.51 9a9 9 0 0 1 14.85-3.36L23 10 M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
    warn: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01",
    info: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z M12 16v-4 M12 8h.01",
    payroll: "M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
    employees: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    attend: "M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01",
    struct: "M2 20h20 M4 20V10l8-8 8 8v10",
    close: "M18 6L6 18 M6 6l12 12",
};

// ─── colour tokens ──────────────────────────────────────────────────────────
const C = {
    bg: "#071426",
    surface: "rgba(255,255,255,0.035)",
    surfaceHover: "rgba(255,255,255,0.06)",
    border: "rgba(255,255,255,0.07)",
    borderStrong: "rgba(255,255,255,0.12)",
    text: "#f0f4f8",
    textSub: "rgba(255,255,255,0.45)",
    textMuted: "rgba(255,255,255,0.25)",
    red: "#e8294a",
    redFaint: "rgba(232,41,74,0.12)",
    redSoft: "rgba(232,41,74,0.2)",
    green: "#00a882",
    greenFaint: "rgba(0,168,130,0.12)",
    purple: "#6c5ce7",
    purpleFaint: "rgba(108,92,231,0.12)",
    amber: "#f4a61d",
    amberFaint: "rgba(244,166,29,0.12)",
};

// ─── shared UI primitives ───────────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
    return (
        <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "20px 24px",
            ...style,
        }}>
            {children}
        </div>
    );
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: C.text, letterSpacing: "0.01em" }}>
                {children}
            </h2>
            {action}
        </div>
    );
}

function Badge({ label, color = "default" }: { label: string; color?: "red" | "green" | "purple" | "amber" | "default" }) {
    const map = {
        red: { bg: C.redFaint, color: C.red },
        green: { bg: C.greenFaint, color: C.green },
        purple: { bg: C.purpleFaint, color: C.purple },
        amber: { bg: C.amberFaint, color: C.amber },
        default: { bg: "rgba(255,255,255,0.06)", color: C.textSub },
    };
    const { bg, color: col } = map[color];
    return (
        <span style={{
            display: "inline-block",
            padding: "2px 8px",
            borderRadius: 5,
            fontSize: "0.68rem",
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            background: bg,
            color: col,
        }}>{label}</span>
    );
}

function Btn({
    children, onClick, variant = "default", size = "md", icon, disabled,
}: {
    children?: React.ReactNode;
    onClick?: () => void;
    variant?: "default" | "primary" | "danger" | "ghost";
    size?: "sm" | "md";
    icon?: string;
    disabled?: boolean;
}) {
    const styles: Record<string, React.CSSProperties> = {
        default: { background: "rgba(255,255,255,0.07)", border: `1px solid ${C.border}`, color: C.text },
        primary: { background: C.red, border: `1px solid ${C.red}`, color: "#fff" },
        danger: { background: C.redFaint, border: `1px solid ${C.redSoft}`, color: C.red },
        ghost: { background: "none", border: "none", color: C.textSub },
    };
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: size === "sm" ? "5px 10px" : "7px 14px",
                borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
                fontSize: size === "sm" ? "0.73rem" : "0.8rem",
                fontWeight: 500,
                opacity: disabled ? 0.5 : 1,
                transition: "opacity 0.15s",
                ...styles[variant],
            }}
        >
            {icon && <Ico d={IC[icon as keyof typeof IC] ?? ""} size={13} />}
            {children}
        </button>
    );
}

// ─── generic data table ─────────────────────────────────────────────────────
type Col<T> = {
    key: string;
    label: string;
    render?: (row: T) => React.ReactNode;
    width?: number | string;
};

function DataTable<T extends Record<string, unknown>>({
    cols, rows, onEdit, onDelete, loading,
}: {
    cols: Col<T>[];
    rows: T[];
    onEdit?: (row: T) => void;
    onDelete?: (row: T) => void;
    loading?: boolean;
}) {
    if (loading) {
        return (
            <div style={{ padding: "32px 0", textAlign: "center", color: C.textMuted, fontSize: "0.82rem" }}>
                Loading…
            </div>
        );
    }
    if (!rows.length) {
        return (
            <div style={{ padding: "32px 0", textAlign: "center", color: C.textMuted, fontSize: "0.82rem" }}>
                No records found.
            </div>
        );
    }

    return (
        <div style={{ overflowX: "auto", borderRadius: 10, border: `1px solid ${C.border}` }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                    <tr style={{ borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.025)" }}>
                        {cols.map((c) => (
                            <th key={c.key} style={{
                                padding: "10px 14px", textAlign: "left",
                                fontWeight: 600, color: C.textSub,
                                fontSize: "0.71rem", letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                whiteSpace: "nowrap",
                                width: c.width,
                            }}>{c.label}</th>
                        ))}
                        {(onEdit || onDelete) && (
                            <th style={{
                                padding: "10px 14px", textAlign: "right",
                                fontWeight: 600, color: C.textSub,
                                fontSize: "0.71rem", letterSpacing: "0.08em",
                                textTransform: "uppercase",
                            }}>Actions</th>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={String(row.uuid ?? row.id ?? i)}
                            style={{
                                borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none",
                                transition: "background 0.1s",
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHover)}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                        >
                            {cols.map((c) => (
                                <td key={c.key} style={{ padding: "11px 14px", color: C.text, verticalAlign: "middle" }}>
                                    {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                                </td>
                            ))}
                            {(onEdit || onDelete) && (
                                <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                                    <div style={{ display: "inline-flex", gap: 6 }}>
                                        {onEdit && (
                                            <Btn variant="ghost" size="sm" icon="edit" onClick={() => onEdit(row)}>Edit</Btn>
                                        )}
                                        {onDelete && (
                                            <Btn variant="danger" size="sm" icon="trash" onClick={() => onDelete(row)}>Delete</Btn>
                                        )}
                                    </div>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Modal ──────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div style={{
            position: "fixed", inset: 0, zIndex: 500,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
        }}>
            <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} />
            <div style={{
                position: "relative", zIndex: 1,
                background: "#0b1e3d",
                border: `1px solid ${C.borderStrong}`,
                borderRadius: 14,
                padding: "24px 28px",
                width: "100%", maxWidth: 520,
                maxHeight: "85vh", overflowY: "auto",
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: C.text }}>{title}</h3>
                    <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textSub, display: "flex" }}>
                        <Ico d={IC.close} size={16} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
    return (
        <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: C.textSub, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{
                    width: "100%", padding: "9px 12px",
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${C.border}`,
                    borderRadius: 8, color: C.text,
                    fontSize: "0.85rem",
                    outline: "none",
                    boxSizing: "border-box",
                }}
            />
        </div>
    );
}

// ─── permission helpers ─────────────────────────────────────────────────────
function hasPerm(user: JwtUser, ...perms: string[]) {
    return isAdmin(user) || perms.some(p => user.permissions.includes(p));
}
function isAdmin(user: JwtUser) { return user.roles.includes("ADMIN") || user.roles.includes("SUPER_ADMIN"); }
function isBM(user: JwtUser) { return user.roles.includes("BRANCH_MANAGER"); }

// ─── SECTION: Profile ───────────────────────────────────────────────────────
function ProfileSection({ user, profile }: { user: JwtUser; profile: any }) {
    const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase();
    const statusColor = profile?.account_status === "ACTIVE" ? C.green : C.amber;
    const statusFaint = profile?.account_status === "ACTIVE" ? C.greenFaint : C.amberFaint;

    return (
        <Card>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
                <div style={{
                    width: 56, height: 56, borderRadius: "50%",
                    background: "linear-gradient(135deg, #e8294a, #ff6b35)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.2rem", fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>{initials}</div>

                <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: C.text }}>
                            {user.first_name} {user.last_name}
                        </h2>
                        {user.roles.map((r) => (
                            <Badge key={r} label={r.replace("_", " ")}
                                color={r === "ADMIN" ? "red" : r === "BRANCH_MANAGER" ? "purple" : "default"} />
                        ))}
                        {profile?.account_status && (
                            <span style={{
                                padding: "2px 8px", borderRadius: 5,
                                fontSize: "0.68rem", fontWeight: 600,
                                letterSpacing: "0.06em", textTransform: "uppercase",
                                background: statusFaint, color: statusColor,
                            }}>{profile.account_status}</span>
                        )}
                    </div>

                    <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 8 }}>
                        {[
                            { icon: "mail", label: profile?.email ?? user.email ?? "—" },
                            { icon: "phone", label: user.phone_number ?? "—" },
                            { icon: "location", label: profile?.working_location?.name ?? user.working_location_id ?? "—" },
                            { icon: "dept", label: profile?.department?.name ?? user.department_id ?? "Not assigned" },
                        ].map(({ icon, label }) => (
                            <div key={icon} style={{ display: "flex", alignItems: "center", gap: 7, color: C.textSub, fontSize: "0.8rem" }}>
                                <Ico d={IC[icon as keyof typeof IC] ?? ""} size={13} color={C.textMuted} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {!isAdmin(user) && user.permissions.length > 0 && (
                    <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 20, minWidth: 160 }}>
                        <div style={{ fontSize: "0.68rem", fontWeight: 600, color: C.textMuted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
                            Permissions ({user.permissions.length})
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                            {user.permissions.slice(0, 8).map((p) => (
                                <Badge key={p} label={p} color="default" />
                            ))}
                            {user.permissions.length > 8 && (
                                <Badge label={`+${user.permissions.length - 8} more`} color="default" />
                            )}
                        </div>
                    </div>
                )}
            </div>
        </Card>
    );
}

// ─── SECTION: No Permissions ────────────────────────────────────────────────
function NoPermissionsSection({ profile }: { profile: any }) {
    const admin = profile?.admin_contacts?.[0];
    return (
        <Card style={{ borderColor: C.amberFaint }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                <div style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: C.amberFaint,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: C.amber, flexShrink: 0,
                }}>
                    <Ico d={IC.warn} size={18} color={C.amber} />
                </div>
                <div>
                    <p style={{ margin: "0 0 6px", fontSize: "0.88rem", fontWeight: 600, color: C.text }}>
                        No system activity permissions
                    </p>
                    <p style={{ margin: 0, fontSize: "0.82rem", color: C.textSub, lineHeight: 1.6 }}>
                        You currently do not have permission to perform system activities.
                        Please contact the system administrator if you believe this is incorrect.
                    </p>
                    {admin && (
                        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: 8, fontSize: "0.8rem" }}>
                            <div style={{ fontWeight: 600, color: C.textSub, marginBottom: 4, fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase" }}>Admin Contact</div>
                            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", color: C.text }}>
                                {admin.email && <span><Ico d={IC.mail} size={12} /> {admin.email}</span>}
                                {admin.phone_number && <span><Ico d={IC.phone} size={12} /> {admin.phone_number}</span>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}

// ─── SECTION: Users table ───────────────────────────────────────────────────
function UsersSection({ user: currentUser }: { user: JwtUser }) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<null | "create" | any>(null);
    const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone_number: "", working_location_id: "" });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await usersApi.getUsers?.() ?? [];
            setRows(Array.isArray(data) ? data : data?.data ?? []);
        } catch { setRows([]); }
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const openCreate = () => { setForm({ first_name: "", last_name: "", email: "", phone_number: "", working_location_id: "" }); setModal("create"); };
    const openEdit = (row: any) => { setForm({ first_name: row.first_name ?? "", last_name: row.last_name ?? "", email: row.email ?? "", phone_number: row.phone_number ?? "", working_location_id: row.working_location?.uuid ?? "" }); setModal(row); };

    const handleSave = async () => {
        try {
            if (modal === "create") {
                await usersApi.createUser?.(form);
            } else {
                await usersApi.updateUser?.(modal.uuid, form);
            }
            await load();
            setModal(null);
        } catch { /* surface error if needed */ }
    };

    const handleDelete = async (row: any) => {
        if (!confirm(`Delete user ${row.first_name} ${row.last_name}?`)) return;
        try { await usersApi.deleteUser?.(row.uuid); await load(); } catch { /* */ }
    };

    const cols = [
        { key: "first_name", label: "First Name" },
        { key: "last_name", label: "Last Name" },
        { key: "email", label: "Email" },
        { key: "phone_number", label: "Phone" },
        { key: "working_location", label: "Location", render: (r: any) => r.working_location?.name ?? "—" },
        { key: "department", label: "Department", render: (r: any) => r.department?.name ?? "—" },
        { key: "roles", label: "Roles", render: (r: any) => (r.roles ?? []).map((rl: string) => <Badge key={rl} label={rl.replace("_", " ")} color={rl === "ADMIN" ? "red" : rl === "BRANCH_MANAGER" ? "purple" : "default"} />), },
        { key: "account_status", label: "Status", render: (r: any) => <Badge label={r.account_status ?? "—"} color={r.account_status === "ACTIVE" ? "green" : "amber"} /> },
    ];

    const canWrite = hasPerm(currentUser, "users.create", "users.update") || isAdmin(currentUser) || isBM(currentUser);

    return (
        <Card>
            <SectionTitle action={canWrite ? <Btn variant="primary" size="sm" icon="plus" onClick={openCreate}>Add User</Btn> : undefined}>
                Users
            </SectionTitle>
            <DataTable cols={cols} rows={rows} loading={loading}
                onEdit={canWrite ? openEdit : undefined}
                onDelete={canWrite ? handleDelete : undefined} />

            {modal !== null && (
                <Modal title={modal === "create" ? "Add User" : "Edit User"} onClose={() => setModal(null)}>
                    <Field label="First Name" value={form.first_name} onChange={v => setForm(f => ({ ...f, first_name: v }))} />
                    <Field label="Last Name" value={form.last_name} onChange={v => setForm(f => ({ ...f, last_name: v }))} />
                    <Field label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
                    <Field label="Phone" value={form.phone_number} onChange={v => setForm(f => ({ ...f, phone_number: v }))} />
                    <Field label="Working Location ID" value={form.working_location_id} onChange={v => setForm(f => ({ ...f, working_location_id: v }))} />
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                        <Btn variant="default" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant="primary" onClick={handleSave}>Save</Btn>
                    </div>
                </Modal>
            )}
        </Card>
    );
}

// ─── SECTION: Employees table ───────────────────────────────────────────────
function EmployeesSection({ user: currentUser }: { user: JwtUser }) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<null | "create" | any>(null);
    const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone_number: "", working_location_id: "", department_id: "" });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await employeesApi.getEmployees?.() ?? [];
            setRows(Array.isArray(data) ? data : data?.data ?? []);
        } catch { setRows([]); }
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const canCreate = hasPerm(currentUser, "employees.create");
    const canUpdate = hasPerm(currentUser, "employees.update");

    const openCreate = () => { setForm({ first_name: "", last_name: "", email: "", phone_number: "", working_location_id: "", department_id: "" }); setModal("create"); };
    const openEdit = (row: any) => {
        setForm({ first_name: row.first_name ?? "", last_name: row.last_name ?? "", email: row.email ?? "", phone_number: row.phone_number ?? "", working_location_id: row.working_location?.uuid ?? "", department_id: row.department?.uuid ?? "" });
        setModal(row);
    };
    const handleSave = async () => {
        try {
            if (modal === "create") { await employeesApi.createEmployee?.(form); }
            else { await employeesApi.updateEmployee?.(modal.uuid, form); }
            await load(); setModal(null);
        } catch { /* */ }
    };
    const handleDelete = async (row: any) => {
        if (!confirm(`Delete employee ${row.first_name} ${row.last_name}?`)) return;
        try { await employeesApi.deleteEmployee?.(row.uuid); await load(); } catch { /* */ }
    };

    const cols = [
        { key: "first_name", label: "First Name" },
        { key: "last_name", label: "Last Name" },
        { key: "email", label: "Email" },
        { key: "phone_number", label: "Phone" },
        { key: "working_location", label: "Location", render: (r: any) => r.working_location?.name ?? "—" },
        { key: "department", label: "Department", render: (r: any) => r.department?.name ?? "—" },
        { key: "employment_status", label: "Status", render: (r: any) => <Badge label={r.employment_status ?? "—"} color={r.employment_status === "ACTIVE" ? "green" : "amber"} /> },
    ];

    return (
        <Card>
            <SectionTitle action={canCreate ? <Btn variant="primary" size="sm" icon="plus" onClick={openCreate}>Add Employee</Btn> : undefined}>
                Employees
            </SectionTitle>
            <DataTable cols={cols} rows={rows} loading={loading}
                onEdit={canUpdate ? openEdit : undefined}
                onDelete={isAdmin(currentUser) ? handleDelete : undefined} />

            {modal !== null && (
                <Modal title={modal === "create" ? "Add Employee" : "Edit Employee"} onClose={() => setModal(null)}>
                    <Field label="First Name" value={form.first_name} onChange={v => setForm(f => ({ ...f, first_name: v }))} />
                    <Field label="Last Name" value={form.last_name} onChange={v => setForm(f => ({ ...f, last_name: v }))} />
                    <Field label="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} type="email" />
                    <Field label="Phone" value={form.phone_number} onChange={v => setForm(f => ({ ...f, phone_number: v }))} />
                    <Field label="Working Location ID" value={form.working_location_id} onChange={v => setForm(f => ({ ...f, working_location_id: v }))} />
                    <Field label="Department ID" value={form.department_id} onChange={v => setForm(f => ({ ...f, department_id: v }))} />
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                        <Btn variant="default" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant="primary" onClick={handleSave}>Save</Btn>
                    </div>
                </Modal>
            )}
        </Card>
    );
}

// ─── SECTION: Attendance ────────────────────────────────────────────────────
function AttendanceSection({ user: currentUser }: { user: JwtUser }) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<null | "create" | any>(null);
    const [form, setForm] = useState({ employee_uuid: "", date: "", status: "PRESENT", notes: "" });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await attendanceApi.getAttendance?.() ?? [];
            setRows(Array.isArray(data) ? data : data?.data ?? []);
        } catch { setRows([]); }
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const canWrite = hasPerm(currentUser, "attendance.create", "attendance.update");

    const cols = [
        { key: "employee", label: "Employee", render: (r: any) => `${r.employee?.first_name ?? ""} ${r.employee?.last_name ?? ""}`.trim() || "—" },
        { key: "date", label: "Date" },
        { key: "status", label: "Status", render: (r: any) => <Badge label={r.status ?? "—"} color={r.status === "PRESENT" ? "green" : r.status === "ABSENT" ? "red" : "amber"} /> },
        { key: "notes", label: "Notes", render: (r: any) => r.notes ?? "—" },
    ];

    const handleSave = async () => {
        try {
            if (modal === "create") { await attendanceApi.createAttendance?.(form); }
            else { await attendanceApi.updateAttendance?.(modal.uuid, form); }
            await load(); setModal(null);
        } catch { /* */ }
    };

    return (
        <Card>
            <SectionTitle action={canWrite ? <Btn variant="primary" size="sm" icon="plus" onClick={() => { setForm({ employee_uuid: "", date: "", status: "PRESENT", notes: "" }); setModal("create"); }}>Mark Attendance</Btn> : undefined}>
                Attendance
            </SectionTitle>
            <DataTable cols={cols} rows={rows} loading={loading}
                onEdit={canWrite ? (r) => { setForm({ employee_uuid: r.employee?.uuid ?? "", date: r.date ?? "", status: r.status ?? "PRESENT", notes: r.notes ?? "" }); setModal(r); } : undefined} />

            {modal !== null && (
                <Modal title={modal === "create" ? "Mark Attendance" : "Edit Attendance"} onClose={() => setModal(null)}>
                    <Field label="Employee UUID" value={form.employee_uuid} onChange={v => setForm(f => ({ ...f, employee_uuid: v }))} />
                    <Field label="Date" value={form.date} onChange={v => setForm(f => ({ ...f, date: v }))} type="date" />
                    <div style={{ marginBottom: 14 }}>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: C.textSub, marginBottom: 5, letterSpacing: "0.06em", textTransform: "uppercase" }}>Status</label>
                        <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ width: "100%", padding: "9px 12px", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: "0.85rem" }}>
                            {["PRESENT", "ABSENT", "LATE", "HALF_DAY"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <Field label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} />
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                        <Btn variant="default" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant="primary" onClick={handleSave}>Save</Btn>
                    </div>
                </Modal>
            )}
        </Card>
    );
}

// ─── SECTION: Payroll ───────────────────────────────────────────────────────
function PayrollSection({ user: currentUser }: { user: JwtUser }) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<null | "create" | any>(null);
    const [form, setForm] = useState({ name: "", period_start: "", period_end: "", notes: "" });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await payrollApi.getPayrollBatches?.() ?? [];
            setRows(Array.isArray(data) ? data : data?.data ?? []);
        } catch { setRows([]); }
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const canCreate = hasPerm(currentUser, "payroll.create", "batch.create");

    const cols = [
        { key: "name", label: "Batch Name" },
        { key: "period_start", label: "Period Start" },
        { key: "period_end", label: "Period End" },
        { key: "status", label: "Status", render: (r: any) => <Badge label={r.status ?? "—"} color={r.status === "APPROVED" ? "green" : r.status === "REJECTED" ? "red" : "amber"} /> },
        { key: "total_amount", label: "Total", render: (r: any) => r.total_amount ? `RWF ${Number(r.total_amount).toLocaleString()}` : "—" },
    ];

    const handleSave = async () => {
        try {
            if (modal === "create") { await payrollApi.createPayrollBatch?.(form); }
            else { await payrollApi.updatePayrollBatch?.(modal.uuid, form); }
            await load(); setModal(null);
        } catch { /* */ }
    };

    return (
        <Card>
            <SectionTitle action={canCreate ? <Btn variant="primary" size="sm" icon="plus" onClick={() => { setForm({ name: "", period_start: "", period_end: "", notes: "" }); setModal("create"); }}>New Batch</Btn> : undefined}>
                Payroll Batches
            </SectionTitle>
            <DataTable cols={cols} rows={rows} loading={loading}
                onEdit={hasPerm(currentUser, "payroll.create", "batch.create") ? (r) => { setForm({ name: r.name ?? "", period_start: r.period_start ?? "", period_end: r.period_end ?? "", notes: r.notes ?? "" }); setModal(r); } : undefined} />

            {modal !== null && (
                <Modal title={modal === "create" ? "New Payroll Batch" : "Edit Payroll Batch"} onClose={() => setModal(null)}>
                    <Field label="Batch Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
                    <Field label="Period Start" value={form.period_start} onChange={v => setForm(f => ({ ...f, period_start: v }))} type="date" />
                    <Field label="Period End" value={form.period_end} onChange={v => setForm(f => ({ ...f, period_end: v }))} type="date" />
                    <Field label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} />
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                        <Btn variant="default" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant="primary" onClick={handleSave}>Save</Btn>
                    </div>
                </Modal>
            )}
        </Card>
    );
}

// ─── SECTION: Payment Structures ────────────────────────────────────────────
function PaymentStructuresSection({ user: currentUser }: { user: JwtUser }) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<null | "create" | any>(null);
    const [form, setForm] = useState({ name: "", base_salary: "", description: "" });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await paymentStructuresApi.getPaymentStructures?.() ?? [];
            setRows(Array.isArray(data) ? data : data?.data ?? []);
        } catch { setRows([]); }
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const canWrite = hasPerm(currentUser, "payment-structures.create", "payment-structures.update");

    const cols = [
        { key: "name", label: "Structure Name" },
        { key: "base_salary", label: "Base Salary", render: (r: any) => r.base_salary ? `RWF ${Number(r.base_salary).toLocaleString()}` : "—" },
        { key: "description", label: "Description", render: (r: any) => r.description ?? "—" },
    ];

    const handleSave = async () => {
        try {
            if (modal === "create") { await paymentStructuresApi.createPaymentStructure?.(form); }
            else { await paymentStructuresApi.updatePaymentStructure?.(modal.uuid, form); }
            await load(); setModal(null);
        } catch { /* */ }
    };

    return (
        <Card>
            <SectionTitle action={canWrite ? <Btn variant="primary" size="sm" icon="plus" onClick={() => { setForm({ name: "", base_salary: "", description: "" }); setModal("create"); }}>Add Structure</Btn> : undefined}>
                Payment Structures
            </SectionTitle>
            <DataTable cols={cols} rows={rows} loading={loading}
                onEdit={canWrite ? (r) => { setForm({ name: r.name ?? "", base_salary: r.base_salary ?? "", description: r.description ?? "" }); setModal(r); } : undefined}
                onDelete={isAdmin(currentUser) ? async (r) => { if (!confirm("Delete this structure?")) return; try { await paymentStructuresApi.deletePaymentStructure?.(r.uuid); await load(); } catch { /* */ } } : undefined} />

            {modal !== null && (
                <Modal title={modal === "create" ? "Add Payment Structure" : "Edit Payment Structure"} onClose={() => setModal(null)}>
                    <Field label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
                    <Field label="Base Salary" value={form.base_salary} onChange={v => setForm(f => ({ ...f, base_salary: v }))} type="number" />
                    <Field label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                        <Btn variant="default" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant="primary" onClick={handleSave}>Save</Btn>
                    </div>
                </Modal>
            )}
        </Card>
    );
}

// ─── SECTION: Permissions ───────────────────────────────────────────────────
function PermissionsSection({ user: currentUser }: { user: JwtUser }) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await permissionsApi.getPermissions?.() ?? [];
            setRows(Array.isArray(data) ? data : data?.data ?? []);
        } catch { setRows([]); }
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const cols: Col<any>[] = [
        { key: "name", label: "Permission", render: (r: any) => r.name ?? friendlyPermissionName(r.permission_key) },
        { key: "module_name", label: "Module", render: (r: any) => <Badge label={r.module_name ?? "SYSTEM"} color="purple" /> },
        { key: "permission_key", label: "Key", render: (r: any) => <span style={{ color: C.textSub }}>{r.permission_key}</span> },
        { key: "access", label: "Access Included", render: (r: any) => permissionAccessText(r.permission_key) },
    ];

    return (
        <Card>
            <SectionTitle>
                Permissions
            </SectionTitle>
            <DataTable cols={cols} rows={rows} loading={loading} />
        </Card>
    );
}

function friendlyPermissionName(permissionKey?: string) {
    const names: Record<string, string> = {
        "employees.create": "Create Employees",
        "attendance.create": "Time Records",
        "payroll.create": "Batch Creation",
        "payroll.manage": "Payroll",
        "branch-manager.manage": "Branch Manager",
    };
    return permissionKey ? names[permissionKey] ?? permissionKey : "Permission";
}

function permissionAccessText(permissionKey?: string) {
    const access: Record<string, string> = {
        "employees.create": "Create, view, update, transfer, and soft delete employees",
        "attendance.create": "Record daily attendance, view records, update back records, and approve",
        "payroll.create": "Create payment batches and view batch history",
        "payroll.manage": "Create, view, manage, approve, and reject payroll batches",
        "payment-structures.create": "Create, view, update, and delete payment structures",
        "users.create": "Create, view, approve, update, and suspend users",
        "permissions.manage": "Create, view, and assign permissions",
        "branch-manager.manage": "Manage users, departments, employees, permissions, attendance, and payroll in one working location",
    };
    return permissionKey ? access[permissionKey] ?? "Direct access to this action" : "Direct access";
}

// ─── SECTION: Departments ───────────────────────────────────────────────────
function DepartmentsSection({ user: currentUser }: { user: JwtUser }) {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<null | "create" | any>(null);
    const [form, setForm] = useState({ name: "", description: "", working_location_id: "" });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await organizationApi.getDepartments?.() ?? [];
            setRows(Array.isArray(data) ? data : data?.data ?? []);
        } catch { setRows([]); }
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const cols = [
        { key: "name", label: "Name" },
        { key: "description", label: "Description", render: (r: any) => r.description ?? "—" },
        { key: "working_location", label: "Location", render: (r: any) => r.working_location?.name ?? "—" },
        { key: "employee_count", label: "Employees", render: (r: any) => r.employee_count ?? "—" },
    ];

    const handleSave = async () => {
        try {
            if (modal === "create") { await organizationApi.createDepartment?.(form); }
            else { await organizationApi.updateDepartment?.(modal.uuid, form); }
            await load(); setModal(null);
        } catch { /* */ }
    };

    return (
        <Card>
            <SectionTitle action={<Btn variant="primary" size="sm" icon="plus" onClick={() => { setForm({ name: "", description: "", working_location_id: "" }); setModal("create"); }}>Add Department</Btn>}>
                Departments
            </SectionTitle>
            <DataTable cols={cols} rows={rows} loading={loading}
                onEdit={(r) => { setForm({ name: r.name ?? "", description: r.description ?? "", working_location_id: r.working_location?.uuid ?? "" }); setModal(r); }}
                onDelete={async (r) => { if (!confirm("Delete this department?")) return; try { await organizationApi.deleteDepartment?.(r.uuid); await load(); } catch { /* */ } }} />

            {modal !== null && (
                <Modal title={modal === "create" ? "Add Department" : "Edit Department"} onClose={() => setModal(null)}>
                    <Field label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
                    <Field label="Description" value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} />
                    <Field label="Working Location ID" value={form.working_location_id} onChange={v => setForm(f => ({ ...f, working_location_id: v }))} />
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                        <Btn variant="default" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant="primary" onClick={handleSave}>Save</Btn>
                    </div>
                </Modal>
            )}
        </Card>
    );
}

// ─── SECTION: Working Locations (admin only) ────────────────────────────────
function LocationsSection() {
    const [rows, setRows] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<null | "create" | any>(null);
    const [form, setForm] = useState({ name: "", address: "", city: "", country: "" });

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await organizationApi.getWorkingLocations?.() ?? [];
            setRows(Array.isArray(data) ? data : data?.data ?? []);
        } catch { setRows([]); }
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    const cols = [
        { key: "name", label: "Name" },
        { key: "address", label: "Address", render: (r: any) => r.address ?? "—" },
        { key: "city", label: "City", render: (r: any) => r.city ?? "—" },
        { key: "country", label: "Country", render: (r: any) => r.country ?? "—" },
        { key: "employee_count", label: "Employees", render: (r: any) => r.employee_count ?? "—" },
    ];

    const handleSave = async () => {
        try {
            if (modal === "create") { await organizationApi.createWorkingLocation?.(form); }
            else { await organizationApi.updateWorkingLocation?.(modal.uuid, form); }
            await load(); setModal(null);
        } catch { /* */ }
    };

    return (
        <Card>
            <SectionTitle action={<Btn variant="primary" size="sm" icon="plus" onClick={() => { setForm({ name: "", address: "", city: "", country: "" }); setModal("create"); }}>Add Location</Btn>}>
                Working Locations
            </SectionTitle>
            <DataTable cols={cols} rows={rows} loading={loading}
                onEdit={(r) => { setForm({ name: r.name ?? "", address: r.address ?? "", city: r.city ?? "", country: r.country ?? "" }); setModal(r); }}
                onDelete={async (r) => { if (!confirm("Delete this location?")) return; try { await organizationApi.deleteWorkingLocation?.(r.uuid); await load(); } catch { /* */ } }} />

            {modal !== null && (
                <Modal title={modal === "create" ? "Add Location" : "Edit Location"} onClose={() => setModal(null)}>
                    <Field label="Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} />
                    <Field label="Address" value={form.address} onChange={v => setForm(f => ({ ...f, address: v }))} />
                    <Field label="City" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} />
                    <Field label="Country" value={form.country} onChange={v => setForm(f => ({ ...f, country: v }))} />
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
                        <Btn variant="default" onClick={() => setModal(null)}>Cancel</Btn>
                        <Btn variant="primary" onClick={handleSave}>Save</Btn>
                    </div>
                </Modal>
            )}
        </Card>
    );
}

// ─── SECTION: Activity Log ──────────────────────────────────────────────────
function ActivitySection({ profile }: { profile: any }) {
    const items: any[] = profile?.activity_history ?? [];
    if (!items.length) return null;

    return (
        <Card>
            <SectionTitle>Activity Log</SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.slice(0, 20).map((item: any, i: number) => (
                    <div key={item.uuid ?? i} style={{
                        display: "flex", gap: 12, alignItems: "flex-start",
                        padding: "10px 12px",
                        background: "rgba(255,255,255,0.025)",
                        borderRadius: 8,
                        borderLeft: `2px solid ${C.border}`,
                    }}>
                        <div style={{
                            width: 28, height: 28, borderRadius: 6,
                            background: C.surface,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, color: C.textSub,
                        }}>
                            <Ico d={IC.activity} size={13} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: "0.82rem", color: C.text, fontWeight: 500 }}>
                                {item.activity_description}
                            </p>
                            <div style={{ marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <span style={{ fontSize: "0.7rem", color: C.textMuted }}>{item.module_name}</span>
                                {item.action && <Badge label={item.action} color="default" />}
                                {item.created_at && (
                                    <span style={{ fontSize: "0.7rem", color: C.textMuted }}>
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: string; accent?: string }) {
    const col = accent ?? C.red;
    return (
        <div style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: "18px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
        }}>
            <div style={{
                width: 38, height: 38, borderRadius: 9,
                background: `${col}18`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, color: col,
            }}>
                <Ico d={IC[icon as keyof typeof IC] ?? ""} size={17} color={col} />
            </div>
            <div>
                <div style={{ fontSize: "1.35rem", fontWeight: 700, color: C.text, lineHeight: 1.1 }}>{value}</div>
                <div style={{ fontSize: "0.72rem", color: C.textSub, marginTop: 2, letterSpacing: "0.04em" }}>{label}</div>
            </div>
        </div>
    );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export default function AdminPage() {
    const router = useRouter();
    const [user, setUser] = useState<JwtUser | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [profileLoading, setProfileLoading] = useState(true);

    useEffect(() => {
        const currentUser = getCurrentUserFromToken();
        if (!currentUser) { router.replace("/login"); return; }
        setUser(currentUser);
        getMyProfile()
            .then(setProfile)
            .catch(() => setProfile(null))
            .finally(() => setProfileLoading(false));
    }, [router]);

    const handleLogout = useCallback(() => { clearTokens(); router.replace("/login"); }, [router]);

    const admin = useMemo(() => user ? isAdmin(user) : false, [user]);
    const bm = useMemo(() => user ? isBM(user) : false, [user]);
    const hasAnyPerm = useMemo(() => (user?.permissions.length ?? 0) > 0 || admin || bm, [user, admin, bm]);

    const showUsers = useMemo(() => user && (admin || bm || hasPerm(user, "users.read", "users.create", "users.update")), [user, admin, bm]);
    const showEmployees = useMemo(() => user && (admin || bm || hasPerm(user, "employees.read", "employees.create", "employees.update")), [user, admin, bm]);
    const showAttendance = useMemo(() => user && (admin || bm || hasPerm(user, "attendance.read", "attendance.create", "attendance.update")), [user, admin, bm]);
    const showPayroll = useMemo(() => user && (admin || hasPerm(user, "payroll.read", "payroll.create", "batch.read", "batch.create")), [user, admin]);
    const showStructures = useMemo(() => user && (admin || hasPerm(user, "payment-structures.read", "payment-structures.create", "payment-structures.update")), [user, admin]);
    const showPermissions = useMemo(() => user && (admin || bm || hasPerm(user, "permissions.read", "permissions.assign")), [user, admin, bm]);
    const showDepartments = useMemo(() => user && (admin || bm), [user, admin, bm]);
    const showLocations = useMemo(() => admin, [admin]);

    const greeting = useMemo(() => {
        const h = new Date().getHours();
        return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    }, []);

    const roleLabel = useMemo(() => {
        if (admin) return "System Administrator";
        if (bm) return "Branch Manager";
        if (hasAnyPerm) return "Permitted User";
        return "User";
    }, [admin, bm, hasAnyPerm]);

    if (!user) {
        return (
            <div style={{
                minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
                background: C.bg, color: C.textSub, fontSize: "0.85rem", letterSpacing: "0.06em",
            }}>
                Verifying session…
            </div>
        );
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: C.bg }}>
            <Sidebar user={user} onLogout={handleLogout} />

            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                {/* Navbar */}
                <header style={{
                    position: "sticky", top: 0, zIndex: 100,
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0 28px", height: 60,
                    background: "rgba(7,20,38,0.94)",
                    borderBottom: `1px solid ${C.border}`,
                    backdropFilter: "blur(14px)",
                    gap: 16,
                }}>
                    <div>
                        <h1 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
                            {greeting}, {user.first_name}
                        </h1>
                        <p style={{ margin: 0, fontSize: "0.68rem", color: C.textMuted, marginTop: 1 }}>{roleLabel}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{
                            padding: "4px 12px 4px 4px",
                            display: "flex", alignItems: "center", gap: 8,
                            background: "rgba(255,255,255,0.04)",
                            border: `1px solid ${C.border}`,
                            borderRadius: 8,
                        }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: "50%",
                                background: "linear-gradient(135deg, #e8294a, #ff6b35)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "0.65rem", fontWeight: 700, color: "#fff",
                            }}>
                                {`${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase()}
                            </div>
                            <div className="hidden sm:block">
                                <div style={{ fontSize: "0.78rem", fontWeight: 600, color: C.text, lineHeight: 1.2 }}>
                                    {user.first_name} {user.last_name}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            style={{
                                padding: "6px 14px",
                                background: C.redFaint, border: `1px solid ${C.redSoft}`,
                                borderRadius: 8, cursor: "pointer",
                                color: C.red, fontSize: "0.78rem", fontWeight: 500,
                                display: "flex", alignItems: "center", gap: 5,
                            }}
                        >
                            Sign out
                        </button>
                    </div>
                </header>

                {/* Content */}
                <main style={{ flex: 1, padding: "28px", display: "flex", flexDirection: "column", gap: 20 }}>

                    {/* Profile */}
                    {!profileLoading && <ProfileSection user={user} profile={profile} />}

                    {/* Stats row */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                        {!admin && <StatCard label="Permissions" value={user.permissions.length} icon="shield" accent={C.purple} />}
                        <StatCard label="Role" value={user.roles[0]?.replace("_", " ") ?? "USER"} icon="user" accent={C.red} />
                        {admin && <StatCard label="Full Access" value="Admin" icon="check" accent={C.green} />}
                        {bm && <StatCard label="Branch Level" value="Manager" icon="location" accent={C.amber} />}
                        {profile?.activity_history?.length > 0 && (
                            <StatCard label="Activity Records" value={profile.activity_history.length} icon="activity" accent={C.green} />
                        )}
                    </div>

                    {/* No permissions state */}
                    {!hasAnyPerm && <NoPermissionsSection profile={profile} />}

                    {/* Role-gated sections */}
                    {showLocations && <LocationsSection />}
                    {showDepartments && <DepartmentsSection user={user} />}
                    {showUsers && <UsersSection user={user} />}
                    {showEmployees && <EmployeesSection user={user} />}
                    {showAttendance && <AttendanceSection user={user} />}
                    {showPayroll && <PayrollSection user={user} />}
                    {showStructures && <PaymentStructuresSection user={user} />}
                    {showPermissions && <PermissionsSection user={user} />}

                    {/* Activity always shown if history exists */}
                    <ActivitySection profile={profile} />

                    <div style={{ height: 32 }} />
                </main>
            </div>
        </div>
    );
}
