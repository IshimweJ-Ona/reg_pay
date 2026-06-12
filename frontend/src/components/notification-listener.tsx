"use client";

import { useEffect, useRef } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";

export function NotificationListener() {
    const { accessToken } = useAuth();
    const { toast } = useToast();
    const { notifications } = useNotifications(accessToken || '');
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const processedIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        // Request notification permission
        if (typeof window !== 'undefined' && "Notification" in window) {
            if (Notification.permission === "default") {
                Notification.requestPermission();
            }
        }

        // Initialize audio
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3'); // Fallback ping
    }, []);

    useEffect(() => {
        if (notifications.length === 0) return;
        
        const latest = notifications[0];
        if (processedIds.current.has(latest.id)) return;
        
        processedIds.current.add(latest.id);

        // Play audio cue
        audioRef.current?.play().catch(() => {});

        // Browser notification
        if (typeof window !== 'undefined' && Notification.permission === "granted") {
            new Notification(latest.title || 'New Notification', {
                body: latest.message,
                icon: '/favicon.ico'
            });
        }

        // Toast with auto-dismiss
        const { dismiss } = toast({
            title: latest.title || latest.type.toUpperCase(),
            description: latest.message,
        });

        const timer = setTimeout(() => {
            dismiss();
        }, 10000);

        return () => clearTimeout(timer);
    }, [notifications, toast]);

    return null;
}