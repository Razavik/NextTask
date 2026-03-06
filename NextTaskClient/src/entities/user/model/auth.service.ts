import api from "@shared/api/axios";
import { useChatStore } from "@entities/chat/model/chatStore";
import { useAuthStore, type User } from "./authStore";

interface LoginRequest {
	email: string;
	password: string;
}

interface RegisterRequest {
	name: string;
	email: string;
	password: string;
}

interface TokenResponse {
	access_token: string;
	refresh_token?: string;
}

class AuthService {
	/**
	 * Выполняет запрос на аутентификацию и сохраняет токен в store
	 */
	async login(data: LoginRequest): Promise<User> {
		try {
			// FastAPI OAuth2PasswordRequestForm ожидает данные в формате x-www-form-urlencoded
			const formData = new URLSearchParams();
			formData.append("username", data.email);
			formData.append("password", data.password);

			const response = await api.post<TokenResponse>(
				"/auth/token",
				formData,
				{
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
				},
			);
			const token = response.data.access_token;
			const refresh = response.data.refresh_token;

			// Сохраняем токен в store
			useAuthStore.getState().login(token);
			if (refresh) {
				localStorage.setItem("refresh_token", refresh);
			}

			// Получаем информацию о пользователе
			const userInfo = await this.getCurrentUser();
			return userInfo;
		} catch (error) {
			console.error("Ошибка авторизации:", error);
			const msg =
				error instanceof Error ? error.message : "Ошибка авторизации";
			throw new Error(msg);
		}
	}

	/**
	 * Выполняет запрос на регистрацию и сохраняет токен в store
	 */
	async register(data: RegisterRequest): Promise<User> {
		try {
			// Сначала регистрируем пользователя
			await api.post<User>("/auth/register", data);

			// Затем логинимся, чтобы получить токен
			const loginData: LoginRequest = {
				email: data.email,
				password: data.password,
			};
			const userInfo = await this.login(loginData);

			return userInfo;
		} catch (error) {
			console.error("Ошибка регистрации:", error);
			const msg =
				error instanceof Error ? error.message : "Ошибка регистрации";
			throw new Error(msg);
		}
	}

	/**
	 * Получает информацию о текущем пользователе
	 */
	async getCurrentUser(): Promise<User> {
		try {
			const response = await api.get<User>("/auth/users/me");
			useAuthStore.getState().setUser(response.data);
			return response.data;
		} catch (error) {
			console.error("Ошибка получения данных пользователя:", error);
			const msg =
				error instanceof Error
					? error.message
					: "Ошибка получения данных пользователя";
			throw new Error(msg);
		}
	}
	/**
	 * Выход пользователя из системы
	 */
	async logout(): Promise<void> {
		// На бэкенде нет эндпоинта /logout, выход реализован на клиенте
		try {
			useChatStore.getState().reset();
		} catch {}
		useAuthStore.getState().logout();
		localStorage.removeItem("refresh_token");
		return Promise.resolve();
	}
}

// Создаем экземпляр сервиса для использования в приложении
export const authService = new AuthService();
