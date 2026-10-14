import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the saved JWT to every API request.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("ace_bank_token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Handle expired or invalid sessions globally.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("ace_bank_token");

      window.dispatchEvent(new Event("ace-bank-unauthorized"));
    }

    return Promise.reject(error);
  }
);

export default api;