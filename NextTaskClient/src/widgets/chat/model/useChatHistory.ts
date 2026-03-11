import { useEffect, useState, type MutableRefObject } from "react";
import { type ActiveChat } from "@entities/chat";
import type { Message } from "@shared/types/message";
import { apiService, ApiRoute } from "@shared/api";

interface UseChatHistoryOptions {
	activeChat: ActiveChat | null;
	activeChatRef: MutableRefObject<ActiveChat | null>;
	currentUserId?: number;
}

export const useChatHistory = ({
	activeChat,
	activeChatRef,
	currentUserId,
}: UseChatHistoryOptions) => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [isLoadingMoreBottom, setIsLoadingMoreBottom] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [hasMoreBottom, setHasMoreBottom] = useState(false);
	const [isJumped, setIsJumped] = useState(false);
	const [offset, setOffset] = useState(0);
	const LIMIT = 50;

	useEffect(() => {
		const token = activeChat?.contactId ?? null;
		if (!activeChat || !token) {
			setMessages([]);
			setIsLoading(false);
			setHasMore(false);
			setHasMoreBottom(false);
			return;
		}

		let cancelled = false;
		setMessages([]);
		setPinnedMessage(null);
		setIsJumped(false);
		setOffset(0);
		setHasMore(true);
		setHasMoreBottom(false);

		const loadHistory = async () => {
			try {
				setIsLoading(true);
				let history: Message[];
				let pinned: Message | null = null;

				if (activeChat.type === "group" && activeChat.chatId) {
					const [historyRes, pinnedRes] = await Promise.allSettled([
						apiService.get<Message[]>(ApiRoute.GroupChatMessages, {
							pathParams: { chatId: activeChat.chatId },
							query: { limit: LIMIT, offset: 0 },
						}),
						apiService.get<Message>(
							ApiRoute.GroupChatPinnedMessage,
							{
								pathParams: { chatId: activeChat.chatId },
							},
						),
					]);

					history =
						historyRes.status === "fulfilled"
							? historyRes.value
							: [];
					if (pinnedRes.status === "fulfilled") {
						pinned = pinnedRes.value;
					}
				} else if (activeChat.userId) {
					const [historyRes, pinnedRes] = await Promise.allSettled([
						apiService.get<Message[]>(ApiRoute.ChatMessagesByUser, {
							pathParams: { userId: activeChat.userId },
							query: { limit: LIMIT, offset: 0 },
						}),
						apiService.get<Message>(
							ApiRoute.ChatPinnedMessageByUser,
							{
								pathParams: { userId: activeChat.userId },
							},
						),
					]);

					history =
						historyRes.status === "fulfilled"
							? historyRes.value
							: [];
					if (pinnedRes.status === "fulfilled") {
						pinned = pinnedRes.value;
					}
				} else {
					return;
				}

				if (!cancelled && activeChatRef.current?.contactId === token) {
					const orderedHistory = history.reverse();
					setMessages(orderedHistory);
					setPinnedMessage(pinned);
					setOffset(orderedHistory.length);
					setHasMore(orderedHistory.length === LIMIT);

					if (
						activeChat.type === "personal" &&
						currentUserId &&
						activeChat.userId
					) {
						const unreadIncoming = orderedHistory.filter(
							(message) =>
								message.receiver_id === currentUserId &&
								message.sender_id === activeChat.userId &&
								!message.is_read,
						);

						if (unreadIncoming.length > 0) {
							void Promise.all(
								unreadIncoming.map((message) =>
									apiService.patch<Message>(
										ApiRoute.ChatMessageRead,
										undefined,
										{
											pathParams: {
												messageId: message.id,
											},
										},
									),
								),
							);

							setMessages((prev) =>
								prev.map((message) =>
									unreadIncoming.some(
										(unread) => unread.id === message.id,
									)
										? { ...message, is_read: 1 }
										: message,
								),
							);
						}
					}
				}
			} catch (error) {
				console.error("Ошибка загрузки истории:", error);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		void loadHistory();
		return () => {
			cancelled = true;
		};
	}, [activeChat, activeChatRef, currentUserId]);

	const loadMoreMessages = async () => {
		if (!activeChat || isLoadingMore || !hasMore) return;

		try {
			setIsLoadingMore(true);
			let olderHistory: Message[];
			const firstMessage = messages[0];

			if (activeChat.type === "group" && activeChat.chatId) {
				olderHistory = await apiService.get<Message[]>(
					ApiRoute.GroupChatMessages,
					{
						pathParams: { chatId: activeChat.chatId },
						query:
							isJumped && firstMessage
								? { limit: LIMIT, before: firstMessage.id }
								: { limit: LIMIT, offset },
					},
				);
			} else if (activeChat.userId) {
				olderHistory = await apiService.get<Message[]>(
					ApiRoute.ChatMessagesByUser,
					{
						pathParams: { userId: activeChat.userId },
						query:
							isJumped && firstMessage
								? { limit: LIMIT, before: firstMessage.id }
								: { limit: LIMIT, offset },
					},
				);
			} else {
				return;
			}

			const orderedOlderHistory = olderHistory.reverse();
			setMessages((prev) => {
				const existingIds = new Set(prev.map((message) => message.id));
				const uniqueOlderHistory = orderedOlderHistory.filter(
					(message) => {
						if (existingIds.has(message.id)) {
							return false;
						}
						existingIds.add(message.id);
						return true;
					},
				);

				return [...uniqueOlderHistory, ...prev];
			});
			if (!isJumped) {
				setOffset((prev) => prev + orderedOlderHistory.length);
			}
			setHasMore(orderedOlderHistory.length === LIMIT);
		} catch (error) {
			console.error("Ошибка подгрузки истории:", error);
		} finally {
			setIsLoadingMore(false);
		}
	};

	const loadMoreMessagesBottom = async () => {
		if (!activeChat || isLoadingMoreBottom || !hasMoreBottom) return;

		const lastMessage = messages[messages.length - 1];
		if (!lastMessage) return;

		try {
			setIsLoadingMoreBottom(true);
			let newerHistory: Message[];

			if (activeChat.type === "group" && activeChat.chatId) {
				newerHistory = await apiService.get<Message[]>(
					ApiRoute.GroupChatMessages,
					{
						pathParams: { chatId: activeChat.chatId },
						query: { limit: LIMIT, after: lastMessage.id },
					},
				);
			} else if (activeChat.userId) {
				newerHistory = await apiService.get<Message[]>(
					ApiRoute.ChatMessagesByUser,
					{
						pathParams: { userId: activeChat.userId },
						query: { limit: LIMIT, after: lastMessage.id },
					},
				);
			} else {
				return;
			}

			const orderedNewerHistory = newerHistory.reverse();

			setMessages((prev) => {
				const existingIds = new Set(prev.map((message) => message.id));
				const uniqueNewerHistory = orderedNewerHistory.filter(
					(message) => {
						if (existingIds.has(message.id)) {
							return false;
						}
						existingIds.add(message.id);
						return true;
					},
				);

				if (uniqueNewerHistory.length === 0) {
					return prev;
				}

				return [...prev, ...uniqueNewerHistory];
			});

			setHasMoreBottom(newerHistory.length === LIMIT);
		} catch (error) {
			console.error("Ошибка подгрузки новых сообщений:", error);
		} finally {
			setIsLoadingMoreBottom(false);
		}
	};

	const jumpToMessage = async (messageId: number) => {
		if (!activeChat) return;
		try {
			setIsLoading(true);
			setIsJumped(true);
			setMessages([]);
			setHasMore(false);
			setHasMoreBottom(false);
			let history: Message[];

			if (activeChat.type === "group" && activeChat.chatId) {
				history = await apiService.get<Message[]>(
					ApiRoute.GroupChatMessages,
					{
						pathParams: { chatId: activeChat.chatId },
						query: { limit: LIMIT, offset: 0, around: messageId },
					},
				);
			} else if (activeChat.userId) {
				history = await apiService.get<Message[]>(
					ApiRoute.ChatMessagesByUser,
					{
						pathParams: { userId: activeChat.userId },
						query: { limit: LIMIT, offset: 0, around: messageId },
					},
				);
			} else {
				return;
			}

			const orderedHistory = history.reverse();
			setMessages(orderedHistory);
			const targetIndex = orderedHistory.findIndex(
				(message) => message.id === messageId,
			);
			setHasMore(targetIndex > 0);
			setHasMoreBottom(
				targetIndex !== -1 && targetIndex < orderedHistory.length - 1,
			);
			setOffset(0);
		} catch (error) {
			console.error("Ошибка прыжка к сообщению:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const resetJump = async () => {
		if (!activeChat || !isJumped) return;
		try {
			setIsLoading(true);
			let history: Message[];

			if (activeChat.type === "group" && activeChat.chatId) {
				history = await apiService.get<Message[]>(
					ApiRoute.GroupChatMessages,
					{
						pathParams: { chatId: activeChat.chatId },
						query: { limit: LIMIT, offset: 0 },
					},
				);
			} else if (activeChat.userId) {
				history = await apiService.get<Message[]>(
					ApiRoute.ChatMessagesByUser,
					{
						pathParams: { userId: activeChat.userId },
						query: { limit: LIMIT, offset: 0 },
					},
				);
			} else {
				return;
			}

			const orderedHistory = history.reverse();
			setMessages(orderedHistory);
			setOffset(orderedHistory.length);
			setHasMore(orderedHistory.length === LIMIT);
			setHasMoreBottom(false);
			setIsJumped(false);
		} catch (error) {
			console.error("Ошибка сброса прыжка:", error);
		} finally {
			setIsLoading(false);
		}
	};

	return {
		messages,
		setMessages,
		pinnedMessage,
		setPinnedMessage,
		isLoading,
		isLoadingMore,
		isLoadingMoreBottom,
		hasMore,
		hasMoreBottom,
		isJumped,
		loadMoreMessages,
		loadMoreMessagesBottom,
		jumpToMessage,
		resetJump,
	};
};
