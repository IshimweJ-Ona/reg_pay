import api from "./axios";

export interface CreatePermissionPayload {
    name: string;
    module_name: string;
    permission_key: string;
}

export interface AssignPermissionPayload {
    role_id: string;
    permission_id: string;
}

export interface AssignUserPermissionPayload {
    user_id: string;
    permission_id: string;
}

export const createPermission = async (payload: CreatePermissionPayload) => {
    const response = await api.post("/permissions", payload);
    return response.data;
};

export const getPermissions = async () => {
    const response = await api.get("/permissions");
    return response.data;
};

export const assignPermissionToRole = async (
    payload: AssignPermissionPayload,
) => {
    const response = await api.post("/permissions/assign-role", payload);
    return response.data;
};

export const removePermissionFromRole = async (
    payload: AssignPermissionPayload,
) => {
    const response = await api.delete("/permissions/assign-role", {
        params: payload,
    });
    return response.data;
};

export const assignPermissionToUser = async (
    payload: AssignUserPermissionPayload,
) => {
    const response = await api.post("/permissions/assign-user", payload);
    return response.data;
};

export const removePermissionFromUser = async (
    payload: AssignUserPermissionPayload,
) => {
    const response = await api.delete("/permissions/assign-user", {
        params: payload,
    });
    return response.data;
};

export const assignPermission = async (payload: AssignUserPermissionPayload | any) => {
    return assignPermissionToUser({
        user_id: payload.user_id ?? payload.user_uuid,
        permission_id: payload.permission_id ?? payload.permission,
    });
};

export const revokePermission = async (uuidOrPayload: string | AssignUserPermissionPayload) => {
    if (typeof uuidOrPayload === "string") {
        return { message: "Permission revocation requires user_id and permission_id." };
    }

    return removePermissionFromUser(uuidOrPayload);
};
