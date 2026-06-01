import axios from "axios";

const api = axios.create({
    baseURL:
       process.env.NEXT_PUBLIC_API_URL ||
       "http://localhost:5000",
    withCredentials: true,
    timeout: 15000, // 15s timeout for better responsiveness
});

api.interceptors.request.use((config) => {
    const token =
        typeof window !== "undefined"
            ? localStorage.getItem("accessToken")
            : null;

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Global Error Interceptor to prevent cascading failures
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status ?? null;

        if (status === 401) {
            // Only clear and redirect if we are not already on auth pages
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
                localStorage.removeItem("accessToken");
                localStorage.removeItem("refreshToken");
                window.location.href = "/auth/login";
            }
        }

        // Silent fail for non-critical errors to keep UI alive
        return Promise.reject(error);
    }
);

export default api;
