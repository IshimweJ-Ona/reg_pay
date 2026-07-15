import api from "./axios";

export interface IkiminaMembership {
  id: string;
  uuid: string;
  employee_id: string;
  monthly_amount: number;
  is_active: boolean;
  joined_at: string;
  created_by: string;
  total_savings?: number;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    phone_number?: string;
    department?: {
      id: string;
      name: string;
    };
  };
  contributions?: Array<{
    id: string;
    uuid: string;
    employee_id: string;
    membership_id: string;
    payroll_batch_id?: string;
    amount: number;
    contribution_date: string;
    created_at: string;
  }>;
}

export const getIkiminaMemberships = async (): Promise<IkiminaMembership[]> => {
  const response = await api.get("/ikimina/memberships");
  return response.data;
};

export const createIkiminaMembership = async (payload: {
  employee_id: string;
  monthly_amount: number;
  is_active?: boolean;
}): Promise<IkiminaMembership> => {
  const response = await api.post("/ikimina/memberships", payload);
  return response.data;
};

export const updateIkiminaMembership = async (
  uuid: string,
  payload: {
    monthly_amount?: number;
    is_active?: boolean;
  }
): Promise<IkiminaMembership> => {
  const response = await api.patch(`/ikimina/memberships/${uuid}`, payload);
  return response.data;
};

export const getIkiminaMembershipByEmployee = async (
  employeeId: string
): Promise<IkiminaMembership> => {
  const response = await api.get(`/ikimina/memberships/employee/${employeeId}`);
  return response.data;
};
