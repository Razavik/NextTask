import { FC, useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { LAST_ACTIVE_CHAT_STORAGE_KEY } from "@shared/constants/chat";
import { useLocation } from "react-router-dom";

import styles from "./index.module.css";
import Header from "./components/header";
import Sidebar from "./components/sidebar";
import Messages from "./components/messages";
import Input from "./components/input";
import { useChatPosition } from "@widgets/chat/model/useChatPosition";
import { useChatHistory } from "@widgets/chat/model/useChatHistory";
import { useChatContacts } from "@widgets/chat/model/useChatContacts";
import { useChatRealtime } from "@widgets/chat/model/useChatRealtime";
import { useChatDedup } from "@widgets/chat/model/useChatDedup";
import { useChatSend } from "@widgets/chat/model/useChatSend";
import CreateGroupModal from "./components/create-group-modal";
import ConfirmModal from "@shared/ui/confirm-modal";
import { apiService, ApiRoute } from "@shared/api";

import { useChatStore } from "@entities/chat";
import { useAuthStore } from "@entities/user";

const Chat: FC = () => {
	const {
		isOpen,
		activeChat,
		contacts,
		shouldExpand,
		currentWorkspaceId,
		setActiveChat,
		closeChat,
		addContacts,
		ackExpand,
		upsertAndTouchContact,
		setContactsOrder,
		clearUnread,
		setCurrentWorkspaceId,
	} = useChatStore();

	const location = useLocation();

	// Скрываем фильтры если не в workspace (определяем по currentWorkspaceId из store)
	const hideFilters = !currentWorkspaceId;

	// Отладка
	const currentUser = useAuthStore((state) => state.user);

	const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [scope, setScope] = useState<"current" | "all">("current");
	const [isAppearing, setIsAppearing] = useState(true);
	const [isLeaving, setIsLeaving] = useState(false);
	const [showMobileChatList, setShowMobileChatList] = useState(true); // На мобильных показываем список чатов по умолчанию
	const [initialContactId, setInitialContactId] = useState<string | null>(
		null,
	);
	const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
	const [typingState, setTypingState] = useState<
		Record<string, { name?: string; isTyping: boolean }>
	>({});
	const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());

	// Автоматически переключаем на "Все" если фильтры скрыты
	useEffect(() => {
		if (hideFilters && scope !== "all") {
			setScope("all");
		}
	}, [hideFilters, scope]);

	// Сбрасываем currentWorkspaceId при выходе с роутов workspace
	useEffect(() => {
		if (!location.pathname.startsWith("/workspaces/workspace/")) {
			setCurrentWorkspaceId(undefined);
		}
	}, [location.pathname, setCurrentWorkspaceId]);

	// refs для актуальных значений, чтобы избежать stale-closure в WS обработчике
	const activeChatRef = useRef(activeChat);
	const isOpenRef = useRef(isOpen);
	useEffect(() => {
		activeChatRef.current = activeChat;
	}, [activeChat]);
	useEffect(() => {
		isOpenRef.current = isOpen;
	}, [isOpen]);

	// Загружаем сохранённый активный чат из localStorage при монтировании
	useEffect(() => {
		try {
			const stored = localStorage.getItem(LAST_ACTIVE_CHAT_STORAGE_KEY);
			if (stored) setInitialContactId(stored);
		} catch {}
	}, []);

	// Сохраняем текущий активный чат
	useEffect(() => {
		if (activeChat?.contactId) {
			try {
				localStorage.setItem(
					LAST_ACTIVE_CHAT_STORAGE_KEY,
					activeChat.contactId,
				);
			} catch {}
		}
	}, [activeChat?.contactId]);

	// Восстанавливаем активный чат после загрузки контактов
	// ВАЖНО: не перезаписываем activeChat, если он уже установлен (например, через openChat из страницы)
	useEffect(() => {
		if (!initialContactId) return;
		// Если активный чат уже есть в сторе, считаем, что его выбрали явно и не подменяем
		if (activeChat?.contactId) {
			setInitialContactId(null);
			return;
		}
		const exists = contacts.some((c) => c.id === initialContactId);
		if (exists) {
			setActiveChat(initialContactId);
			setInitialContactId(null);
		}
	}, [initialContactId, contacts, activeChat?.contactId, setActiveChat]);

	// Определение мобильного устройства
	const isMobile = () =>
		window.innerWidth < 768 ||
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent,
		);

	// Автоматически показываем список чатов на мобильных устройствах
	useEffect(() => {
		if (isMobile() && isOpen) {
			setShowMobileChatList(true);
		}
	}, [isOpen]);

	// На мобильных при выборе чата переключаемся на вид чата
	const handleMobileChatSelect = (contactId: string) => {
		setActiveChat(contactId);
		if (isMobile()) {
			setShowMobileChatList(false);
		}
	};

	// На мобильных при клике на "назад" возвращаемся к списку чатов
	const handleMobileBackToList = () => {
		setShowMobileChatList(true);
	};

	const messagesEndRef = useRef<HTMLDivElement | null>(null);
	const { shouldAcceptMessage } = useChatDedup();
	const chatId = "unified-chat";
	const { chatRef, position, isDragging, startDrag } = useChatPosition({
		chatId,
		width: 600,
		height: 600,
	});

	const {
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
	} = useChatHistory({
		activeChat,
		activeChatRef,
		currentUserId: currentUser?.id,
	});

	// Автоскролл к последнему сообщению
	useEffect(() => {
		if (isJumped) return;
		messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
	}, [isLoading, isJumped]);

	useChatRealtime({
		activeChat,
		activeChatRef,
		isOpenRef,
		currentUserId: currentUser?.id,
		shouldAcceptMessage,
		setMessages,
		setPinnedMessage,
		clearUnread,
		upsertAndTouchContact,
		setTypingState,
		setOnlineUserIds,
	});

	useChatContacts({
		addContacts,
		setContactsOrder,
		scope,
	});

	// Очищаем счётчик непрочитанных при открытии чата
	useEffect(() => {
		if (activeChat) {
			clearUnread(activeChat.contactId);
		}
	}, [activeChat, clearUnread]);

	useEffect(() => {
		if (shouldExpand) {
			setIsSidebarCollapsed(false);
			ackExpand();
		}
	}, [shouldExpand, ackExpand]);

	const isOpenRefLocal = useRef(true);

	useChatRealtime({
		activeChat,
		activeChatRef,
		isOpenRef: isOpenRefLocal,
		currentUserId: currentUser?.id,
		shouldAcceptMessage,
		setMessages,
		setPinnedMessage,
		clearUnread,
		upsertAndTouchContact,
		setTypingState,
		setOnlineUserIds,
	});

	// Появление (mount) с плавной анимацией
	useEffect(() => {
		// Запустим анимацию входа на следующий тик
		const t = setTimeout(() => setIsAppearing(false), 0);
		return () => clearTimeout(t);
	}, []);

	const {
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
		handleCancelDelete,
		handleConfirmDelete,
		deleteTarget,
		isDeleting,
		handleUpload,
		removeAttachment,
	} = useChatSend({
		activeChat,
		currentUser,
		shouldAcceptMessage,
		setMessages,
		upsertAndTouchContact,
	});

	const handleMouseDown = (e: React.MouseEvent) => {
		// Отключаем перетаскивание на мобильных устройствах
		if (isMobile()) return;
		startDrag(e.clientX, e.clientY);
	};

	const startClose = useCallback(() => {
		setIsLeaving(true);
		setTimeout(() => {
			closeChat();
		}, 220);
	}, [closeChat]);

	// Закрытие чата при нажатии Escape
	useEffect(() => {
		const handleEscKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				startClose();
			}
		};
		document.addEventListener("keydown", handleEscKey);
		return () => {
			document.removeEventListener("keydown", handleEscKey);
		};
	}, [startClose]);

	const handleCreateGroup = async (name: string, userIds: number[]) => {
		try {
			const data = await apiService.post<
				{ id: number; name: string },
				{
					name: string;
					user_ids: number[];
				}
			>(ApiRoute.GroupChatCreate, {
				name,
				user_ids: userIds,
			});
			setIsCreateGroupModalOpen(false);

			// Добавляем созданный чат в список и открываем его
			const newChatId = `chat-${data.id}`;
			upsertAndTouchContact({
				id: newChatId,
				type: "group",
				chatId: data.id,
				name: data.name,
			});
			setActiveChat(newChatId);
			if (isMobile()) {
				setShowMobileChatList(false);
			}
		} catch (error) {
			console.error("Failed to create group:", error);
		}
	};

	if (!position) return null;

	return createPortal(
		<>
			<div
				ref={chatRef}
				className={`${styles.chatContainer} ${isDragging ? styles.dragging : ""} ${
					isAppearing ? styles.entering : ""
				} ${isLeaving ? styles.leaving : ""}`}
				style={{
					left: `${position.x}px`,
					top: `${position.y}px`,
				}}
			>
				{/* Заголовок */}
				<Header
					activeChat={
						activeChat
							? {
									type: activeChat.type,
									name: activeChat.name,
									avatar: activeChat.avatar,
								}
							: null
					}
					isOnline={
						activeChat?.type === "personal" &&
						typeof activeChat.userId === "number"
							? onlineUserIds.has(activeChat.userId)
							: false
					}
					isTyping={
						activeChat
							? (typingState[activeChat.contactId]?.isTyping ??
								false)
							: false
					}
					isSidebarCollapsed={isSidebarCollapsed}
					onToggleSidebar={() =>
						setIsSidebarCollapsed(!isSidebarCollapsed)
					}
					onClose={startClose}
					onDragMouseDown={handleMouseDown}
					onMobileBack={handleMobileBackToList}
					showMobileBack={
						isMobile() && !showMobileChatList && !!activeChat
					}
				/>

				{/* Контент чата */}
				<div className={styles.chatContent}>
					{isMobile() ? (
						// На мобильных показываем либо список чатов, либо чат
						showMobileChatList ? (
							<Sidebar
								contacts={contacts}
								activeContactId={activeChat?.contactId}
								scope={scope}
								onScopeChange={setScope}
								searchQuery={searchQuery}
								onSearchChange={setSearchQuery}
								isCollapsed={false}
								onSelect={handleMobileChatSelect}
								onCreateGroup={() =>
									setIsCreateGroupModalOpen(true)
								}
								currentWorkspaceId={currentWorkspaceId}
								hideFilters={hideFilters}
							/>
						) : (
							/* Область сообщений на весь экран */
							<div className={styles.messagesContainer}>
								{!activeChat ? (
									<div className={styles.emptyState}>
										<MessageCircle size={48} />
										<p>Выберите чат</p>
									</div>
								) : (
									<>
										<Messages
											messages={messages}
											pinnedMessage={pinnedMessage}
											isLoading={isLoading}
											currentUserId={currentUser?.id}
											activeChat={
												activeChat
													? {
															name: activeChat.name,
															avatar: activeChat.avatar,
														}
													: null
											}
											endRef={messagesEndRef}
											onEdit={handleEdit}
											onDelete={handleDelete}
											onReply={handleReply}
											onTogglePin={handleTogglePin}
											onLoadMore={loadMoreMessages}
											onLoadMoreBottom={
												loadMoreMessagesBottom
											}
											onJumpToMessage={jumpToMessage}
											onResetJump={resetJump}
											isLoadingMore={isLoadingMore}
											isLoadingMoreBottom={
												isLoadingMoreBottom
											}
											hasMore={hasMore}
											hasMoreBottom={hasMoreBottom}
											isJumped={isJumped}
										/>
										<Input
											value={newMessage}
											disabled={isSending}
											onChange={setNewMessage}
											onSend={() => void handleSend()}
											onKeyDown={handleKeyDown}
											isEditing={!!editingMessage}
											replyingToMessage={
												replyingToMessage
											}
											attachments={attachments}
											onUpload={handleUpload}
											onRemoveAttachment={
												removeAttachment
											}
											onCancelEdit={handleCancelEdit}
											onCancelReply={handleCancelReply}
											isUploading={isUploading}
											currentUserId={currentUser?.id}
											fallbackAuthorName={
												activeChat?.name
											}
										/>
									</>
								)}
							</div>
						)
					) : (
						// На десктопе показываем как раньше
						<>
							<Sidebar
								contacts={contacts}
								activeContactId={activeChat?.contactId}
								scope={scope}
								onScopeChange={setScope}
								searchQuery={searchQuery}
								onSearchChange={setSearchQuery}
								isCollapsed={isSidebarCollapsed}
								onSelect={(id) => setActiveChat(id)}
								onCreateGroup={() =>
									setIsCreateGroupModalOpen(true)
								}
								currentWorkspaceId={currentWorkspaceId}
								hideFilters={hideFilters}
							/>

							{/* Область сообщений */}
							<div className={styles.messagesContainer}>
								{!activeChat ? (
									<div className={styles.emptyState}>
										<MessageCircle size={48} />
										<p>Выберите чат</p>
									</div>
								) : (
									<>
										<Messages
											messages={messages}
											pinnedMessage={pinnedMessage}
											isLoading={isLoading}
											currentUserId={currentUser?.id}
											activeChat={
												activeChat
													? {
															name: activeChat.name,
															avatar: activeChat.avatar,
														}
													: null
											}
											endRef={messagesEndRef}
											onEdit={handleEdit}
											onDelete={handleDelete}
											onReply={handleReply}
											onTogglePin={handleTogglePin}
											onLoadMore={loadMoreMessages}
											onLoadMoreBottom={
												loadMoreMessagesBottom
											}
											onJumpToMessage={jumpToMessage}
											onResetJump={resetJump}
											isLoadingMore={isLoadingMore}
											isLoadingMoreBottom={
												isLoadingMoreBottom
											}
											hasMore={hasMore}
											hasMoreBottom={hasMoreBottom}
											isJumped={isJumped}
										/>
										<Input
											value={newMessage}
											disabled={isSending}
											onChange={setNewMessage}
											onSend={() => void handleSend()}
											onKeyDown={handleKeyDown}
											isEditing={!!editingMessage}
											replyingToMessage={
												replyingToMessage
											}
											attachments={attachments}
											onUpload={handleUpload}
											onRemoveAttachment={
												removeAttachment
											}
											onCancelEdit={handleCancelEdit}
											onCancelReply={handleCancelReply}
											isUploading={isUploading}
											currentUserId={currentUser?.id}
											fallbackAuthorName={
												activeChat?.name
											}
										/>
									</>
								)}
							</div>
						</>
					)}
				</div>
			</div>
			{isCreateGroupModalOpen && (
				<CreateGroupModal
					onClose={() => setIsCreateGroupModalOpen(false)}
					onCreate={handleCreateGroup}
				/>
			)}
			<ConfirmModal
				open={!!deleteTarget}
				title="Удалить сообщение"
				message="Вы уверены, что хотите удалить это сообщение? Это действие нельзя отменить."
				confirmLabel="Удалить"
				cancelLabel="Отмена"
				variant="danger"
				loading={isDeleting}
				onConfirm={() => void handleConfirmDelete()}
				onCancel={handleCancelDelete}
			/>
		</>,
		document.body,
	);
};

export default Chat;
