import axios from "axios";

let envUrl = (import.meta.env.VITE_API_URL || "").trim();
if (envUrl && !envUrl.startsWith("http://") && !envUrl.startsWith("https://")) {
    envUrl = `https://${envUrl}`;
}

const getBaseUrl = (): string => {
    const customUrl = localStorage.getItem("API_URL");
    if (customUrl && customUrl.trim()) {
        let clean = customUrl.trim();
        return clean.startsWith("http") ? clean : `https://${clean}`;
    }
    return envUrl || "http://localhost:8000";
};

export const api = axios.create({
    baseURL: getBaseUrl(),
    headers: {
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(
    (config) => {
        config.baseURL = getBaseUrl();
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// TODO: RESTORE AUTHENTICATION BEFORE PRODUCTION
// In demo mode, token is optional; if present in localStorage, it will be attached.
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// TODO: RESTORE AUTHENTICATION BEFORE PRODUCTION
// 401 errors pass through without forcing /login redirects in unauthenticated demo mode.
api.interceptors.response.use(
    (response) => response,
    (error) => Promise.reject(error)
);
