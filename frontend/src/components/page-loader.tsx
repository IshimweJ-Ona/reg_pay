"use client";

import { useEffect, useState } from "react";

export function PageLoader() {
    const [visible, setVisible] = useState(true);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        let timers: ReturnType<typeof setTimeout>[] = [];
        let hide: ReturnType<typeof setTimeout> | undefined;

        const runLoader = () => {
            setVisible(true);
            setProgress(0);
            timers.forEach(clearTimeout);
            if (hide) clearTimeout(hide);
            const steps = [20, 45, 70, 88, 100];
            timers = steps.map((val, i) =>
                setTimeout(() => setProgress(val), i * 120 + 60),
            );
            hide = setTimeout(() => setVisible(false), 820);
        };

        runLoader();
        window.addEventListener("popstate", runLoader);
        const handlePageShow = (event: PageTransitionEvent) => {
            if (event.persisted) runLoader();
        };

        window.addEventListener("pageshow", handlePageShow);

        return () => {
            timers.forEach(clearTimeout);
            if (hide) clearTimeout(hide);
            window.removeEventListener("popstate", runLoader);
            window.removeEventListener("pageshow", handlePageShow);
        };
    }, []);

    if (!visible) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 9990,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                background: "linear-gradient(135deg, #040a15 0%, #071426 50%, #0b1e3d 100%)",
                transition: "opacity 0.4s ease",
            }}
        >
            <div style={{ marginBottom: 32, textAlign: "center" }}>
                <div
                    style={{
                        fontSize: "2.8rem",
                        fontWeight: 800,
                        letterSpacing: "0.18em",
                        color: "#e8294a",
                        fontFamily: "'Georgia', serif",
                        lineHeight: 1,
                    }}
                >
                    REG
                </div>
                <div
                    style={{
                        marginTop: 6,
                        fontSize: "0.62rem",
                        letterSpacing: "0.28em",
                        color: "rgba(255,255,255,0.35)",
                        fontWeight: 600,
                        textTransform: "uppercase",
                    }}
                >
                    Payment System
                </div>
            </div>

            <div
                style={{
                    width: 200,
                    height: 2,
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 999,
                    overflow: "hidden",
                }}
            >
                <div
                    style={{
                        height: "100%",
                        width: `${progress}%`,
                        background: "linear-gradient(90deg, #e8294a, #ff6b35)",
                        borderRadius: 999,
                        transition: "width 0.25s ease",
                    }}
                />
            </div>

            <div
                style={{
                    marginTop: 16,
                    fontSize: "0.65rem",
                    letterSpacing: "0.22em",
                    color: "rgba(255,255,255,0.25)",
                    fontWeight: 600,
                    textTransform: "uppercase",
                }}
            >
                Loading
            </div>
        </div>
    );
}
