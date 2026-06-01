
export interface Employee {
  id: string;
  bigIntId?: string;
  employeeId: string;
  fullName: string;
  department: string;
  location: string;
  salary: number;
  status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'PENDING' | 'REJECTED';
  attendanceRate: number;
  email: string;
  avatar?: string;
  phone_number?: string;
  national_id?: string;
  gender?: 'MALE' | 'FEMALE';
  department_id?: string;
  working_location_id?: string;
  employment_category_id?: string;
}
