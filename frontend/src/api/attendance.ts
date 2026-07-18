import api from "./axios";
import { getWorkingLocations } from "./working_locations";

export interface CreateTimeRecordPayload {
    employee_id: string;
    attendance_date: string;
    hours_worked?: number;
    attendance_status?: "PRESENT" | "ABSENT";
}

export interface UpdateTimeRecordPayload {
    hours_worked?: number;
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
    const response = await api.patch(`/time-records/${uuid}`, payload);
    return response.data;
};

export interface TimeRecordFilters {
    start_date?: string;
    end_date?: string;
    working_location_id?: string;
    employee_id?: string;
}

export const getTimeRecords = async (filters?: TimeRecordFilters) => {
    const params = new URLSearchParams();
    if (filters?.start_date) params.append("start_date", filters.start_date);
    if (filters?.end_date) params.append("end_date", filters.end_date);
    if (filters?.working_location_id) params.append("working_location_id", filters.working_location_id);
    if (filters?.employee_id) params.append("employee_id", filters.employee_id);
    const qs = params.toString();
    const response = await api.get(`/time-records${qs ? `?${qs}` : ""}`);
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

export const getTimeRecordsByEmployee = async (
    employeeId: string,
    filters?: { start_date?: string; end_date?: string },
) => {
    const params = new URLSearchParams();
    if (filters?.start_date) params.append("start_date", filters.start_date);
    if (filters?.end_date) params.append("end_date", filters.end_date);
    const qs = params.toString();
    const response = await api.get(`time-records/employee/${employeeId}${qs ? `?${qs}` : ""}`);
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
