import api from "./axios";

export type AnalyticsScopeMode = "GLOBAL" | "WORKING_LOCATION";

export interface AnalyticsScope {
  mode: AnalyticsScopeMode;
  can_select_working_location: boolean;
  requested_working_location_id: string | null;
  applied_working_location_id: string | null;
  was_overridden: boolean;
  label: string;
}

export interface AnalyticsOption {
  value: string;
  label: string;
}

export interface EmployeeAnalyticsFilters {
  from?: string;
  to?: string;
  working_location_id?: string;
  department_id?: string;
  position_id?: string;
  employment_category_id?: string;
  status?: string;
}

export interface PayrollAnalyticsFilters {
  from?: string;
  to?: string;
  working_location_id?: string;
  department_id?: string;
  position_id?: string;
  status?: string;
}

export interface EmployeeTrendPoint {
  period: string;
  label: string;
  total: number;
  active: number;
  added: number;
}

export interface PayrollTrendPoint {
  period: string;
  label: string;
  batch_count: number;
  employee_count: number;
  gross: number;
  net: number;
  tax: number;
  deductions: number;
  allowances: number;
}

export interface PayrollStatusPoint {
  status: string;
  label: string;
  count: number;
  gross: number;
  net: number;
}

export interface EmployeeDashboardAnalytics {
  scope: AnalyticsScope;
  applied_filters: EmployeeAnalyticsFilters & { interval: string };
  summary: {
    total_employees: number;
    active_employees: number;
    new_employees: number;
  };
  headcount_trend: EmployeeTrendPoint[];
  filters: {
    working_locations: AnalyticsOption[];
    departments: AnalyticsOption[];
    positions: AnalyticsOption[];
    employment_categories: AnalyticsOption[];
    statuses: AnalyticsOption[];
  };
}

export interface PayrollDashboardAnalytics {
  scope: AnalyticsScope;
  applied_filters: PayrollAnalyticsFilters & { interval: string };
  summary: {
    batch_count: number;
    total_gross: number;
    total_net: number;
    total_tax: number;
    pending_batches: number;
  };
  batch_trend: PayrollTrendPoint[];
  status_distribution: PayrollStatusPoint[];
  filters: {
    working_locations: AnalyticsOption[];
    departments: AnalyticsOption[];
    positions: AnalyticsOption[];
    statuses: AnalyticsOption[];
  };
}

function cleanParams<T extends object>(params?: T) {
  if (!params) return undefined;

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value && value !== "all"),
  );
}

export const getEmployeeDashboardAnalytics = async (
  filters?: EmployeeAnalyticsFilters,
): Promise<EmployeeDashboardAnalytics> => {
  const response = await api.get("/dashboard/analytics/employees", {
    params: cleanParams(filters),
  });
  return response.data;
};

export const getPayrollDashboardAnalytics = async (
  filters?: PayrollAnalyticsFilters,
): Promise<PayrollDashboardAnalytics> => {
  const response = await api.get("/dashboard/analytics/payroll", {
    params: cleanParams(filters),
  });
  return response.data;
};
