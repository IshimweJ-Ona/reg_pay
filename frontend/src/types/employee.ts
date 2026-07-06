export interface Employee {
  id: string;
  uuid: string;
  bigIntId?: string;
  employeeId: string;
  fullName: string;
  department: string;
  location: string;
  salary: number;
  status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'PENDING' | 'REJECTED';
  attendanceRate: number;
  lastAttendanceDate?: string;
  lastAttendanceStatus?: 'PRESENT' | 'ABSENT';
  employmentCategory?: string;
  email: string;
  avatar?: string;
  avatar_url?: string;
  phone_number?: string;
  national_id?: string;
  gender?: 'MALE' | 'FEMALE';
  department_id?: string;
  working_location_id?: string;
  employment_category_id?: string;
  contract_start_date?: string;
  contract_end_date?: string;
}
