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

export const refreshToken = async (refresh_token: string): Promise<TokenPair> => {
    const response = await api.post<TokenPair>("/auth/refresh", {
        refresh_token,
    });
    return response.data;
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
    localStorage.setItem("accessToken", tokens.access_token);
    localStorage.setItem("refreshToken", tokens.refresh_token);
};

export const clearTokens = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
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
    const token = localStorage.getItem("accessToken");
    return token ? decodeJwt(token) : null;
};
