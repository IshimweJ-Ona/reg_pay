"use client";

import { useEffect, useState } from "react";

const loaderText = "Loading REG payment system";

export function PageLoader() {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = window.setTimeout(() => setVisible(false), 1100);
        return () => window.clearTimeout(timer);
    }, []);

    if (!visible) return null;

    return (
        <div className="reg-loader">
            <div className="reg-loader-logo">REG</div>
            <div className="reg-loader-track">
                <div className="reg-loader-bar" />
            </div>
            <div className="reg-loader-text">{loaderText}</div>
        </div>
    );
}
