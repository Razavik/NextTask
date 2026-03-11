// Сервис для работы с чатом через WebSocket
import type { Message } from "@shared/types/message";

type GroupMessagePayload = {
	type?: "message" | "typing";
	content: string;
	attachments?: string[];
	reply_to_id?: number | null;
	temp_client_id?: string;
	is_typing?: boolean;
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

	private getWsBaseUrl() {
		const explicit = import.meta.env.VITE_WS_URL as string | undefined;
		if (explicit) {
			return explicit.replace(/\/$/, "");
		}

		const apiBase =
			(import.meta.env.VITE_API_URL as string | undefined) ??
			"http://localhost:8000";
		return apiBase.replace(/^http/, "ws").replace(/\/$/, "");
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
		const wsUrl = `${this.getWsBaseUrl()}/chat/ws?token=${fresh}`;
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
		const wsUrl = `${this.getWsBaseUrl()}/chat/ws/${chatId}?token=${fresh}`;
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
	sendMessage(payload: {
		type?: "message";
		receiver_id: number;
		content: string;
		attachments?: string[];
		reply_to_id?: number | null;
		temp_client_id?: string;
	}) {
		if (!this.wsPersonal || this.wsPersonal.readyState !== WebSocket.OPEN) {
			throw new Error(`WebSocket (personal) is not connected.`);
		}
		this.wsPersonal.send(
			JSON.stringify({
				type: "message",
				...payload,
			}),
		);
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
			this.wsGroup.send(
				JSON.stringify({
					type: "message",
					...payload,
				}),
			);
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
		this.groupSendQueue.push({
			type: "message",
			...payload,
		});
		if (this.lastToken) {
			this.connectToGroup(targetId, this.lastToken);
		}
	}

	sendTyping(receiverId: number, isTyping: boolean) {
		if (!this.wsPersonal || this.wsPersonal.readyState !== WebSocket.OPEN) {
			return;
		}
		this.wsPersonal.send(
			JSON.stringify({
				type: "typing",
				receiver_id: receiverId,
				is_typing: isTyping,
			}),
		);
	}

	requestPresenceSnapshot() {
		if (!this.wsPersonal || this.wsPersonal.readyState !== WebSocket.OPEN) {
			return;
		}
		this.wsPersonal.send(
			JSON.stringify({
				type: "presence_snapshot_request",
			}),
		);
	}

	sendGroupTyping(chatId: number, isTyping: boolean) {
		if (
			this.wsGroup &&
			this.wsGroup.readyState === WebSocket.OPEN &&
			this.currentGroupId === chatId
		) {
			this.wsGroup.send(
				JSON.stringify({
					type: "typing",
					chat_id: chatId,
					is_typing: isTyping,
				}),
			);
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
}

export const chatService = new ChatService();
