import api from "./axios";

export interface CreatePaymentStructurePayload {
    employee_id: string;
    payroll_frequency: "DAILY" | "MONTHLY";
    basic_salary: string;
    daily_rate: string;
    overtime_rate: string;
    tax_percentage: string;
    effective_from: string;
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
    payload: CreatePaymentStructurePayload,
) => {
    const response = await api.post("/payment-structures", payload);
    return response.data;
};

export const updatePaymentStructure = async (
    uuid: string,
    payload: UpdatePaymentStructurePayload,
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

export const createDeductionType = async (
    payload: CreateDeductionTypePayload,
) => {
    const response = await api.post("/payment-structures/deduction-types", payload);
    return response.data;
};

export const getDeductionTypes = async () => {
    const response = await api.get("/payment-structures/decution-types");
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
    const response = await api.post("/payment-structures/employee-dedductions", payload);
    return response.data;
};

export const getEmployeeDeductions = async (employeeId: string) => {
    const response = await api.get(
        `/payment-structures/employee-dedductions/empoyee/${employeeId}`,
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
