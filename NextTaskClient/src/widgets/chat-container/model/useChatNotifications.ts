import { useEffect } from "react";
import { chatService, type ActiveChat, type ChatContact } from "@entities/chat";
import type { Message } from "@shared/types/message";
import { createMessageToast } from "@shared/model/toastStore";

interface UseChatNotificationsOptions {
	authToken: string | null;
	isAuthPage: boolean;
	activeChat: ActiveChat | null;
	contacts: ChatContact[];
	currentUserId?: number;
	isOpen: boolean;
	incrementUnread: (contactId: string) => void;
	clearUnread: (contactId: string) => void;
	setActiveChat: (contactId: string) => void;
	openWindow: () => void;
	upsertAndTouchContact: (contact: ChatContact) => void;
	addToast: (toast: ReturnType<typeof createMessageToast>) => void;
}

export const useChatNotifications = ({
	authToken,
	isAuthPage,
	activeChat,
	contacts,
	currentUserId,
	isOpen,
	incrementUnread,
	clearUnread,
	setActiveChat,
	openWindow,
	upsertAndTouchContact,
	addToast,
}: UseChatNotificationsOptions) => {
	useEffect(() => {
		const token = localStorage.getItem("token") || "";

		// Если не авторизованы или на страницах аутентификации — гарантированно отключаем WS и не подписываемся
		if (!token || !authToken || isAuthPage) {
			try {
				chatService.disconnect();
			} catch {}
			return;
		}

		chatService.connect(token);

		// Дедупл. тостов на уровне контейнера (короткое окно)
		const recentRef = new Map<string, number>();
		const TTL = 4000;
		const makeKey = (m: Message) =>
			m.chat_id
				? `chat|${m.chat_id}|${m.sender_id}|${m.content}`
				: `pm|${m.sender_id}|${m.receiver_id}|${m.content}`;

		const off = chatService.onMessage((msg) => {
			const eventType =
				typeof msg === "object" && msg && "type" in msg
					? (msg as { type?: string }).type
					: "new_message";

			if (eventType && eventType !== "new_message") {
				return;
			}

			const now = Date.now();
			for (const [k, ts] of Array.from(recentRef.entries())) {
				if (now - ts > TTL) recentRef.delete(k);
			}
			const messagePayload =
				typeof msg === "object" && msg && "message" in msg
					? (msg as { message: Message }).message
					: (msg as Message);

			if (messagePayload.sender_id === currentUserId) {
				return;
			}

			const k = makeKey(messagePayload);
			const ts = recentRef.get(k);
			if (ts && now - ts <= TTL) return;
			recentRef.set(k, now);

			let contactId = "";
			let senderName = "";
			let senderAvatar: string | undefined;
			let messageText = "";

			const m = messagePayload;

			if (m.chat_id) {
				// Групповой чат
				contactId = `chat-${m.chat_id}`;
				senderName =
					m.sender?.name || m.sender?.email || "Пользователь";
				senderAvatar = m.sender?.avatar;
				messageText = m.content || "";
			} else {
				// Личный чат
				contactId = `user-${m.sender_id === currentUserId ? m.receiver_id : m.sender_id}`;
				senderName =
					m.sender?.name || m.sender?.email || "Пользователь";
				senderAvatar = m.sender?.avatar;
				messageText = m.content || "";
			}

			// Если нет текста и нет вложений, пропускаем (чтобы избежать ошибки length of undefined)
			if (!messageText && !messagePayload.attachments?.length) {
				return;
			}

			const belongsToActive =
				!!activeChat && activeChat.contactId === contactId;

			// Двигаем контакт вверх без некорректного переименования
			if (m.chat_id) {
				// Групповой чат - ищем существующий контакт или создаем базовый
				const existing = contacts.find((c) => c.id === contactId);
				upsertAndTouchContact({
					id: contactId,
					type: "group",
					chatId: m.chat_id,
					name: existing?.name || "Групповой чат",
					avatar: existing?.avatar,
				});
			} else {
				// Личный чат
				const otherId =
					m.sender_id === currentUserId ? m.receiver_id : m.sender_id;
				const otherInfo =
					m.sender_id === currentUserId ? m.receiver : m.sender;

				if (otherId) {
					upsertAndTouchContact({
						id: `user-${otherId}`,
						type: "personal",
						userId: otherId,
						name: String(
							otherInfo?.name ||
								otherInfo?.email ||
								"Пользователь",
						),
						avatar: otherInfo?.avatar,
					});
				}
			}

			if (belongsToActive && isOpen) {
				clearUnread(contactId);
				return;
			}

			incrementUnread(contactId);
			addToast(
				createMessageToast(
					senderName,
					messageText.length > 80
						? messageText.slice(0, 80) + "…"
						: messageText,
					senderAvatar,
					() => {
						setActiveChat(contactId);
						openWindow();
					},
				),
			);
		});

		return () => {
			off?.();
		};
	}, [
		activeChat,
		addToast,
		authToken,
		clearUnread,
		contacts,
		currentUserId,
		incrementUnread,
		isAuthPage,
		isOpen,
		openWindow,
		setActiveChat,
		upsertAndTouchContact,
	]);
};
