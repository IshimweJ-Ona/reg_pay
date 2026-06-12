import { useEffect, useState, useRef, useCallback } from 'react';

export interface Notification {
    id: string;
    uuid: string;
    title: string;
    message: string;
    type: string;
    is_read: boolean;
    reference_id?: string;
    metadata?: any;
    created_at: string;
}

export function useNotifications(token: string) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const retryCount = useRef(0);
    const maxRetries = 5;

    const connect = useCallback(() => {
        if (!token) return;

        const url = `${process.env.NEXT_PUBLIC_API_URL}/notifications/stream?token=${token}`;
        const es = new EventSource(url);

        es.onopen = () => {
            console.log('SSE connected');
            retryCount.current = 0;
        };

        es.onmessage = (event) => {
            try {
                const notification: Notification = JSON.parse(event.data);
                setNotifications((prev) => [notification, ...prev]);
                if (!notification.is_read) {
                    setUnreadCount((prev) => prev + 1);
                }
            } catch (err) {
                console.error('Failed to parse notification:', err);
            }
        };

        es.onerror = (err) => {
            console.error('SSE error:', err);
            es.close();

            if (retryCount.current < maxRetries) {
                const delay = Math.pow(2, retryCount.current) * 1000;
                console.log(`Retrying SSE in ${delay}ms...`);
                setTimeout(() => {
                    retryCount.current++;
                    connect();
                }, delay);
            } else {
                console.error('Max SSE retries reached');
            }
        };

        return es;
    }, [token]);

    useEffect(() => {
        const es = connect();
        return () => {
            es?.close();
        };
    }, [connect]);

    return { notifications, unreadCount, setUnreadCount };
}
