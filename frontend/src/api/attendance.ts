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

export const getTimeRecords = async () => {
    const response = await api.get("/time-records");
    return response.data;
};

export const getAttendance = getTimeRecords;

export const createAttendance = async (payload: any) => {
    return createTimeRecord({
        employee_id: payload.employee_id ?? payload.employee_uuid,
        attendance_date: payload.attendance_date ?? payload.date,
        attendance_status: payload.attendance_status ?? payload.status,
        clock_in: payload.clock_in,
    });
};

export const updateAttendance = async (uuid: string, payload: any) => {
    return clockOutTimeRecord(uuid, {
        clock_out: payload.clock_out,
        attendance_status: payload.attendance_status ?? payload.status,
    });
};

export const getTimeRecordsByEmployee = async (employeeId: string) => {
    const response = await api.get(`/time-records/employee/${employeeId}`);
    return response.data;
};
