import type { RegisterUserPayload } from "./auth";
import api from "./axios";

export interface ApproveUserPayload {
    working_location_id: string;
    department_id: string;
    role_ids?: string[];
}

export interface RequestUserTransferPayload {
    working_location_id: string;
    department_id?: string;
    reason?: string;
}

export const createUser = async (payload: RegisterUserPayload) => {
    const response = await api.post("/users", payload);
    return response.data;
};

export const getUsers = async () => {
    const response = await api.get("/users");
    return response.data;
};

export const getPendingUsers = async () => {
    const response = await api.get("/users/pending");
    return response.data;
};

export const approveUser = async (uuid: string, payload: ApproveUserPayload) => {
    const response = await api.patch(`/users/${uuid}/approve`, payload);
    return response.data;
};

export const rejectUser = async (uuid: string, reason: string) => {
    const response = await api.patch(`/users/${uuid}/reject`, { reason });
    return response.data;
};

export const suspendUser = async (uuid: string) => {
    const response = await api.patch(`/users/${uuid}/suspend`);
    return response.data;
};

export const assignUserRoles = async (uuid: string, role_ids: string[]) => {
    const response = await api.patch(`/users/${uuid}/roles`, { role_ids });
    return response.data;
};

export const requestUserTransfer = async (
    uuid: string,
    payload: RequestUserTransferPayload,
) => {
    const response = await api.post(`/users/${uuid}/transfer-requests`, payload);
    return response.data;
};

export const approveUserTransfer = async (uuid: string) => {
    const response = await api.patch(`/users/transfer-requests/${uuid}/approve`);
    return response.data;
};

export const rejectUserTransfer = async (
    uuid: string,
    rejection_reason: string,
) => {
    const response = await api.patch(`/users/transfer-requests/${uuid}/reject`, {
        rejection_reason,
    });
    return response.data;
};
