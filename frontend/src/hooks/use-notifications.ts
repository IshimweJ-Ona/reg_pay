import { useEffect, useState, useRef } from 'react';

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
    const [retryTrigger, setRetryTrigger] = useState(0);
    const retryCount = useRef(0);
    const maxRetries = 5;

    useEffect(() => {
        if (!token) return;

        let es: EventSource | null = null;

        function connect() {
            const encodedToken = encodeURIComponent(token);
            const url = `${process.env.NEXT_PUBLIC_API_URL}/notifications/stream?token=${encodedToken}`;

            console.log('Connecting to SSE...');
            es = new EventSource(url);

            es.onopen = () => {
                console.log('SSE connected successfully');
                retryCount.current = 0;
            };

            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'heartbeat') return;

                    if (data.type === 'employees_updated' || data.type === 'attendance_updated' || data.type === 'permissions_updated') {
                        console.log('System sync event received:', data.type);
                        window.dispatchEvent(new CustomEvent('system_update', { detail: data }));
                        return;
                    }

                    const notification: Notification = data;
                    setNotifications((prev) => {
                        if (prev.some(n => n.id === notification.id)) return prev;
                        return [notification, ...prev];
                    });
                    if (!notification.is_read) {
                        setUnreadCount((prev) => prev + 1);
                    }
                } catch (err) {
                    console.error('Failed to parse notification:', err);
                }
            };

            es.onerror = (err) => {
                console.error('SSE connection error. ReadyState:', es?.readyState, err);
                es?.close();

                if (retryCount.current < maxRetries) {
                    const delay = Math.pow(2, retryCount.current) * 1000;
                    console.log(`Retrying SSE in ${delay}ms... (Attempt ${retryCount.current + 1}/${maxRetries})`);
                    setTimeout(() => {
                        retryCount.current++;
                        setRetryTrigger(prev => prev + 1);
                    }, delay);
                } else {
                    console.error('Max SSE retries reached');
                }
            };
        }

        connect();

        return () => {
            console.log('Closing SSE connection');
            es?.close();
        };
    }, [token, retryTrigger]);

    return { notifications, unreadCount, setUnreadCount };
}