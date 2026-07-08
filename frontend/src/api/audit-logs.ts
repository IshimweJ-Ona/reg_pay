import api from './axios';

export interface AuditLogEntry {
  id: string;
  user_id: string;
  employee_id?: string | null;
  entity_table: string;
  entity_id: string;
  module_name: string;
  activity_type: string;
  activity_description: string;
  action: string;
  old_values?: Record<string, any> | null;
  new_values?: Record<string, any> | null;
  changed_fields?: any;
  ip_address?: string | null;
  created_at: string;
  user: {
    id: string;
    uuid: string;
    first_name: string;
    last_name: string;
    email: string;
    name: string;
    working_location?: { id: string; name: string } | null;
    department?: { id: string; name: string } | null;
    roles?: string[];
  };
  employee?: {
    id: string;
    uuid: string;
    first_name: string;
    last_name: string;
    name: string;
    national_id?: string | null;
    working_location?: { id: string; name: string } | null;
    department?: { id: string; name: string } | null;
  } | null;
}

export const getAuditLogs = async (limit = 100): Promise<AuditLogEntry[]> => {
  const response = await api.get('/audit-logs', { params: { limit } });
  return response.data;
};