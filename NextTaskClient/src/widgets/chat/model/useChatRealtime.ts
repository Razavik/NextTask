import { useEffect, type MutableRefObject } from "react";
import { chatService, type ActiveChat } from "@entities/chat";
import type { Message, RepliedMessageRef } from "@shared/types/message";
import { apiService, ApiRoute } from "@shared/api";

interface UseChatRealtimeOptions {
	activeChat: ActiveChat | null;
	activeChatRef: MutableRefObject<ActiveChat | null>;
	isOpenRef: MutableRefObject<boolean>;
	currentUserId?: number;
	shouldAcceptMessage: (message: Message) => boolean;
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
	setPinnedMessage: React.Dispatch<React.SetStateAction<Message | null>>;
	setTypingState?: React.Dispatch<
		React.SetStateAction<
			Record<string, { name?: string; isTyping: boolean }>
		>
	>;
	setOnlineUserIds?: React.Dispatch<React.SetStateAction<Set<number>>>;
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

const normalizeTextValue = (value: unknown) => {
	if (typeof value === "string") {
		return value;
	}

	if (value && typeof value === "object") {
		if ("text" in value && typeof value.text === "string") {
			return value.text;
		}

		if ("content" in value && typeof value.content === "string") {
			return value.content;
		}

		try {
			return JSON.stringify(value);
		} catch {
			return "";
		}
	}

	return "";
};

const normalizeRepliedMessage = (
	value: unknown,
): RepliedMessageRef | null | undefined => {
	if (!value || typeof value !== "object") {
		return undefined;
	}

	const raw = value as Record<string, unknown>;
	if (typeof raw.id !== "number" || typeof raw.created_at !== "string") {
		return undefined;
	}

	return {
		id: raw.id,
		created_at: raw.created_at,
		content: normalizeTextValue(raw.content),
		is_edited:
			typeof raw.is_edited === "boolean" ? raw.is_edited : undefined,
		sender:
			raw.sender && typeof raw.sender === "object"
				? (raw.sender as RepliedMessageRef["sender"])
				: undefined,
	};
};

const normalizeMessagePayload = (payload: unknown): Message | null => {
	if (!payload || typeof payload !== "object") {
		return null;
	}

	const raw =
		"message" in payload &&
		payload.message &&
		typeof payload.message === "object"
			? (payload.message as Record<string, unknown>)
			: (payload as Record<string, unknown>);

	return {
		...(raw as unknown as Message),
		content: normalizeTextValue(raw.content),
		replied_message: normalizeRepliedMessage(raw.replied_message),
	};
};

export const useChatRealtime = ({
	activeChat,
	activeChatRef,
	isOpenRef,
	currentUserId,
	shouldAcceptMessage,
	setMessages,
	setPinnedMessage,
	setTypingState,
	setOnlineUserIds,
	clearUnread,
	upsertAndTouchContact,
}: UseChatRealtimeOptions) => {
	useEffect(() => {
		const token = localStorage.getItem("token") || "";
		if (!token) return;

		chatService.connect(token);
		chatService.requestPresenceSnapshot();
		if (activeChat?.type === "group" && activeChat.chatId) {
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

				if (eventType === "presence_snapshot") {
					const userIds =
						(payload as { user_ids?: number[] }).user_ids ?? [];
					setOnlineUserIds?.(new Set(userIds));
					return;
				}

				if (eventType === "presence") {
					const presence = payload as {
						user_id?: number;
						is_online?: boolean;
					};
					if (typeof presence.user_id === "number") {
						const userId = presence.user_id;
						setOnlineUserIds?.((prev) => {
							const next = new Set(prev);
							if (presence.is_online) {
								next.add(userId);
							} else {
								next.delete(userId);
							}
							return next;
						});
					}
					return;
				}

				if (eventType === "typing") {
					const typingPayload = payload as {
						sender_id?: number;
						chat_id?: number;
						is_typing?: boolean;
					};
					const key =
						typeof typingPayload.chat_id === "number"
							? `chat-${typingPayload.chat_id}`
							: typeof typingPayload.sender_id === "number"
								? `user-${typingPayload.sender_id}`
								: null;
					if (key && typingPayload.sender_id !== currentUserId) {
						setTypingState?.((prev) => ({
							...prev,
							[key]: {
								name:
									activeChatRef.current?.contactId === key
										? activeChatRef.current?.name
										: prev[key]?.name,
								isTyping: typingPayload.is_typing !== false,
							},
						}));
					}
					return;
				}

				if (eventType === "message_read") {
					const readMessage = (
						payload as { message?: Partial<Message> }
					).message;
					if (typeof readMessage?.id === "number") {
						setMessages((prev) =>
							prev.map((message) =>
								message.id === readMessage.id
									? { ...message, is_read: 1 }
									: message,
							),
						);
					}
					return;
				}

				const msg = normalizeMessagePayload(payload);
				if (!msg) {
					return;
				}

				const currentActiveChat = activeChatRef.current;
				const isPendingMessageMatch = (
					pending: Message,
					incoming: Message,
				) => {
					if (pending.id <= 1_000_000_000_000) return false;
					if (pending.sender_id !== incoming.sender_id) return false;
					if (
						pending.temp_client_id &&
						incoming.temp_client_id &&
						pending.temp_client_id === incoming.temp_client_id
					) {
						return true;
					}
					if (
						(pending.chat_id ?? null) !== (incoming.chat_id ?? null)
					) {
						return false;
					}
					if (
						(pending.receiver_id ?? null) !==
						(incoming.receiver_id ?? null)
					) {
						return false;
					}
					if ((pending.content || "") !== (incoming.content || "")) {
						return false;
					}

					const pendingAttachments = JSON.stringify(
						pending.attachments || [],
					);
					const incomingAttachments = JSON.stringify(
						incoming.attachments || [],
					);
					if (pendingAttachments !== incomingAttachments)
						return false;

					const pendingTime = new Date(pending.created_at).getTime();
					const incomingTime = new Date(
						incoming.created_at,
					).getTime();
					return Math.abs(incomingTime - pendingTime) <= 15_000;
				};

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
					) {
						return false;
					}
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
					setMessages((prev) =>
						prev.map((m) =>
							m.id === msg.id ? { ...m, ...msg } : m,
						),
					);
					setPinnedMessage((prev) => {
						if (prev && prev.id === msg.id && !msg.is_pinned)
							return null;
						if (msg.is_pinned) return msg;
						return prev;
					});
					return;
				}

				if (belongsToActive) {
					let shouldProcessIncoming = true;
					setMessages((prev) => {
						const pendingIndex = prev.findIndex((item) =>
							isPendingMessageMatch(item, msg),
						);

						if (pendingIndex !== -1) {
							const next = [...prev];
							next[pendingIndex] = {
								...next[pendingIndex],
								...msg,
							};
							return next;
						}

						if (!shouldAcceptMessage(msg)) {
							shouldProcessIncoming = false;
							return prev;
						}

						return [...prev, msg];
					});

					if (!shouldProcessIncoming) {
						return;
					}

					const contactId =
						msg.chat_id != null
							? `chat-${msg.chat_id}`
							: `user-${
									msg.sender_id === currentUserId
										? msg.receiver_id
										: msg.sender_id
								}`;
					clearUnread(contactId);
					if (
						msg.receiver_id === currentUserId &&
						msg.sender_id !== currentUserId &&
						msg.chat_id == null &&
						!msg.is_read
					) {
						void apiService.patch<Message>(
							ApiRoute.ChatMessageRead,
							undefined,
							{
								pathParams: { messageId: msg.id },
							},
						);
						setMessages((prev) =>
							prev.map((message) =>
								message.id === msg.id
									? { ...message, is_read: 1 }
									: message,
							),
						);
					}
				} else if (!belongsToActive && shouldAcceptMessage(msg)) {
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
				} catch {}
			} catch {}
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
		setOnlineUserIds,
		setTypingState,
		shouldAcceptMessage,
		upsertAndTouchContact,
	]);
};
