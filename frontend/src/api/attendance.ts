import api from "./axios";
import { getWorkingLocations } from "./working_locations";

export interface CreateTimeRecordPayload {
    employee_id: string;
    attendance_date: string;
    hours_worked?: number;
    overtime_hours?: number;
    attendance_status?: "PRESENT" | "ABSENT";
}

export interface UpdateTimeRecordPayload {
    hours_worked?: number;
    overtime_hours?: number;
    attendance_status?: "PRESENT" | "ABSENT";
}

export const createTimeRecord = async (payload: CreateTimeRecordPayload) => {
    const response = await api.post("/time-records", payload);
    return response.data;
};

export const updateTimeRecord = async (
    uuid: string,
    payload: UpdateTimeRecordPayload,
) => {
    const response = await api.patch(`/time-records/${uuid}/approve`, { Comment });
    return response.data;
};

export const getTimeRecords = async () => {
    const response = await api.get("/time-records");
    return response.data;
};

export const getTodayAttendance = async (
    getWorkingLocationId?: string,
    category?: string,
) => {
    const params = new URLSearchParams();
    if (getWorkingLocationId) params.append("working_location_id", getWorkingLocationId);
    if (category) params.append("category", category);
    const response = await api.get(`/time-records/today?${params.toString()}`);
    return response.data;
};

export const getAttendance = getTimeRecords;

export const getTimeRecordsByEmployee = async (employeeId: string) => {
    const response = await api.get(`time-records/employee/${employeeId}`);
    return response.data;
};

export interface BulkCreateTimeRecordsPayload {
    date_from: string;
    date_to: string;
    records: CreateTimeRecordPayload[];
}

export const bulkCreateTimeRecords = async (
    payloadOrRecords: any[] | BulkCreateTimeRecordsPayload,
    signal?: AbortSignal,
) => {
    if (Array.isArray(payloadOrRecords)) {
        const response = await api.post(
            "/time-records/batch-sync",
            { records: payloadOrRecords },
            { signal },
        );
        return response.data;
    } else {
        const response = await api.post("/time-records/bulk", payloadOrRecords, { signal, });
        return response.data;
    }
};
