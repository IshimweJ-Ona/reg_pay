export interface Employee {
  id: string;
  uuid: string;
  bigIntId?: string;
  employeeId: string;
  fullName: string;
  department: string;
  location: string;
  salary: number;
  status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'PENDING' | 'REJECTED' | 'PAUSED';
  attendanceRate: number;
  lastAttendanceDate?: string;
  lastAttendanceStatus?: 'PRESENT' | 'ABSENT';
  position?: string;
  employment_category?: string;
  employment_category_id?: string;
  email: string;
  avatar?: string;
  avatar_url?: string;
  avatar_public_id?: string;
  phone_number?: string;
  national_id?: string;
  gender?: 'MALE' | 'FEMALE';
  department_id?: string;
  working_location_id?: string;
  position_id?: string;
  contract_start_date?: string;
  contract_end_date?: string;
  pause_reason?: string;
  activeTaxIds?: string[];
  activeTaxes?: {
    deduction_type_id: string;
    name: string;
    rate?: number;
  }[];
}
