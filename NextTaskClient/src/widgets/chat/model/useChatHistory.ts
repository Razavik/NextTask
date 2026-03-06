import { useEffect, useState, type MutableRefObject } from "react";
import { chatService, type ActiveChat } from "@entities/chat";
import type { Message } from "@shared/types/message";

interface UseChatHistoryOptions {
	activeChat: ActiveChat | null;
	activeChatRef: MutableRefObject<ActiveChat | null>;
}

export const useChatHistory = ({
	activeChat,
	activeChatRef,
}: UseChatHistoryOptions) => {
	const [messages, setMessages] = useState<Message[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const token = activeChat?.contactId ?? null;
		if (!activeChat || !token) {
			setMessages([]);
			setIsLoading(false);
			return;
		}

		let cancelled = false;
		setMessages([]);

		const loadHistory = async () => {
			try {
				setIsLoading(true);
				let history: Message[];

				if (activeChat.type === "group" && activeChat.chatId) {
					history = await chatService.getGroupHistory(
						activeChat.chatId,
					);
				} else if (activeChat.userId) {
					history = await chatService.getHistory(activeChat.userId);
				} else {
					return;
				}

				if (!cancelled && activeChatRef.current?.contactId === token) {
					setMessages(history.reverse());
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
	}, [activeChat, activeChatRef]);

	return { messages, setMessages, isLoading };
};
