import api from "./axios";

export interface CreatePayrollBatchPayload {
    working_location_id: string;
    payroll_month: number;
    payroll_year: number;
    payment_date: string;
    payment_method: "BANK" | "CASH" | "MOMO";
}

export const createPayrollBatch = async (payload: Partial<CreatePayrollBatchPayload> | any) => {
    const response = await api.post("/payroll/batches", payload);
    return response.data;
};

export const getPayrollBatches = async () => {
    const response = await api.get("/payroll/batches");
    return response.data;
};

export const getPayrollBatch = async (uuid: string) => {
    const response = await api.get(`/payroll/batches/${uuid}`);
    return response.data;
};

export const approvePayrollBatch = async (uuid: string, comment?: string) => {
    const response = await api.patch(`/payroll/batches/${uuid}/approve`, {
        comment,
    });
    return response.data;
};

export const rejectPayrollBatch = async (
    uuid: string,
    rejection_reason: string,
) => {
    const response = await api.patch(`/payroll/batches/${uuid}/reject`, {
        rejection_reason,
    });
    return response.data;
};

export const updatePayrollBatch = async (uuid: string, payload: any) => {
    return approvePayrollBatch(uuid, payload?.comment);
};

export const approvePayrollItem = async (uuid: string, comment?: string) => {
    const response = await api.patch(`/payroll/batches/items/${uuid}/approve`, {
        comment,
    });
    return response.data;
};

export const rejectPayrollItem = async (
    uuid: string,
    rejection_reason: string,
) => {
    const response = await api.patch(`/payroll/batches/items/${uuid}/reject`, {
        rejection_reason,
    });
    return response.data;
};
