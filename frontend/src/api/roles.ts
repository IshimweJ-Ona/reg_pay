import api from "./axios";

export interface Role {
  id: string;
  uuid: string;
  name: string;
  description?: string;
}

export const getRoles = async (): Promise<Role[]> => {
  const response = await api.get("/roles");
  return response.data;
};
