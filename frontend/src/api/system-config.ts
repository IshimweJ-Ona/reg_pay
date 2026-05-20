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
