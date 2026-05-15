"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearTokens, getCurrentUserFromToken, type JwtUser } from "@/api/auth";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Navbar } from "@/components/navbar/navbar";

interface AdminLayoutProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
}

export function AdminLayout({ children, title, subtitle }: AdminLayoutProps) {
    const router = useRouter();
    const [user, setUser] = useState<JwtUser | null>(null);

    useEffect(() => {
        const u = getCurrentUserFromToken();
        if (!u) { router.replace("/login"); return; }
        setUser(u);
    }, [router]);

    const handleLogout = () => {
        clearTokens();
        router.replace("/login");
    };

    if (!user) {
        return (
            <div style={{
                minHeight: "100vh",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "#071426", color: "rgba(255,255,255,0.4)",
                fontSize: "0.85rem", letterSpacing: "0.05em",
            }}>
                Verifying session…
            </div>
        );
    }

    return (
        <div style={{ display: "flex", minHeight: "100vh", background: "#071426" }}>
            <Sidebar user={user} onLogout={handleLogout} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
                <Navbar user={user} title={title} subtitle={subtitle} />
                <main style={{ flex: 1, overflowY: "auto" }}>
                    {children}
                </main>
            </div>
        </div>
    );
}