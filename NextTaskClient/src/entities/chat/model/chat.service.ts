// Сервис для работы с чатом через REST API и WebSocket
import api from "@shared/api/axios";
import type { Message, MessageCreate } from "@shared/types/message";
import type { ChatContact } from "./chatStore";

type GroupMessagePayload = {
	content: string;
	attachments?: string[];
	reply_to_id?: number | null;
	[type: string]: unknown;
};

class ChatService {
	private wsPersonal: WebSocket | null = null;
	private wsGroup: WebSocket | null = null;
	private messageHandlers: Set<(message: unknown) => void> = new Set();
	private reconnectPersonalTimeout: NodeJS.Timeout | null = null;
	private reconnectGroupTimeout: NodeJS.Timeout | null = null;
	private reconnectPersonalAttempts = 0;
	private reconnectGroupAttempts = 0;
	private maxReconnectAttempts = 5;
	private currentGroupId: number | null = null;
	private lastToken: string | null = null;
	private groupSendQueue: GroupMessagePayload[] = [];

	/**
	 * Отправить личное сообщение (REST)
	 */
	async sendPersonalMessage(payload: MessageCreate): Promise<Message> {
		const { data } = await api.post<Message>("/chat/messages", payload);
		return data;
	}

	private async refreshTokenWS(): Promise<string> {
		const refresh = localStorage.getItem("refresh_token");
		if (!refresh) throw new Error("No refresh token");
		const base = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
		const resp = await fetch(`${base}/auth/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refresh_token: refresh }),
		});
		if (!resp.ok) throw new Error("Refresh failed");
		const data = await resp.json();
		const access: string = data.access_token;
		const newRefresh: string | undefined = data.refresh_token;
		localStorage.setItem("token", access);
		if (newRefresh) localStorage.setItem("refresh_token", newRefresh);
		return access;
	}

	private getToken(): string | null {
		return localStorage.getItem("token") || this.lastToken;
	}

	/**
	 * Подключиться к WebSocket (личный чат)
	 */
	connect(token?: string) {
		const fresh = token || this.getToken();
		if (!fresh) return;
		this.lastToken = fresh;
		// Персональный канал держим постоянно
		if (this.wsPersonal?.readyState === WebSocket.OPEN) return;
		const wsUrl = `ws://127.0.0.1:8000/chat/ws?token=${fresh}`;
		this.wsPersonal = new WebSocket(wsUrl);
		this.wsPersonal.onopen = () => {
			this.reconnectPersonalAttempts = 0;
		};
		this.wsPersonal.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data);
				this.messageHandlers.forEach((handler) => handler(message));
			} catch (error) {
				console.error("Failed to parse WebSocket message:", error);
			}
		};
		this.wsPersonal.onerror = (error) => {
			console.error("WebSocket error (personal):", error);
		};
		this.wsPersonal.onclose = async (ev) => {
			// Если политика/401 — пробуем refresh токена и переподключаемся
			if (ev.code === 1008 || ev.code === 4401) {
				try {
					const newAccess = await this.refreshTokenWS();
					this.lastToken = newAccess;
					this.attemptReconnectPersonal(newAccess);
					return;
				} catch {}
			}
			this.attemptReconnectPersonal(this.lastToken || fresh);
		};
	}

	/**
	 * Попытка переподключения
	 */
	private attemptReconnectPersonal(token?: string) {
		if (this.reconnectPersonalAttempts >= this.maxReconnectAttempts) return;
		this.reconnectPersonalAttempts++;
		const delay = Math.min(
			1000 * Math.pow(2, this.reconnectPersonalAttempts),
			30000,
		);
		this.reconnectPersonalTimeout = setTimeout(
			() => this.connect(token),
			delay,
		);
	}

	/**
	 * Отключиться от WebSocket
	 */
	disconnect() {
		// Полное отключение (если нужно)
		if (this.reconnectPersonalTimeout) {
			clearTimeout(this.reconnectPersonalTimeout);
			this.reconnectPersonalTimeout = null;
		}
		if (this.reconnectGroupTimeout) {
			clearTimeout(this.reconnectGroupTimeout);
			this.reconnectGroupTimeout = null;
		}
		if (this.wsPersonal) {
			this.wsPersonal.close();
			this.wsPersonal = null;
		}
		if (this.wsGroup) {
			this.wsGroup.close();
			this.wsGroup = null;
		}
		// Не очищаем handlers, подписчики остаются
	}

	/**
	 * Подключиться к групповому чату
	 */
	connectToGroup(chatId: number, token?: string) {
		const fresh = token || this.getToken();
		if (!fresh) return;
		this.lastToken = fresh;

		// Если уже подключены к другому чату — закрываем старый сокет
		if (
			this.wsGroup &&
			this.currentGroupId !== null &&
			this.currentGroupId !== chatId
		) {
			try {
				this.wsGroup.close();
			} catch {}
			this.wsGroup = null;
		}

		// Если уже есть активное подключение к нужному чату — ничего не делаем
		if (
			this.wsGroup?.readyState === WebSocket.OPEN &&
			this.currentGroupId === chatId
		) {
			return;
		}

		this.currentGroupId = chatId;
		// Обратите внимание на URL - он должен соответствовать бекенду
		const wsUrl = `ws://127.0.0.1:8000/chat/ws/${chatId}?token=${fresh}`;
		const socket = new WebSocket(wsUrl);
		this.wsGroup = socket;

		socket.onopen = () => {
			this.reconnectGroupAttempts = 0;
			// отправляем накопленные сообщения
			const queued = [...this.groupSendQueue];
			this.groupSendQueue.length = 0;
			for (const payload of queued) {
				try {
					socket.send(JSON.stringify(payload));
				} catch {}
			}
		};
		socket.onmessage = (event) => {
			try {
				const message: Message = JSON.parse(event.data);
				this.messageHandlers.forEach((handler) => handler(message));
			} catch (error) {
				console.error("Failed to parse WebSocket message:", error);
			}
		};
		socket.onerror = (error) => {
			console.error("WebSocket error (group):", error);
		};
		socket.onclose = async (ev) => {
			// Если пользователь уже переключился на другой чат, не реконнектим старый сокет
			if (this.currentGroupId !== chatId) {
				return;
			}
			if (ev.code === 1008 || ev.code === 4401) {
				try {
					const newAccess = await this.refreshTokenWS();
					this.lastToken = newAccess;
					this.attemptReconnectGroup(chatId, newAccess);
					return;
				} catch {}
			}
			this.attemptReconnectGroup(chatId, this.lastToken || fresh);
		};
	}

	/**
	 * Попытка переподключения к групповому чату
	 */
	private attemptReconnectGroup(chatId: number, token?: string) {
		if (this.reconnectGroupAttempts >= this.maxReconnectAttempts) return;
		this.reconnectGroupAttempts++;
		const delay = Math.min(
			1000 * Math.pow(2, this.reconnectGroupAttempts),
			30000,
		);
		this.reconnectGroupTimeout = setTimeout(() => {
			if (this.currentGroupId !== chatId) return;
			this.connectToGroup(chatId, token);
		}, delay);
	}

	/**
	 * Отправить сообщение через WebSocket
	 */
	sendMessage(receiverId: number, content: string) {
		if (!this.wsPersonal || this.wsPersonal.readyState !== WebSocket.OPEN) {
			throw new Error(`WebSocket (personal) is not connected.`);
		}
		const payload = { receiver_id: receiverId, content };
		this.wsPersonal.send(JSON.stringify(payload));
	}

	/**
	 * Отправить сообщение в групповой чат
	 */
	sendGroupMessage(payload: GroupMessagePayload, chatId?: number) {
		const targetId = chatId ?? this.currentGroupId ?? null;
		if (!targetId) {
			throw new Error("chatId is not defined for group message");
		}

		if (
			this.wsGroup &&
			this.wsGroup.readyState === WebSocket.OPEN &&
			this.currentGroupId === targetId
		) {
			this.wsGroup.send(JSON.stringify(payload));
			return;
		}

		if (
			this.wsGroup &&
			this.currentGroupId !== null &&
			this.currentGroupId !== targetId
		) {
			try {
				this.wsGroup.close();
			} catch {}
			this.wsGroup = null;
		}

		this.currentGroupId = targetId;
		this.groupSendQueue.push(payload);
		if (this.lastToken) {
			this.connectToGroup(targetId, this.lastToken);
		}
	}

	/**
	 * Подписаться на новые сообщения
	 */
	onMessage(handler: (message: unknown) => void) {
		this.messageHandlers.add(handler);

		// Возвращаем функцию отписки
		return () => {
			this.messageHandlers.delete(handler);
		};
	}

	/**
	 * Получить историю сообщений с пользователем
	 */
	async getHistory(
		userId: number,
		limit = 50,
		offset = 0,
	): Promise<Message[]> {
		const { data } = await api.get<Message[]>(`/chat/messages/${userId}`, {
			params: { limit, offset },
		});
		return data;
	}

	/**
	 * Отметить сообщение как прочитанное
	 */
	async markAsRead(messageId: number): Promise<Message> {
		const { data } = await api.patch<Message>(
			`/chat/messages/${messageId}/read`,
		);
		return data;
	}

	/**
	 * Получить количество непрочитанных сообщений
	 */
	async getUnreadCount(): Promise<number> {
		const { data } = await api.get<number>("/chat/unread-count");
		return data;
	}

	/**
	 * Редактировать личное сообщение
	 */
	async updateMessage(
		messageId: number,
		content?: string,
		attachments?: string[],
		is_pinned?: boolean,
	): Promise<Message> {
		const { data } = await api.put<Message>(`/chat/messages/${messageId}`, {
			content,
			attachments,
			is_pinned,
		});
		return data;
	}

	/**
	 * Редактировать групповое сообщение
	 */
	async updateGroupMessage(
		messageId: number,
		content?: string,
		attachments?: string[],
		is_pinned?: boolean,
	): Promise<Message> {
		const { data } = await api.put<Message>(
			`/chat/workspace-chat/messages/${messageId}`, // эндпоинт на беке остался такой пока что (псевдоним) или нужно обновить
			{
				content,
				attachments,
				is_pinned,
			},
		);
		return data;
	}

	/**
	 * Удалить личное сообщение
	 */
	async deleteMessage(messageId: number): Promise<void> {
		await api.delete(`/chat/messages/${messageId}`);
	}

	/**
	 * Удалить групповое сообщение
	 */
	async deleteGroupMessage(messageId: number): Promise<void> {
		await api.delete(`/chat/workspace-chat/messages/${messageId}`); // аналогично
	}

	/**
	 * Загрузить файл
	 */
	async uploadFile(formData: FormData): Promise<{ url: string }> {
		const { data } = await api.post<{ url: string }>(
			"/chat/upload",
			formData,
			{
				headers: {
					"Content-Type": "multipart/form-data",
				},
			},
		);
		return data;
	}

	/**
	 * Получить историю группового чата
	 */
	async getGroupHistory(
		chatId: number,
		limit = 50,
		offset = 0,
	): Promise<Message[]> {
		const { data } = await api.get<Message[]>(
			`/chat/messages/workspace/${chatId}`, // алиас
			{
				params: { limit, offset },
			},
		);
		return data;
	}

	/**
	 * Получить недавние чаты
	 */
	async getRecent(): Promise<ChatContact[]> {
		const { data } = await api.get<ChatContact[]>("/chat/recent");
		return data;
	}

	/**
	 * Получить все чаты пользователя
	 */
	async getAll(): Promise<ChatContact[]> {
		const { data } = await api.get<ChatContact[]>("/chat/all");
		return data;
	}
}

export const chatService = new ChatService();
