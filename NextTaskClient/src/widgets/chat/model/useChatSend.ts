import { useState } from "react";
import { chatService, type ActiveChat } from "@entities/chat";
import type { Message } from "@shared/types/message";

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
				// Редактирование
				if (editingMessage.chat_id != null) {
					// Групповое
					await chatService.updateGroupMessage(
						editingMessage.id,
						newMessage,
						attachments,
					);
				} else {
					// Личное
					await chatService.updateMessage(
						editingMessage.id,
						newMessage,
						attachments,
					);
				}
				// Локальное обновление происходит через WS, но можно и оптимистично обновить
				setMessages((prev) =>
					prev.map((m) =>
						m.id === editingMessage.id
							? {
									...m,
									content: newMessage,
									attachments: attachments,
									is_edited: true,
								}
							: m,
					),
				);
				setEditingMessage(null);
			} else {
				// Отправка нового
				const reply_to_id = replyingToMessage
					? replyingToMessage.id
					: null;

				if (activeChat.type === "group" && activeChat.chatId) {
					const content = newMessage.trim();
					// Если есть вложения, используем REST (TODO: обновить)
					if (attachments.length > 0) {
						chatService.sendGroupMessage(
							JSON.stringify({
								content,
								attachments,
								reply_to_id,
							}),
							activeChat.chatId,
						);
					} else {
						chatService.sendGroupMessage(
							JSON.stringify({ content, reply_to_id }),
							activeChat.chatId,
						);
					}

					// Оптимистичное добавление
					if (currentUser) {
						const optimistic: Message = {
							id: Date.now(),
							chat_id: activeChat.chatId,
							sender_id: currentUser.id,
							is_read: 1,
							content,
							created_at: new Date().toISOString(),
							attachments: attachments,
							reply_to_id: reply_to_id,
							replied_message: replyingToMessage
								? {
										id: replyingToMessage.id,
										content: replyingToMessage.content,
										created_at:
											replyingToMessage.created_at,
										sender: replyingToMessage.sender
											? {
													...replyingToMessage.sender,
													name:
														replyingToMessage.sender
															.name || "",
												}
											: undefined,
									}
								: null,
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
					// Личное
					if (attachments.length > 0) {
						// REST для вложений
						const msg = await chatService.sendPersonalMessage({
							receiver_id: activeChat.userId,
							content: newMessage,
							attachments,
							reply_to_id,
						});
						// Оптимистичное добавление не нужно, так как REST вернет сообщение, а WS может продублировать?
						// Обычно WS шлет "new_message".
						// Если мы добавим здесь, будет дубль при приходе от WS.
						// Но shouldChatDedup должен справиться.
						if (shouldAcceptMessage(msg)) {
							setMessages((prev) => [...prev, msg]);
						}
					} else {
						// Для личных сообщений без вложений через WS
						if (
							chatService["wsPersonal"] &&
							chatService["wsPersonal"].readyState ===
								WebSocket.OPEN
						) {
							chatService["wsPersonal"].send(
								JSON.stringify({
									receiver_id: activeChat.userId,
									content: newMessage.trim(),
									reply_to_id,
								}),
							);
						}

						// Оптимистичное для личных через WS
						if (currentUser) {
							const optimistic: Message = {
								id: Date.now(),
								sender_id: currentUser.id,
								receiver_id: activeChat.userId,
								content: newMessage.trim(),
								is_read: 0,
								created_at: new Date().toISOString(),
								attachments: [],
								reply_to_id: reply_to_id,
								replied_message: replyingToMessage
									? {
											id: replyingToMessage.id,
											content: replyingToMessage.content,
											created_at:
												replyingToMessage.created_at,
											sender: replyingToMessage.sender
												? {
														...replyingToMessage.sender,
														name:
															replyingToMessage
																.sender.name ||
															"",
													}
												: undefined,
										}
									: null,
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

			// Upsert contact logic...
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
				await chatService.updateGroupMessage(
					msg.id,
					undefined,
					undefined,
					isPinned,
				);
			} else {
				await chatService.updateMessage(
					msg.id,
					undefined,
					undefined,
					isPinned,
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

	const handleDelete = async (msgId: number, isGroup: boolean) => {
		if (!confirm("Удалить сообщение?")) return;
		try {
			if (isGroup) {
				await chatService.deleteGroupMessage(msgId);
			} else {
				await chatService.deleteMessage(msgId);
			}
			// WS обновит список, но можно и локально удалить
			setMessages((prev) => prev.filter((m) => m.id !== msgId));
		} catch (error) {
			console.error("Ошибка удаления:", error);
		}
	};

	const handleUpload = async (file: File) => {
		try {
			setIsUploading(true);
			const formData = new FormData();
			formData.append("file", file);
			const data = await chatService.uploadFile(formData);
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

	return {
		newMessage,
		setNewMessage,
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
		handleUpload,
		removeAttachment,
	};
};

export default useChatSend;
