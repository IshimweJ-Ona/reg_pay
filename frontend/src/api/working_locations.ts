import api from "./axios";

export interface WorkingLocation {
    id: string;
    uuid: string;
    name: string;
    type: "HQ" | "BRANCH";
    address: string;
}

export interface Department {
    id: string;
    uuid: string;
    working_location_id: string;
    code: string;
    name: string;
    description?: string;
    status: "ACTIVE" | "INACTIVE";
}

export interface CreateWorkingLocationPayload {
    name: string;
    type: "HQ" | "BRANCH";
    address: string;
}

export interface CreateDepartmentPayload {
    working_location_id: string;
    code: string;
    name: string;
    description?: string;
}

export const getWorkingLocations = async (): Promise<any> => {
    const response = await api.get("/organization/working-locations");
    return response.data;
};

export const createWorkingLocation = async (payload: Partial<CreateWorkingLocationPayload> | any) => {
    const response = await api.post("/organization/working-locations", payload);
    return response.data;
};

export const updateWorkingLocation = async (
    uuid: string,
    payload: Partial<CreateWorkingLocationPayload>,
) => {
    const response = await api.patch(`/organization/working-locations/${uuid}`, payload);
    return response.data;
};

export const deleteWorkingLocation = async (uuid: string) => {
    const response = await api.patch(`/organization/working-locations/${uuid}/delete`);
    return response.data;
};

export const getDepartments = async (
    working_location_id?: string,
): Promise<any> => {
    const response = await api.get("/organization/departments", {
        params: { working_location_id },
    });
    return response.data;
};

export const createDepartment = async (payload: Partial<CreateDepartmentPayload> | any) => {
    const response = await api.post("/organization/departments", payload);
    return response.data;
};

export const updateDepartment = async (
    uuid: string,
    payload: Partial<CreateDepartmentPayload>,
) => {
    const response = await api.patch(`/organization/departments/${uuid}`, payload);
    return response.data;
};

export const deleteDepartment = async (uuid: string) => {
    const response = await api.patch(`/organization/departments/${uuid}/delete`);
    return response.data;
};

export const assignBranchManager = async (
    workingLocationUuid: string,
    user_id: string,
) => {
    const response = await api.patch(
        `/organization/working-locations/${workingLocationUuid}/manager`,
        { user_id },
    );
    return response.data;
};

export const assignDepartmentManager = async (
    departmentUuid: string,
    user_id: string,
) => {
    const response = await api.patch(
        `/organization/departments/${departmentUuid}/manager`,
        { user_id },
    );
    return response.data;
};
