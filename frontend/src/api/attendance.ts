import api from "./axios";

export interface CreateTimeRecordPayload {
    employee_id: string;
    attendance_date: string;
    overtime_hours?: number;
    attendance_status?: "PRESENT" | "ABSENT";
}

export interface UpdateTimeRecordPayload {
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
    payload: BulkCreateTimeRecordsPayload,
    signal?: AbortSignal,
) => {
    const response = await api.post("/time-records/bulk", payload, { signal });
    return response.data;
};
