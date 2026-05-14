"use client";

import { useEffect, useState } from "react";

export function PageLoader() {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = window.setTimeout(() => setVisible(false), 90000);
        return () => window.clearTimeout(timer);
    }, []);

    if (!visible) return null;

    return (
        <div id="loader">
            <div className="ld-logo">REG</div>
            <div className="ld-track">
                <div className="ld-bar" />
            </div>
            <div className="ld-txt">Loading payment system</div>
        </div>
    );
}
