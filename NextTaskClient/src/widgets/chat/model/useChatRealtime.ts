import { useEffect, type MutableRefObject } from "react";
import { chatService, type ActiveChat } from "@entities/chat";
import type { Message } from "@shared/types/message";

interface UseChatRealtimeOptions {
	activeChat: ActiveChat | null;
	activeChatRef: MutableRefObject<ActiveChat | null>;
	isOpenRef: MutableRefObject<boolean>;
	currentUserId?: number;
	shouldAcceptMessage: (message: Message) => boolean;
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
	clearUnread: (contactId: string) => void;
	upsertAndTouchContact: (contact: {
		id: string;
		type: "personal" | "group";
		userId?: number;
		chatId?: number;
		name: string;
		avatar?: string;
	}) => void;
}

export const useChatRealtime = ({
	activeChat,
	activeChatRef,
	isOpenRef,
	currentUserId,
	shouldAcceptMessage,
	setMessages,
	clearUnread,
	upsertAndTouchContact,
}: UseChatRealtimeOptions) => {
	useEffect(() => {
		if (!activeChat) return;

		const token = localStorage.getItem("token") || "";
		chatService.connect(token);
		if (activeChat.type === "group" && activeChat.chatId) {
			chatService.connectToGroup(activeChat.chatId, token);
		}

		const handleNewMessage = (payload: unknown) => {
			try {
				const eventType =
					typeof payload === "object" && payload && "type" in payload
						? (payload as { type?: string }).type
						: "new_message";

				if (eventType === "message_delete") {
					const deletedId = (payload as { message_id: number })
						.message_id;
					setMessages((prev) =>
						prev.filter((m) => m.id !== deletedId),
					);
					return;
				}

				const msg =
					typeof payload === "object" &&
					payload &&
					"message" in payload
						? (payload as { message: Message }).message
						: (payload as Message);

				const currentActiveChat = activeChatRef.current;

				const belongsToActive = (() => {
					if (!currentActiveChat) return false;
					if (msg.chat_id != null) {
						return (
							currentActiveChat.type === "group" &&
							currentActiveChat.chatId === msg.chat_id
						);
					}
					if (
						currentActiveChat.type !== "personal" ||
						!currentActiveChat.userId ||
						!currentUserId
					)
						return false;
					const me = currentUserId;
					const peerId = currentActiveChat.userId;
					const a = msg.sender_id;
					const b = msg.receiver_id;
					return (
						(a === me && b === peerId) || (a === peerId && b === me)
					);
				})();

				if (msg.sender_id === currentUserId && !belongsToActive) {
					try {
						if (msg.chat_id != null) {
							upsertAndTouchContact({
								id: `chat-${msg.chat_id}`,
								type: "group",
								chatId: msg.chat_id,
								name:
									activeChatRef.current?.name ||
									`Групповой чат #${msg.chat_id}`,
								avatar: undefined,
							});
						} else {
							const otherId = msg.receiver_id;
							if (otherId) {
								upsertAndTouchContact({
									id: `user-${otherId}`,
									type: "personal",
									userId: otherId,
									name:
										msg.receiver?.name ||
										msg.receiver?.email ||
										`Пользователь #${otherId}`,
									avatar: msg.receiver?.avatar,
								});
							}
						}
					} catch {}
					return;
				}

				if (eventType === "message_update") {
					if (belongsToActive) {
						setMessages((prev) =>
							prev.map((m) =>
								m.id === msg.id ? { ...m, ...msg } : m,
							),
						);
					}
					return;
				}

				if (belongsToActive && shouldAcceptMessage(msg)) {
					setMessages((prev) => [...prev, msg]);
					const contactId =
						msg.chat_id != null
							? `chat-${msg.chat_id}`
							: `user-${
									msg.sender_id === currentUserId
										? msg.receiver_id
										: msg.sender_id
								}`;
					clearUnread(contactId);
				} else if (!belongsToActive && shouldAcceptMessage(msg)) {
					// Уведомления и unread для неактивных чатов обрабатываются глобально в useChatNotifications
				}

				try {
					if (msg.chat_id != null) {
						upsertAndTouchContact({
							id: `chat-${msg.chat_id}`,
							type: "group",
							chatId: msg.chat_id,
							name:
								currentActiveChat?.name ||
								`Групповой чат #${msg.chat_id}`,
							avatar: undefined,
						});
					} else {
						const selfId = currentUserId;
						const otherId =
							msg.sender_id === selfId
								? msg.receiver_id!
								: msg.sender_id;
						const otherInfo =
							msg.sender_id === selfId
								? msg.receiver
								: msg.sender;
						upsertAndTouchContact({
							id: `user-${otherId}`,
							type: "personal",
							userId: otherId,
							name:
								otherInfo?.name ||
								otherInfo?.email ||
								currentActiveChat?.name ||
								`Пользователь #${otherId}`,
							avatar: otherInfo?.avatar,
						});
					}
				} catch {
					// no-op
				}
			} catch {
				// no-op
			}
		};

		const unsubscribe = chatService.onMessage(handleNewMessage);

		return () => {
			unsubscribe();
		};
	}, [
		activeChat,
		activeChatRef,
		clearUnread,
		currentUserId,
		isOpenRef,
		setMessages,
		shouldAcceptMessage,
		upsertAndTouchContact,
	]);
};
