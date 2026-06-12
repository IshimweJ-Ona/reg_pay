import axiosInstance from './axios';

export interface SystemConfig {
  uuid: string;
  key: string;
  value: string;
  description?: string;
}

export const getSystemConfigs = async (): Promise<SystemConfig[]> => {
  const response = await axiosInstance.get('/system-config');
  return response.data;
};

export const updateSystemConfig = async (key: string, value: string, description?: string): Promise<SystemConfig> => {
  const response = await axiosInstance.post('/system-config', { key, value, description });
  return response.data;
};

export const updateBatchSystemConfigs = async (configs: { key: string; value: string; description?: string }[]): Promise<SystemConfig[]> => {
  const response = await axiosInstance.patch('/system-config/batch', { configs });
  return response.data;
};

export interface MonthlyTax {
  uuid: string;
  name: string;
  rate: number;
  effective_from: string;
  is_active: boolean;
}

export const getMonthlyTaxes = async (): Promise<MonthlyTax[]> => {
  const response = await axiosInstance.get('/system-config/monthly-taxes/all');
  return response.data;
};

export const updateMonthlyTax = async (name: string, rate: number): Promise<MonthlyTax> => {
  const response = await axiosInstance.post('/system-config/monthly-taxes', { name, rate });
  return response.data;
};

export const deactivateMonthlyTax = async (uuid: string): Promise<MonthlyTax> => {
  const response = await axiosInstance.patch(`/system-config/monthly-taxes/${uuid}/deactivate`);
  return response.data;
};
