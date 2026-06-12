import api from "./axios";

export interface CreatePaymentStructurePayload {
    employee_id: string;
    payroll_frequency: "DAILY" | "MONTHLY" | "CUSTOM";
    basic_salary: string;
    daily_rate: string;
    overtime_rate: string;
    tax_percentage: string;
    custom_work_days?: number;
    effective_from: string;
}

export interface CreateAllowancePayload {
    employee_id: string;
    title: string;
    amount: string;
    description?: string;
}

export type UpdatePaymentStructurePayload = Partial<
    Omit<CreatePaymentStructurePayload, "employee_id" | "effective_from">
> & {
    effective_to?: string;
};

export interface CreateDeductionTypePayload {
    name: string;
    deduction_mode: "FIXED" | "PERCENTAGE";
    amount?: string;
    percentage_value?: string;
    is_mandatory?: boolean;
}

export interface CreateEmployeeDeductionPayload {
    employee_id: string;
    deduction_type_id: string;
    start_date: string;
    end_date?: string;
    is_active?: boolean;
}

export const createPaymentStructure = async (
    payload: Partial<CreatePaymentStructurePayload> | any,
) => {
    const response = await api.post("/payment-structures", payload);
    return response.data;
};

export const updatePaymentStructure = async (
    uuid: string,
    payload: UpdatePaymentStructurePayload | any,
) => {
    const response = await api.patch(`/payment-structures/${uuid}`, payload);
    return response.data;
};

export const getPaymentStructuresByEmployee = async (employeeId: string) => {
    const response = await api.get(`/payment-structures/employee/${employeeId}`);
    return response.data;
};

export const getActivePaymentStructureByEmployee = async (employeeId: string) => {
    const response = await api.get(
        `/payment-structures/employee/${employeeId}/active`,
    );
    return response.data;
};

export const getPaymentStructures = async (): Promise<any> => {
    return [];
};

export const getPaymentCategories = async () => {
    const response = await api.get("/payment-structures/payment-categories");
    return response.data;
};

export const deletePaymentStructure = async (
    uuid: string,
) => {
    return updatePaymentStructure(uuid, { effective_to: new Date().toISOString() });
};

export const createDeductionType = async (
    payload: CreateDeductionTypePayload,
) => {
    const response = await api.post("/payment-structures/deduction-types", payload);
    return response.data;
};

export const getDeductionTypes = async () => {
    const response = await api.get("/payment-structures/deduction-types");
    return response.data;
};

export const updateDeductionType = async (
    uuid: string,
    payload: Partial<CreateDeductionTypePayload>,
) => {
    const response = await api.patch(
        `/payment-structures/deduction-types/${uuid}`,
        payload,
    );
    return response.data;
};

export const createEmployeeDeduction = async (
    payload: CreateEmployeeDeductionPayload,
) => {
    const response = await api.post("/payment-structures/employee-deductions", payload);
    return response.data;
};

export const getEmployeeDeductions = async (employeeId: string) => {
    const response = await api.get(
        `/payment-structures/employee-deductions/employee/${employeeId}`,
    );
    return response.data;
};

export const updateEmployeeDeduction = async (
    uuid: string,
    payload: Partial<CreateEmployeeDeductionPayload>,
) => {
    const response = await api.patch(
        `/payment-structures/employee-deductions/${uuid}`,
        payload,
    );
    return response.data;
};

export const deleteEmployeeDeduction = async (uuid: string) => {
    const response = await api.patch(
        `/payment-structures/employee-deductions/${uuid}/delete`,
    );
    return response.data;
};

export const createAllowance = async (payload: CreateAllowancePayload) => {
    const response = await api.post("/payment-structures/allowances", payload);
    return response.data;
};

export const getAllowances = async (employeeId: string) => {
    const response = await api.get(`/payment-structures/allowances/employee/${employeeId}`);
    return response.data;
};

export const deactivateAllowance = async (uuid: string) => {
    const response = await api.patch(`/payment-structures/allowances/${uuid}/deactivate`);
    return response.data;
};

export const updateAllowance = async (uuid: string, payload: Partial<CreateAllowancePayload>) => {
    const response = await api.patch(`/payment-structures/allowances/${uuid}`, payload);
    return response.data;
};
