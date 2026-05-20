import api from "./axios";

export interface Notification {
  id: string;
  uuid: string;
  title: string;
  message: string;
  type: string;
  reference_id?: string;
  is_read: boolean;
  created_at: string;
  user?: {
    uuid: string;
    first_name: string;
    last_name: string;
    email: string;
    phone_number: string;
    working_location?: { name: string };
    department?: { name: string };
  };
}

export const getNotifications = async (): Promise<Notification[]> => {
  const response = await api.get("/notifications");
  return response.data;
};

export const getUnreadCount = async (): Promise<number> => {
  const response = await api.get("/notifications/unread-count");
  return response.data;
};

export const markAsRead = async (uuid: string) => {
  const response = await api.patch(`/notifications/${uuid}/read`);
  return response.data;
};

export const markAllAsRead = async () => {
  const response = await api.patch("/notifications/read-all");
  return response.data;
};
