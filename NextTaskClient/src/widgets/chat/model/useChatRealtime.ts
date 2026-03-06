import { useEffect, type MutableRefObject } from "react";
import { chatService, type ActiveChat } from "@entities/chat";
import type { Message } from "@shared/types/message";
import { createMessageToast } from "@shared/model/toastStore";

type ChatSocketPayload =
	| { type?: "new_message" | "message_update"; message: Message }
	| { type?: "message_delete"; message_id: number; chat_id?: number | null }
	| Message;

interface UseChatRealtimeOptions {
	activeChat: ActiveChat | null;
	activeChatRef: MutableRefObject<ActiveChat | null>;
	isOpenRef: MutableRefObject<boolean>;
	currentUserId?: number;
	shouldAcceptMessage: (message: Message) => boolean;
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
	clearUnread: (contactId: string) => void;
	incrementUnread: (contactId: string) => void;
	addToast: (toast: ReturnType<typeof createMessageToast>) => void;
	setActiveChat: (contactId: string) => void;
	openWindow: () => void;
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
	incrementUnread,
	addToast,
	setActiveChat,
	openWindow,
	upsertAndTouchContact,
}: UseChatRealtimeOptions) => {
	useEffect(() => {
		if (!activeChat) return;

		const token = localStorage.getItem("token") || "";
		chatService.connect(token);
		if (activeChat.type === "group" && activeChat.chatId) {
			chatService.connectToGroup(activeChat.chatId, token);
		}

		const handleNewMessage = (payload: ChatSocketPayload) => {
			try {
				const eventType =
					typeof payload === "object" && payload && "type" in payload
						? payload.type
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
						? payload.message
						: (payload as Message);

				const currentActiveChat = activeChatRef.current;
				const currentIsOpen = isOpenRef.current;

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
					let contactId = "";
					let senderName = "";
					let senderAvatar: string | undefined;
					let messageText = "";

					if (msg.chat_id != null) {
						contactId = `chat-${msg.chat_id}`;
						senderName =
							msg.sender?.name ||
							msg.sender?.email ||
							"Пользователь";
						senderAvatar = msg.sender?.avatar;
						messageText = msg.content;
					} else {
						const senderId = msg.sender_id;
						contactId = `user-${senderId}`;
						senderName =
							msg.sender?.name ||
							msg.sender?.email ||
							"Пользователь";
						senderAvatar = msg.sender?.avatar;
						messageText = msg.content;
					}

					incrementUnread(contactId);
					addToast(
						createMessageToast(
							senderName,
							messageText.length > 50
								? messageText.substring(0, 50) + "..."
								: messageText,
							senderAvatar,
							() => {
								setActiveChat(contactId);
								if (!currentIsOpen) openWindow();
							},
						),
					);
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
		addToast,
		clearUnread,
		currentUserId,
		incrementUnread,
		isOpenRef,
		openWindow,
		setActiveChat,
		setMessages,
		shouldAcceptMessage,
		upsertAndTouchContact,
	]);
};
