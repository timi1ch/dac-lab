const API_URL = "/api";

export const api = {
  request: async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("token");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Ошибка");
    return data;
  },
};