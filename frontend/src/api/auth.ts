import api from "./axios";

export type Gender = "MALE" | "FEMALE";

export interface LoginPayload {
    identifier: string;
    password: string;
}

export interface RegisterUserPayload {
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    password: string;
    gender: Gender;
    department_id?: string;
    working_location_id?: string;
    role_ids?: string[];
    permission_ids?: string[];
}

export interface TokenPair {
    access_token: string;
    refresh_token: string;
    expires_in: string;
}

export interface LoginResponse extends TokenPair {
    redirectUrl: string;
    uuid: string;
    status: string;
}

export interface ForgotPasswordPayload {
    identifier: string;
}

export interface ForgotPasswordResponse {
    message: string;
    reset_token?: string;
    user_name?: string;
}

export interface ResetPasswordPayload {
    password: string;
    confirmPassword: string;
}

export interface UpdateProfilePayload {
    first_name?: string;
    last_name?: string;
    email?: string;
    password?: string;
}

export interface JwtUser {
    sub: string;
    uuid?: string;
    email: string;
    phone_number: string;
    first_name: string;
    last_name: string;
    status: string;
    roles: string[];
    permissions: string[];
    working_location_id: string | null;
    department_id: string | null;
    avatar_url?: string;
    exp?: number;
    iat?: number;
}

export const login = async (payload: LoginPayload): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>("/auth/login", payload);
    return response.data;
};

export const registerUser = async (payload: RegisterUserPayload) => {
    const response = await api.post("/auth/register", payload);
    return response.data;
};

export const forgotPassword = async (
    payload: ForgotPasswordPayload,
): Promise<ForgotPasswordResponse> => {
    const response = await api.post<ForgotPasswordResponse>("/auth/forgot-password", payload);
    return response.data;
};

export const resetPassword = async (
    token: string,
    payload: ResetPasswordPayload,
) => {
    const response = await api.post(`/auth/reset-password/${token}`, payload);
    return response.data;
};

export const getMyProfile = async () => {
    const response = await api.get("/auth/me");
    return response.data;
};

export const updateProfile = async (payload: UpdateProfilePayload) => {
    const response = await api.patch("/auth/profile", payload);
    return response.data;
};

/**
 * In-flight refresh guard.
 *
 * The old refresh token is rotated (revoked) server-side on every successful
 * call to /auth/refresh. If two callers (the 13-minute interval timer, a
 * manual refreshSession() call, an axios 401 interceptor, React Strict Mode
 * double-invoking an effect, etc.) fire at nearly the same moment, they both
 * read the SAME token from sessionStorage before either write-back happens.
 * The first request rotates the token and succeeds; the second one is still
 * holding the now-revoked token and gets a 401 "Invalid or revoked refresh
 * token" - which is exactly the repeating error we were seeing.
 *
 * The fix: collapse concurrent refresh attempts into a single shared
 * promise. Whoever calls refreshToken() while a refresh is already in
 * flight just awaits that same call instead of firing a new one.
 */
let refreshPromise: Promise<TokenPair> | null = null;

export const refreshToken = async (refresh_token: string): Promise<TokenPair> => {
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = (async () => {
        try {
            const response = await api.post<TokenPair>("/auth/refresh", {
                refresh_token,
            });
            return response.data;
        } finally {
            // Clear regardless of success/failure so future refresh attempts
            // (e.g. after a fresh login) aren't stuck reusing a dead promise.
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

export const logout = async (refresh_token: string) => {
    const response = await api.post("/auth/logout", { refresh_token });
    return response.data;
};

export const logoutAll = async () => {
    const response = await api.post("/auth/logout-all");
    return response.data;
};

export const saveTokens = (tokens: TokenPair) => {
    sessionStorage.setItem("accessToken", tokens.access_token);
    sessionStorage.setItem("refreshToken", tokens.refresh_token);
};

export const clearTokens = () => {
    sessionStorage.removeItem("accessToken");
    sessionStorage.removeItem("refreshToken");
};

export const decodeJwt = (token: string): JwtUser | null => {
    try {
        const payload = token.split(".")[1];
        let normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
        // Add padding if required
        const pad = normalized.length % 4;
        if (pad) normalized += "=".repeat(4 - pad);
        const decoded = atob(normalized);

        return JSON.parse(decoded) as JwtUser;
    } catch {
        return null;
    }
};

export const getCurrentUserFromToken = () => {
    const token = sessionStorage.getItem("accessToken");
    return token ? decodeJwt(token) : null;
};