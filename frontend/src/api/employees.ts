import type { Gender } from "./auth";
import api from "./axios";

export interface CreateEmployeePayload {
    user_id?: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone_number?: string;
    password?: string;
    national_id?: string;
    gender: Gender;
    hire_date?: string;
    department_id?: string;
    working_location_id?: string;
    employment_category_id?: string;
}

export interface ApproveEmployeePayload {
    working_location_id: string;
    department_id: string;
    employment_category_id: string;
    hire_date: string;
}

export interface TransferEmployeePayload {
    working_location_id: string;
    department_id: string;
    employment_category_id?: string;
    reason?: string;
}

export const registerEmployee = async (payload: CreateEmployeePayload) => {
    const response = await api.post("/employees/register", payload);
    return response.data;
};

export const createEmployee = async (payload: CreateEmployeePayload) => {
    const response = await api.post("/employees", payload);
    return response.data;
};

export const getEmployees = async () => {
    const response = await api.get("/employees");
    return response.data;
};

export const getEmployee = async (uuid: string) => {
    const response = await api.get(`/employees/${uuid}`);
    return response.data;
};

export const approveEmployee = async (
    uuid: string,
    payload: ApproveEmployeePayload,
) => {
    const response = await api.patch(`/employees/${uuid}/approve`, payload);
    return response.data;
};

export const linkEmployeeUser = async (uuid: string, user_id: string) => {
    const response = await api.patch(`/employees/${uuid}/link-user`, {
        user_id,
    });
    return response.data;
};

export const transferEmployee = async (
    uuid: string,
    payload: TransferEmployeePayload,
) => {
    const response = await api.patch(`/employees/${uuid}/transfer`, payload);
    return response.data;
};

export const approveEmployeeTransfer = async (uuid: string) => {
    const response = await api.patch(`/employees/transfer-requests/${uuid}/approve`);
    return response.data;
};

export const rejectEmployeeTransfer = async (
    uuid: string,
    rejection_reason: string,
) => {
    const response = await api.patch(`/employees/transfer-requests/${uuid}/reject`, {
        rejection_reason,
    });
    return response.data;
};

export const suspendEmployee = async (uuid: string, reason?: string) => {
    const response = await api.patch(`/employees/${uuid}/suspend`, { reason });
    return response.data;
};

export const reactivateEmployee = async (uuid: string) => {
    const response = await api.patch(`/employees/${uuid}/reactivate`);
    return response.data;
};
