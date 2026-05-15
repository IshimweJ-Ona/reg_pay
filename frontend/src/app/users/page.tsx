"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
    clearTokens,
    getCurrentUserFromToken,
    getMyProfile,
    type JwtUser,
} from "@/api/auth";

import { Sidebar } from "@/components/sidebar/sidebar";

export default function UsersPage() {
    const router = useRouter();

    const [user, setUser] = useState<JwtUser | null>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const currentUser = getCurrentUserFromToken();
        
        if (!currentUser) {
            router.replace("/login");
            return;
        }
        
        setUser(currentUser);
        
        getMyProfile()
            .then(setProfile)
            .catch(() => setProfile(null))
            .finally(() => setLoading(false));
        }, [router]);
        
        const handleLogout = () => {
            clearTokens();
            router.replace("/login");
        };
        
        if (!user) return null;
        
        return (
            <div style={{ display: "flex", minHeight: "100vh", background: C.bg }}>
                <Sidebar user={user} onLogout={handleLogout} />
                
                <main
                style={{
                flex: 1,
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: 20,
            }}
            >
                {!loading && (
                    <>
                        <ProfileSection user={user} profile={profile} />
                        
                        {user.permissions.length === 0 && (
                            <NoPermissionsSection profile={profile} />
                        )}

                        <ActivitySection profile={profile} />
                    </>
            )}
            </main>
        </div>
    );
}