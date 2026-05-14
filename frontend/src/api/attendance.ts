import api from "./axios";

export interface CreateTimeRecordPayload {
    employee_id: string;
    attendance_date: string;
    clock_in?: string;
    attendance_status?: "PRESENT" | "ABSENT";
}

export interface UpdateTimeRecordPayload {
    clock_out?: string;
    attendance_status?: "PRESENT" | "ABSENT";
}

export const createTimeRecord = async (payload: CreateTimeRecordPayload) => {
    const response = await api.post("/time-records", payload);
    return response.data;
};

export const clockOutTimeRecord = async (
    uuid: string,
    payload: UpdateTimeRecordPayload,
) => {
    const response = await api.patch(`/time-records/${uuid}/clock-out`, payload);
    return response.data;
};

export const approveTimeRecord = async (uuid: string, comment?: string) => {
    const response = await api.patch(`/time-records/${uuid}/approve`, { comment });
    return response.data;
};

export const getTimeRecordsByEmployee = async (employeeId: string) => {
    const response = await api.get(`/time-records/employee/${employeeId}`);
    return response.data;
};
