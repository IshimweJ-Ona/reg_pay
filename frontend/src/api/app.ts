import api from "./axios";

export const getBackendHello = async (): Promise<string> => {
    const response = await api.get<string>("/");
    return response.data;
};
