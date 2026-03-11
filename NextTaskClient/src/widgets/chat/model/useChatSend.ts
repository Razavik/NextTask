import { useEffect, useRef, useState } from "react";
import { chatService, type ActiveChat } from "@entities/chat";
import type { Message } from "@shared/types/message";
import { apiService, ApiRoute } from "@shared/api";

interface User {
	id: number;
	name?: string;
	email: string;
	avatar?: string;
}

interface UseChatSendOptions {
	activeChat: ActiveChat | null;
	currentUser: User | null;
	shouldAcceptMessage: (m: Message) => boolean;
	setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
	upsertAndTouchContact: (contact: {
		id: string;
		type: "personal" | "group";
		userId?: number;
		chatId?: number;
		name: string;
		avatar?: string;
	}) => void;
}

export const useChatSend = ({
	activeChat,
	currentUser,
	shouldAcceptMessage,
	setMessages,
	upsertAndTouchContact,
}: UseChatSendOptions) => {
	const [newMessage, setNewMessage] = useState("");
	const [isSending, setIsSending] = useState(false);
	const [editingMessage, setEditingMessage] = useState<Message | null>(null);
	const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(
		null,
	);
	const [attachments, setAttachments] = useState<string[]>([]);
	const [isUploading, setIsUploading] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<{
		msgId: number;
		isGroup: boolean;
	} | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const typingTimeoutRef = useRef<number | null>(null);

	const buildReplyRef = () =>
		replyingToMessage
			? {
					id: replyingToMessage.id,
					content: replyingToMessage.content,
					created_at: replyingToMessage.created_at,
					sender: replyingToMessage.sender
						? {
								...replyingToMessage.sender,
								name: replyingToMessage.sender.name || "",
							}
						: undefined,
				}
			: null;

	const handleSend = async () => {
		if (
			(!newMessage.trim() && attachments.length === 0) ||
			isSending ||
			!activeChat
		)
			return;

		try {
			setIsSending(true);

			if (editingMessage) {
				if (editingMessage.chat_id != null) {
					await apiService.put<
						Message,
						{
							content?: string;
							attachments?: string[];
							is_pinned?: boolean;
						}
					>(
						ApiRoute.GroupChatMessageById,
						{
							content: newMessage,
							attachments,
						},
						{ pathParams: { messageId: editingMessage.id } },
					);
				} else {
					await apiService.put<
						Message,
						{
							content?: string;
							attachments?: string[];
							is_pinned?: boolean;
						}
					>(
						ApiRoute.ChatMessageById,
						{
							content: newMessage,
							attachments,
						},
						{ pathParams: { messageId: editingMessage.id } },
					);
				}

				setMessages((prev) =>
					prev.map((m) =>
						m.id === editingMessage.id
							? {
									...m,
									content: newMessage,
									attachments,
									is_edited: true,
								}
							: m,
					),
				);
				setEditingMessage(null);
			} else {
				const reply_to_id = replyingToMessage
					? replyingToMessage.id
					: null;
				const replied_message = buildReplyRef();
				const content = newMessage.trim();
				const tempClientId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

				if (activeChat.type === "group" && activeChat.chatId) {
					chatService.sendGroupMessage(
						{
							temp_client_id: tempClientId,
							content,
							attachments:
								attachments.length > 0
									? attachments
									: undefined,
							reply_to_id,
						},
						activeChat.chatId,
					);

					if (currentUser) {
						const optimistic: Message = {
							id: Date.now(),
							temp_client_id: tempClientId,
							chat_id: activeChat.chatId,
							sender_id: currentUser.id,
							is_read: 1,
							content,
							created_at: new Date().toISOString(),
							attachments,
							reply_to_id,
							replied_message,
							sender: {
								id: currentUser.id,
								name: currentUser.name || currentUser.email,
								email: currentUser.email,
								avatar: currentUser.avatar,
							},
						};
						if (shouldAcceptMessage(optimistic)) {
							setMessages((prev) => [...prev, optimistic]);
						}
					}
				} else if (activeChat.userId) {
					if (attachments.length > 0) {
						const msg = await apiService.post<
							Message,
							{
								receiver_id: number;
								content: string;
								attachments?: string[];
								reply_to_id?: number | null;
							}
						>(ApiRoute.ChatMessages, {
							receiver_id: activeChat.userId,
							content,
							attachments,
							reply_to_id,
						});
						if (shouldAcceptMessage(msg)) {
							setMessages((prev) => [...prev, msg]);
						}
					} else {
						const tempClientId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

						chatService.sendMessage({
							type: "message",
							receiver_id: activeChat.userId,
							content,
							reply_to_id,
							temp_client_id: tempClientId,
						} as {
							type: "message";
							receiver_id: number;
							content: string;
							reply_to_id?: number | null;
							temp_client_id?: string;
						});

						if (currentUser) {
							const optimistic: Message = {
								id: Date.now(),
								temp_client_id: tempClientId,
								sender_id: currentUser.id,
								receiver_id: activeChat.userId,
								content,
								is_read: 0,
								created_at: new Date().toISOString(),
								attachments: [],
								reply_to_id,
								replied_message,
								sender: {
									id: currentUser.id,
									name: currentUser.name || currentUser.email,
									email: currentUser.email,
									avatar: currentUser.avatar,
								},
							};
							if (shouldAcceptMessage(optimistic)) {
								setMessages((prev) => [...prev, optimistic]);
							}
						}
					}
				}
			}

			setNewMessage("");
			setAttachments([]);
			setReplyingToMessage(null);
			if (typingTimeoutRef.current) {
				window.clearTimeout(typingTimeoutRef.current);
				typingTimeoutRef.current = null;
			}
			if (activeChat.type === "group" && activeChat.chatId) {
				chatService.sendGroupTyping(activeChat.chatId, false);
			} else if (activeChat.userId) {
				chatService.sendTyping(activeChat.userId, false);
			}

			if (activeChat.type === "group" && activeChat.chatId) {
				upsertAndTouchContact({
					id: `chat-${activeChat.chatId}`,
					type: "group",
					chatId: activeChat.chatId,
					name: activeChat.name,
					avatar: activeChat.avatar,
				});
			} else if (activeChat.userId) {
				upsertAndTouchContact({
					id: `user-${activeChat.userId}`,
					type: "personal",
					userId: activeChat.userId,
					name: activeChat.name,
					avatar: activeChat.avatar,
				});
			}
		} catch (error) {
			console.error("Ошибка отправки:", error);
		} finally {
			setIsSending(false);
		}
	};

	const handleEdit = (msg: Message) => {
		setEditingMessage(msg);
		setNewMessage(msg.content);
		setAttachments(msg.attachments || []);
	};

	const handleCancelEdit = () => {
		setEditingMessage(null);
		setNewMessage("");
		setAttachments([]);
	};

	const handleReply = (msg: Message) => {
		setReplyingToMessage(msg);
	};

	const handleCancelReply = () => {
		setReplyingToMessage(null);
	};

	const handleTogglePin = async (msg: Message) => {
		try {
			const isPinned = !msg.is_pinned;
			if (msg.chat_id != null) {
				await apiService.put<
					Message,
					{
						content?: string;
						attachments?: string[];
						is_pinned?: boolean;
					}
				>(
					ApiRoute.GroupChatMessageById,
					{ is_pinned: isPinned },
					{ pathParams: { messageId: msg.id } },
				);
			} else {
				await apiService.put<
					Message,
					{
						content?: string;
						attachments?: string[];
						is_pinned?: boolean;
					}
				>(
					ApiRoute.ChatMessageById,
					{ is_pinned: isPinned },
					{ pathParams: { messageId: msg.id } },
				);
			}
			setMessages((prev) =>
				prev.map((m) => {
					if (m.id === msg.id) {
						return { ...m, is_pinned: isPinned };
					}

					if (isPinned && m.is_pinned) {
						return { ...m, is_pinned: false };
					}

					return m;
				}),
			);
		} catch (error) {
			console.error("Ошибка закрепления:", error);
		}
	};

	const handleDelete = (msgId: number, isGroup: boolean) => {
		setDeleteTarget({ msgId, isGroup });
	};

	const handleCancelDelete = () => {
		if (isDeleting) return;
		setDeleteTarget(null);
	};

	const handleConfirmDelete = async () => {
		if (!deleteTarget) return;
		try {
			setIsDeleting(true);
			if (deleteTarget.isGroup) {
				await apiService.delete<void>(
					ApiRoute.GroupChatMessageById,
					undefined,
					{
						pathParams: { messageId: deleteTarget.msgId },
					},
				);
			} else {
				await apiService.delete<void>(
					ApiRoute.ChatMessageById,
					undefined,
					{
						pathParams: { messageId: deleteTarget.msgId },
					},
				);
			}
			setMessages((prev) =>
				prev.filter((m) => m.id !== deleteTarget.msgId),
			);
			setDeleteTarget(null);
		} catch (error) {
			console.error("Ошибка удаления:", error);
		} finally {
			setIsDeleting(false);
		}
	};

	const handleUpload = async (file: File) => {
		try {
			setIsUploading(true);
			const formData = new FormData();
			formData.append("file", file);
			const data = await apiService.post<{ url: string }, FormData>(
				ApiRoute.ChatUpload,
				formData,
				{
					config: {
						headers: {
							"Content-Type": "multipart/form-data",
						},
					},
				},
			);
			setAttachments((prev) => [...prev, data.url]);
		} catch (error) {
			console.error("Ошибка загрузки файла:", error);
		} finally {
			setIsUploading(false);
		}
	};

	const removeAttachment = (url: string) => {
		setAttachments((prev) => prev.filter((u) => u !== url));
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			void handleSend();
		}
	};

	const handleMessageChange = (value: string) => {
		setNewMessage(value);
		if (!activeChat) return;

		const isTyping = value.trim().length > 0;
		if (activeChat.type === "group" && activeChat.chatId) {
			chatService.sendGroupTyping(activeChat.chatId, isTyping);
		} else if (activeChat.userId) {
			chatService.sendTyping(activeChat.userId, isTyping);
		}

		if (typingTimeoutRef.current) {
			window.clearTimeout(typingTimeoutRef.current);
		}

		typingTimeoutRef.current = window.setTimeout(() => {
			if (!activeChat) return;
			if (activeChat.type === "group" && activeChat.chatId) {
				chatService.sendGroupTyping(activeChat.chatId, false);
			} else if (activeChat.userId) {
				chatService.sendTyping(activeChat.userId, false);
			}
		}, 1200);
	};

	useEffect(
		() => () => {
			if (typingTimeoutRef.current) {
				window.clearTimeout(typingTimeoutRef.current);
			}
		},
		[],
	);

	return {
		newMessage,
		setNewMessage: handleMessageChange,
		isSending,
		handleSend,
		handleKeyDown,
		isUploading,
		editingMessage,
		replyingToMessage,
		attachments,
		handleEdit,
		handleCancelEdit,
		handleReply,
		handleCancelReply,
		handleTogglePin,
		handleDelete,
		handleCancelDelete,
		handleConfirmDelete,
		deleteTarget,
		isDeleting,
		handleUpload,
		removeAttachment,
	};
};

export default useChatSend;
