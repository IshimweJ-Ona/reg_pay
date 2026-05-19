
export type PayrollStatus = 
  | 'DRAFT' 
  | 'REVIEW' 
  | 'PENDING_APPROVAL' 
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED' 
  | 'REJECTED' 
  | 'PROCESSING' 
  | 'COMPLETED' 
  | 'FAILED';

export interface PayrollBatch {
  id: string;
  batchId: string;
  period: string;
  location: string;
  department: string;
  employeeCount: number;
  totalAmount: number;
  status: PayrollStatus;
  createdBy: string;
  createdAt: string;
  paymentDate: string;
  notes?: string;
}

export interface PayrollItem {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  baseSalary: number;
  overtime: number;
  bonus: number;
  allowances: number;
  deductions: number;
  tax: number;
  netSalary: number;
  status: 'PENDING' | 'PAID' | 'FAILED';
}

export interface ApprovalAction {
  id: string;
  user: string;
  action: 'CREATE' | 'REVIEW' | 'APPROVE' | 'REJECT';
  date: string;
  comment?: string;
}
