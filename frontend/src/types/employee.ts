
export interface Employee {
  id: string;
  employeeId: string;
  fullName: string;
  department: string;
  location: string;
  salary: number;
  status: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
  attendanceRate: number;
  email: string;
  avatar?: string;
}
