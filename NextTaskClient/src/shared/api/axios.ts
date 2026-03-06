import axios from "axios";
import { useAuthStore } from "@entities/user";

/**
 * Общий экземпляр axios с базовым URL на FastAPI-сервер.
 * URL берётся из переменной окружения VITE_API_URL или по умолчанию http://localhost:8000
 */
const api = axios.create({
	baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
});

// Создаем interceptor для добавления токена в заголовки
api.interceptors.request.use(
	(config) => {
		const token = useAuthStore.getState().token;
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	},
);

// Interceptor для обработки ошибок, в частности 401 для авто-выхода
let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
	refreshQueue.push(cb);
}

function onRefreshed(token: string | null) {
	refreshQueue.forEach((cb) => cb(token));
	refreshQueue = [];
}

api.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;
		if (!error.response) return Promise.reject(error);

		// Игнорируем попытку логина
		if (originalRequest.url === "/auth/token") {
			return Promise.reject(error);
		}

		if (error.response.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true;

			if (isRefreshing) {
				// Ждем завершения текущего refresh
				return new Promise((resolve, reject) => {
					subscribeTokenRefresh((newToken) => {
						if (!newToken) {
							reject(error);
							return;
						}
						originalRequest.headers.Authorization = `Bearer ${newToken}`;
						resolve(api(originalRequest));
					});
				});
			}

			isRefreshing = true;
			try {
				const refresh = localStorage.getItem("refresh_token");
				if (!refresh) throw new Error("No refresh token");

				const resp = await fetch(
					(import.meta.env.VITE_API_URL ?? "http://localhost:8000") +
						"/auth/refresh",
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ refresh_token: refresh }),
					},
				);
				if (!resp.ok) throw new Error("Refresh failed");
				const data = await resp.json();
				const newAccess: string = data.access_token;
				const newRefresh: string | undefined = data.refresh_token;
				if (newRefresh)
					localStorage.setItem("refresh_token", newRefresh);
				useAuthStore.getState().login(newAccess);
				onRefreshed(newAccess);
				originalRequest.headers.Authorization = `Bearer ${newAccess}`;
				return api(originalRequest);
			} catch (e) {
				onRefreshed(null);
				localStorage.removeItem("refresh_token");
				useAuthStore.getState().logout();
				return Promise.reject(error);
			} finally {
				isRefreshing = false;
			}
		}
		return Promise.reject(error);
	},
);

export default api;
