import api from "./axios";

export interface EmploymentCategorySummary {
    id: string;
    uuid: string;
    name: string;
    payroll_frequency: "DAILY" | "MONTHLY" | "CUSTOM";
    tax_behavior: "STANDARD" | "PERIODIC" | "EXEMPT";
}

export interface PositionDeductionType {
    uuid: string;
    name: string;
    deduction_mode: "FIXED" | "PERCENTAGE";
}

export interface PositionAllowanceTemplate {
    uuid: string;
    title: string;
    default_amount: string;
    description: string | null;
    allowance_type_id: string | null;
}

// A position can offer several employment-category variants (Monthly /
// Daily / Custom), each with its own default salary - so assigning an
// employee requires picking both the position AND one of these variants.
export interface PositionEmploymentCategory {
    uuid: string;
    employment_category_id: string;
    name: string;
    payroll_frequency: "DAILY" | "MONTHLY" | "CUSTOM";
    tax_behavior: "STANDARD" | "PERIODIC" | "EXEMPT";
    default_basic_salary: string | null;
    default_daily_rate: string | null;
    default_overtime_rate: string | null;
    default_custom_work_days: number | null;
}

export interface Position {
    id: string;
    uuid: string;
    name: string;
    description: string | null;
    status: "ACTIVE" | "INACTIVE";
    employment_categories: PositionEmploymentCategory[];
    deduction_types: PositionDeductionType[];
    allowance_templates: PositionAllowanceTemplate[];
    created_at: string;
    updated_at: string;
}

export interface CreatePositionPayload {
    name: string;
    description?: string;
}

export type UpdatePositionPayload = Partial<CreatePositionPayload>;

export interface AttachEmploymentCategoryPayload {
    employment_category_id: string;
    default_basic_salary?: string;
    default_daily_rate?: string;
    default_overtime_rate?: string;
    default_custom_work_days?: number;
}

export const getEmploymentCategories = async (): Promise<EmploymentCategorySummary[]> => {
    const response = await api.get("/positions/employment-categories");
    return response.data.employment_categories ?? [];
};

export const getPositions = async (status?: string): Promise<Position[]> => {
    const response = await api.get("/positions", { params: status ? { status } : undefined });
    return response.data.positions ?? [];
};

export const getPosition = async (uuid: string): Promise<Position> => {
    const response = await api.get(`/positions/${uuid}`);
    return response.data;
};

export const createPosition = async (payload: CreatePositionPayload): Promise<Position> => {
    const response = await api.post("/positions", payload);
    return response.data;
};

export const updatePosition = async (
    uuid: string,
    payload: UpdatePositionPayload,
): Promise<Position> => {
    const response = await api.patch(`/positions/${uuid}`, payload);
    return response.data;
};

export const archivePosition = async (uuid: string): Promise<Position> => {
    const response = await api.patch(`/positions/${uuid}/archive`);
    return response.data;
};

export const reactivatePosition = async (uuid: string): Promise<Position> => {
    const response = await api.patch(`/positions/${uuid}/reactivate`);
    return response.data;
};

export const attachPositionEmploymentCategory = async (
    uuid: string,
    payload: AttachEmploymentCategoryPayload,
): Promise<Position> => {
    const response = await api.post(`/positions/${uuid}/employment-categories`, payload);
    return response.data;
};

export const updatePositionEmploymentCategory = async (
    uuid: string,
    variantUuid: string,
    payload: AttachEmploymentCategoryPayload,
): Promise<Position> => {
    const response = await api.patch(
        `/positions/${uuid}/employment-categories/${variantUuid}`,
        payload,
    );
    return response.data;
};

export const detachPositionEmploymentCategory = async (
    uuid: string,
    variantUuid: string,
): Promise<Position> => {
    const response = await api.delete(`/positions/${uuid}/employment-categories/${variantUuid}`);
    return response.data;
};

export const attachPositionDeductionType = async (
    uuid: string,
    deductionTypeId: string,
): Promise<Position> => {
    const response = await api.post(`/positions/${uuid}/deduction-types`, {
        deduction_type_id: deductionTypeId,
    });
    return response.data;
};

export const detachPositionDeductionType = async (
    uuid: string,
    deductionTypeId: string,
): Promise<Position> => {
    const response = await api.delete(`/positions/${uuid}/deduction-types/${deductionTypeId}`);
    return response.data;
};

export interface UpsertAllowanceTemplatePayload {
    title: string;
    default_amount: string;
    description?: string;
    allowance_type_id?: string;
}

export const addPositionAllowanceTemplate = async (
    uuid: string,
    payload: UpsertAllowanceTemplatePayload,
): Promise<Position> => {
    const response = await api.post(`/positions/${uuid}/allowance-templates`, payload);
    return response.data;
};

export const updatePositionAllowanceTemplate = async (
    uuid: string,
    templateUuid: string,
    payload: UpsertAllowanceTemplatePayload,
): Promise<Position> => {
    const response = await api.patch(
        `/positions/${uuid}/allowance-templates/${templateUuid}`,
        payload,
    );
    return response.data;
};

export const removePositionAllowanceTemplate = async (
    uuid: string,
    templateUuid: string,
): Promise<Position> => {
    const response = await api.delete(`/positions/${uuid}/allowance-templates/${templateUuid}`);
    return response.data;
};
