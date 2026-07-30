import api from "./axios";

export interface Role {
  id: string;
  uuid: string;
  name: string;
  description?: string;
  level_order?: number;
  is_system_role?: boolean;
  permission_keys: string[]; // ← keys from code constant, not DB IDs
  // null = global role (every branch); set = scoped to one branch only.
  working_location_id?: string | null;
  working_locations?: { uuid: string; name: string } | null;
}

export const getRoles = async (): Promise<Role[]> => {
  const response = await api.get("/roles");
  return response.data;
};

export const createRole = async (payload: {
  name: string;
  description?: string;
  permission_keys?: string[];
}): Promise<Role> => {
  const response = await api.post("/roles", payload);
  return response.data;
};

export const updateRole = async (
  id: string,
  payload: { name?: string; description?: string; permission_keys?: string[] },
): Promise<Role> => {
  const response = await api.patch(`/roles/${id}`, payload);
  return response.data;
};
