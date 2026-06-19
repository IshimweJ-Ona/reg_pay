import api from "./axios";

export interface Role {
  id: string;
  uuid: string;
  name: string;
  description?: string;
  is_system_role?: boolean;
  role_permissions?: {
    id: string;
    role_id: string;
    permission_id: string;
    permission: {
      id: string;
      uuid: string;
      name: string;
      module_name: string;
      permission_key: string;
    };
  }[];
}

export const getRoles = async (): Promise<Role[]> => {
  const response = await api.get("/roles");
  return response.data;
};

export const createRole = async (payload: {
  name: string;
  description?: string;
  permission_ids?: string[];
}): Promise<Role> => {
  const response = await api.post("/roles", payload);
  return response.data;
};

export const updateRole = async (
  id: string,
  payload: { name?: string; description?: string; permission_ids?: string[] },
): Promise<Role> => {
  const response = await api.patch(`/roles/${id}`, payload);
  return response.data;
};
