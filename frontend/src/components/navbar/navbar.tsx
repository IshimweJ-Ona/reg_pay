"use client";

import type { JwtUser } from "@/api/auth";

function Icon({ d, size = 16 }: { d: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d={d} />
        </svg>
    );
}

const BELL = "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0";
const SEARCH = "M21 21l-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0z";

interface NavbarProps {
    user: JwtUser;
    title?: string;
    subtitle?: string;
}

export function Navbar({ user, title = "Dashboard", subtitle }: NavbarProps) {
    const initials = `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase();
    const primaryRole = user.roles[0] ?? "USER";
    const roleLabel = primaryRole.replace("_", " ");

    const roleBadgeColor =
        primaryRole === "ADMIN" ? { bg: "rgba(232,41,74,0.15)", color: "#e8294a" } :
            primaryRole === "BRANCH_MANAGER" ? { bg: "rgba(108,92,231,0.15)", color: "#6c5ce7" } :
                { bg: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.5)" };

    return (
        <header style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            height: 60,
            background: "rgba(7,20,38,0.92)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(12px)",
            gap: 16,
        }}>
            {/* Left — page title */}
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <h1 style={{
                    margin: 0,
                    fontSize: "1rem",
                    fontWeight: 700,
                    color: "#fff",
                    letterSpacing: "-0.01em",
                    lineHeight: 1.2,
                }}>{title}</h1>
                {subtitle && (
                    <p style={{
                        margin: 0,
                        fontSize: "0.7rem",
                        color: "rgba(255,255,255,0.35)",
                        marginTop: 1,
                    }}>{subtitle}</p>
                )}
            </div>

            {/* Right */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Search hint */}
                <button style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8, cursor: "pointer",
                    color: "rgba(255,255,255,0.35)",
                    fontSize: "0.75rem",
                }}>
                    <Icon d={SEARCH} size={13} />
                    <span className="hidden sm:inline">Search...</span>
                </button>

                {/* Notifications */}
                <button style={{
                    width: 36, height: 36,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8, cursor: "pointer",
                    color: "rgba(255,255,255,0.45)",
                    position: "relative",
                }}>
                    <Icon d={BELL} size={15} />
                    <span style={{
                        position: "absolute", top: 7, right: 7,
                        width: 6, height: 6,
                        background: "#e8294a",
                        borderRadius: "50%",
                        border: "1px solid #071426",
                    }} />
                </button>

                {/* Divider */}
                <div style={{ width: 1, height: 24, background: "rgba(255,255,255,0.08)" }} />

                {/* User chip */}
                <div style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "4px 10px 4px 4px",
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 8,
                    cursor: "default",
                }}>
                    <div style={{
                        width: 28, height: 28, borderRadius: "50%",
                        background: "linear-gradient(135deg, #e8294a, #ff6b35)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.65rem", fontWeight: 700, color: "#fff",
                        flexShrink: 0,
                    }}>{initials}</div>
                    <div className="hidden sm:block">
                        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#fff", lineHeight: 1.2 }}>
                            {user.first_name} {user.last_name}
                        </div>
                        <div style={{
                            display: "inline-block",
                            fontSize: "0.58rem", fontWeight: 600,
                            letterSpacing: "0.1em", textTransform: "uppercase",
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: roleBadgeColor.bg,
                            color: roleBadgeColor.color,
                            marginTop: 1,
                        }}>{roleLabel}</div>
                    </div>
                </div>
            </div>
        </header>
    );
}