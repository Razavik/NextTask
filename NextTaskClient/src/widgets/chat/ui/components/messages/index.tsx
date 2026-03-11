import {
	FC,
	RefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import common from "@widgets/chat/ui/index.module.css";
import styles from "./index.module.css";
import Loader from "@shared/ui/loader";
import ContextMenu from "@shared/ui/context-menu";
import {
	MessageCircle,
	Edit,
	Trash2,
	Copy,
	Reply,
	Pin,
	PinOff,
	Check,
	CheckCheck,
	ArrowDown,
} from "lucide-react";
import type { Message } from "@shared/types/message";
import {
	useToastStore,
	createSuccessToast,
	createErrorToast,
} from "@shared/model/toastStore";

export interface MessagesProps {
	messages: Message[];
	pinnedMessage: Message | null;
	isLoading: boolean;
	currentUserId?: number;
	activeChat: { name: string; avatar?: string } | null;
	endRef: RefObject<HTMLDivElement | null>;
	onEdit?: (msg: Message) => void;
	onDelete?: (msgId: number, isGroup: boolean) => void;
	onReply?: (msg: Message) => void;
	onTogglePin?: (msg: Message) => void;
	onLoadMore?: () => void;
	onLoadMoreBottom?: () => void;
	onJumpToMessage?: (messageId: number) => void;
	onResetJump?: () => void;
	isLoadingMore?: boolean;
	isLoadingMoreBottom?: boolean;
	hasMore?: boolean;
	hasMoreBottom?: boolean;
	isJumped?: boolean;
}

const MessageItem: FC<{
	msg: Message;
	isOwn: boolean;
	activeChat: { name: string; avatar?: string } | null;
	onEdit?: (msg: Message) => void;
	onDelete?: (msgId: number, isGroup: boolean) => void;
	onReply?: (msg: Message) => void;
	onTogglePin?: (msg: Message) => void;
	onJumpToMessage?: (messageId: number) => void;
	positionInGroup?: "top" | "middle" | "bottom" | "single";
}> = ({
	msg,
	isOwn,
	activeChat,
	onEdit,
	onDelete,
	onReply,
	onTogglePin,
	onJumpToMessage,
	positionInGroup = "single",
}) => {
	const isGroupMsg = msg.chat_id != null;
	const isPendingMessage = msg.id > 1_000_000_000_000;
	const isReadByPeer = !isGroupMsg && isOwn && !!msg.is_read;
	const addToast = useToastStore((state) => state.addToast);
	const textRef = useRef<HTMLDivElement>(null);
	const [stackMeta, setStackMeta] = useState(true);
	const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

	const compute = () => {
		const el = textRef.current;
		if (!el) {
			setStackMeta(false);
			return;
		}
		const cs = getComputedStyle(el);
		const lh = parseFloat(cs.lineHeight || "0");
		const h = el.clientHeight;
		const lines = lh > 0 ? Math.round(h / lh) : 1;
		const isMulti = lines >= 2;
		const nearOverflow = el.scrollWidth - el.clientWidth > 8;
		const longSingle = (el.textContent || "").length > 26;
		setStackMeta(isMulti || nearOverflow || longSingle);
	};

	useLayoutEffect(() => {
		compute();
	}, [msg.content]);

	useEffect(() => {
		const onResize = () => compute();
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	// Опции контекстного меню
	const menuOptions = isPendingMessage
		? [
				{
					value: "pending",
					label: "Дождитесь отправки сообщения",
				},
			]
		: [
				{
					value: "reply",
					label: "Ответить",
					icon: <Reply size={14} />,
				},
				{
					value: "copy",
					label: "Копировать",
					icon: <Copy size={14} />,
				},
				{
					value: "pin",
					label: msg.is_pinned ? "Открепить" : "Закрепить",
					icon: msg.is_pinned ? (
						<PinOff size={14} />
					) : (
						<Pin size={14} />
					),
				},
				...(isOwn
					? [
							{
								value: "edit",
								label: "Редактировать",
								icon: <Edit size={14} />,
							},
							{
								value: "delete",
								label: "Удалить",
								icon: <Trash2 size={14} />,
								danger: true,
							},
						]
					: []),
			];
	const handleMenuAction = async (action: string) => {
		if (isPendingMessage) {
			return;
		}
		switch (action) {
			case "reply":
				onReply?.(msg);
				break;
			case "copy":
				try {
					await navigator.clipboard.writeText(msg.content);
					addToast(
						createSuccessToast(
							"Скопировано",
							"Сообщение скопировано",
						),
					);
				} catch {
					addToast(
						createErrorToast(
							"Ошибка",
							"Не удалось скопировать сообщение",
						),
					);
				}
				break;
			case "pin":
				onTogglePin?.(msg);
				break;
			case "edit":
				onEdit?.(msg);
				break;
			case "delete":
				onDelete?.(msg.id, isGroupMsg);
				break;
		}
	};

	// Determine base URL for uploads
	const getFullUrl = (url: string) => {
		if (url.startsWith("http")) return url;
		const base = import.meta.env.VITE_API_URL || "http://localhost:8000";
		const cleanBase = base.replace(/\/$/, "");
		const cleanUrl = url.startsWith("/") ? url : `/${url}`;
		return `${cleanBase}${cleanUrl}`;
	};

	const isGrouped = positionInGroup === "top" || positionInGroup === "middle";
	const hideAvatar =
		!isOwn && (positionInGroup === "top" || positionInGroup === "middle");
	const showSender =
		isGroupMsg &&
		!isOwn &&
		msg.sender &&
		(positionInGroup === "top" || positionInGroup === "single");

	const messageClasses = [
		styles.message,
		isOwn ? styles.messageOwn : styles.messageOther,
		isGrouped ? styles.grouped : "",
		positionInGroup === "top" ? styles.groupedTop : "",
		positionInGroup === "middle" ? styles.groupedMiddle : "",
		positionInGroup === "bottom" ? styles.groupedBottom : "",
	]
		.filter(Boolean)
		.join(" ");

	const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault();
		e.stopPropagation();
		setIsContextMenuOpen(true);
	};

	return (
		<div className={messageClasses} onContextMenu={handleContextMenu}>
			{!isOwn && (
				<div
					className={`${styles.messageAvatar} ${hideAvatar ? styles.avatarHidden : ""}`}
				>
					{msg.sender?.avatar ? (
						<img
							src={msg.sender.avatar}
							alt={msg.sender.name}
							className={styles.avatarImage}
						/>
					) : msg.sender ? (
						(msg.sender.name || "?").charAt(0).toUpperCase()
					) : activeChat?.avatar ? (
						<img
							src={activeChat.avatar}
							alt={activeChat.name}
							className={styles.avatarImage}
						/>
					) : (
						activeChat?.name.charAt(0).toUpperCase()
					)}
				</div>
			)}
			<div className={styles.messageBody}>
				<div className={styles.messageBox}>
					{msg.replied_message && (
						<div
							className={styles.repliedMessage}
							onClick={() =>
								onJumpToMessage?.(msg.replied_message!.id)
							}
						>
							<div className={styles.repliedLine}></div>
							<div className={styles.repliedContent}>
								<div className={styles.repliedSender}>
									{msg.replied_message.sender?.name ||
										"Пользователь"}
								</div>
								<div className={styles.repliedText}>
									{msg.replied_message.content.length > 50
										? msg.replied_message.content.substring(
												0,
												50,
											) + "..."
										: msg.replied_message.content ||
											"Вложение"}
								</div>
							</div>
						</div>
					)}
					{msg.attachments && msg.attachments.length > 0 && (
						<div className={styles.messageAttachmentsContainer}>
							<div
								className={`${styles.messageAttachments} ${
									msg.attachments.length === 1
										? styles.singleAttachment
										: msg.attachments.length === 2
											? styles.doubleAttachment
											: msg.attachments.length === 3
												? styles.tripleAttachment
												: styles.multiAttachment
								}`}
							>
								{msg.attachments.map((url, idx) => (
									<img
										key={idx}
										src={getFullUrl(url)}
										alt="attachment"
										className={styles.attachmentImg}
										onClick={() =>
											window.open(
												getFullUrl(url),
												"_blank",
											)
										}
									/>
								))}
							</div>
						</div>
					)}
					{(!msg.attachments ||
						msg.attachments.length === 0 ||
						msg.content) && (
						<div
							className={`${styles.messageContentWrap} ${stackMeta ? styles.stackMeta : styles.inlineMeta}`}
						>
							<div className={styles.messageContent}>
								{showSender && (
									<div className={styles.messageSender}>
										{msg.sender!.name}
									</div>
								)}
								{msg.content && (
									<div
										ref={textRef}
										className={styles.messageText}
									>
										{msg.content}
									</div>
								)}
							</div>
							<div className={styles.messageMeta}>
								{isPendingMessage && (
									<span
										className={styles.pendingBadge}
										title="Сообщение отправляется"
									>
										<span
											className={styles.pendingSpinner}
										/>
									</span>
								)}
								{msg.is_edited && (
									<span className={styles.editedLabel}>
										изменено
									</span>
								)}
								<span className={styles.messageTime}>
									{new Date(
										msg.created_at,
									).toLocaleTimeString("ru-RU", {
										hour: "2-digit",
										minute: "2-digit",
									})}
								</span>
								{!isGroupMsg && isOwn && !isPendingMessage && (
									<span
										className={`${styles.readStatus} ${isReadByPeer ? styles.readStatusDone : ""}`}
										title={
											isReadByPeer
												? "Прочитано"
												: "Доставлено"
										}
									>
										{isReadByPeer ? (
											<CheckCheck size={14} />
										) : (
											<Check size={14} />
										)}
									</span>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
			<ContextMenu
				options={menuOptions}
				onSelect={handleMenuAction}
				isOpen={isContextMenuOpen}
				onOpenChange={setIsContextMenuOpen}
			/>
		</div>
	);
};

const Messages: FC<MessagesProps> = ({
	messages,
	pinnedMessage,
	isLoading,
	currentUserId,
	activeChat,
	endRef,
	onEdit,
	onDelete,
	onReply,
	onTogglePin,
	onLoadMore,
	onLoadMoreBottom,
	onJumpToMessage,
	onResetJump,
	isLoadingMore,
	isLoadingMoreBottom,
	hasMore,
	hasMoreBottom,
	isJumped,
}) => {
	const messageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const bottomLoadTriggeredRef = useRef(false);
	const [showScrollToBottom, setShowScrollToBottom] = useState(false);
	const [pendingScrollMessageId, setPendingScrollMessageId] = useState<
		number | null
	>(null);

	const setMessageRef = (id: number) => (el: HTMLDivElement | null) => {
		messageRefs.current.set(id, el);
	};

	const scrollToMessage = (id: number) => {
		const el = messageRefs.current.get(id);
		if (el) {
			el.scrollIntoView({ behavior: "auto", block: "center" });
			// Подсветка сообщения
			el.style.backgroundColor = "var(--hover-bg)";
			el.style.transition = "background-color 0.3s";
			setTimeout(() => {
				el.style.backgroundColor = "transparent";
			}, 1500);
		} else if (onJumpToMessage) {
			setPendingScrollMessageId(id);
			onJumpToMessage(id);
		}
	};

	useEffect(() => {
		if (pendingScrollMessageId == null || isLoading) return;
		const el = messageRefs.current.get(pendingScrollMessageId);
		if (!el) return;
		el.scrollIntoView({ behavior: "auto", block: "center" });
		el.style.backgroundColor = "var(--hover-bg)";
		el.style.transition = "background-color 0.3s";
		setTimeout(() => {
			el.style.backgroundColor = "transparent";
		}, 1500);
		setPendingScrollMessageId(null);
	}, [messages, isLoading, pendingScrollMessageId]);
	const formatDateSeparator = (dateStr: string) => {
		const date = new Date(dateStr);
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		if (date.toDateString() === today.toDateString()) {
			return "Сегодня";
		} else if (date.toDateString() === yesterday.toDateString()) {
			return "Вчера";
		} else {
			return date.toLocaleDateString("ru-RU", {
				day: "numeric",
				month: "long",
				year:
					date.getFullYear() !== today.getFullYear()
						? "numeric"
						: undefined,
			});
		}
	};

	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const target = e.currentTarget;
		if (target.scrollTop <= 50 && hasMore && !isLoadingMore && onLoadMore) {
			onLoadMore();
		}
		const distanceToBottom =
			target.scrollHeight - target.scrollTop - target.clientHeight;
		setShowScrollToBottom(distanceToBottom > 120);
		if (distanceToBottom > 120) {
			bottomLoadTriggeredRef.current = false;
		}
		if (
			distanceToBottom <= 50 &&
			isJumped &&
			hasMoreBottom &&
			!isLoadingMoreBottom &&
			onLoadMoreBottom &&
			!bottomLoadTriggeredRef.current
		) {
			bottomLoadTriggeredRef.current = true;
			onLoadMoreBottom();
		}
	};

	useEffect(() => {
		if (!isJumped) {
			bottomLoadTriggeredRef.current = false;
		}
	}, [isJumped]);

	const handleScrollToBottom = () => {
		if (isJumped && onResetJump) {
			onResetJump();
			return;
		}

		endRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	return (
		<div className={styles.messagesContainer}>
			{pinnedMessage && (
				<div
					className={styles.pinnedBanner}
					onClick={() => scrollToMessage(pinnedMessage.id)}
				>
					<Pin size={16} className={styles.pinnedIcon} />
					<div className={styles.pinnedContent}>
						<span className={styles.pinnedTitle}>
							Закрепленное сообщение
						</span>
						<span className={styles.pinnedText}>
							{pinnedMessage.content.length > 50
								? pinnedMessage.content.substring(0, 50) + "..."
								: pinnedMessage.content || "Вложение"}
						</span>
					</div>
					<button
						className={styles.unpinBtn}
						onClick={(e) => {
							e.stopPropagation();
							onTogglePin?.(pinnedMessage);
						}}
						title="Открепить"
					>
						<PinOff size={14} />
					</button>
				</div>
			)}

			<div
				ref={scrollContainerRef}
				onScroll={handleScroll}
				className={`${styles.messagesArea} ${
					pinnedMessage ? styles.messagesAreaWithPinned : ""
				}`}
			>
				{isLoadingMore && (
					<div className={styles.loadingMore}>
						<Loader size="small" />
					</div>
				)}
				{isLoading ? (
					<div className={styles.centerWrap}>
						<div className={common.loadingState}>
							<Loader size="large" />
						</div>
					</div>
				) : messages.length === 0 ? (
					<div className={styles.centerWrap}>
						<div className={common.emptyState}>
							<MessageCircle size={48} />
							<p>Начните переписку</p>
						</div>
					</div>
				) : (
					messages.map((msg, index) => {
						const isOwn = msg.sender_id === currentUserId;

						// Р›РѕРіРёРєР° РіСЂСѓРїРїРёСЂРѕРІРєРё СЃРѕРѕР±С‰РµРЅРёР№
						const prevMsg = index > 0 ? messages[index - 1] : null;
						const nextMsg =
							index < messages.length - 1
								? messages[index + 1]
								: null;

						// РџСЂРѕРІРµСЂРєР° РЅР° СЃРјРµРЅСѓ РґРЅСЏ
						const msgDate = new Date(msg.created_at);
						const prevMsgDate = prevMsg
							? new Date(prevMsg.created_at)
							: null;
						const isNewDay =
							!prevMsgDate ||
							msgDate.toDateString() !==
								prevMsgDate.toDateString();

						const isSameSenderAsPrev =
							prevMsg &&
							prevMsg.sender_id === msg.sender_id &&
							!isNewDay;
						const isSameSenderAsNext =
							nextMsg && nextMsg.sender_id === msg.sender_id;

						// Р Р°Р·РЅРёС†Р° РІРѕ РІСЂРµРјРµРЅРё РјРµРЅРµРµ 5 РјРёРЅСѓС‚ РґР»СЏ РіСЂСѓРїРїРёСЂРѕРІРєРё
						const isTimeCloseToPrev =
							prevMsg &&
							msgDate.getTime() - prevMsgDate!.getTime() <
								5 * 60 * 1000;
						const isTimeCloseToNext =
							nextMsg &&
							new Date(nextMsg.created_at).getTime() -
								msgDate.getTime() <
								5 * 60 * 1000;

						// Р“СЂСѓРїРїРёСЂСѓРµРј С‚РѕР»СЊРєРѕ РµСЃР»Рё СЌС‚Рѕ С‚РѕС‚ Р¶Рµ РґРµРЅСЊ
						const isGroupedWithPrev =
							isSameSenderAsPrev &&
							isTimeCloseToPrev &&
							!isNewDay;
						const isGroupedWithNext =
							isSameSenderAsNext && isTimeCloseToNext;

						let positionInGroup:
							| "single"
							| "top"
							| "middle"
							| "bottom" = "single";
						if (isGroupedWithPrev && isGroupedWithNext) {
							positionInGroup = "middle";
						} else if (isGroupedWithNext) {
							positionInGroup = "top";
						} else if (isGroupedWithPrev) {
							positionInGroup = "bottom";
						}

						return (
							<div key={msg.id} ref={setMessageRef(msg.id)}>
								{isNewDay && (
									<div className={styles.dateSeparator}>
										<span>
											{formatDateSeparator(
												msg.created_at,
											)}
										</span>
									</div>
								)}
								<MessageItem
									msg={msg}
									isOwn={isOwn}
									activeChat={activeChat}
									onEdit={onEdit}
									onDelete={onDelete}
									onReply={onReply}
									onTogglePin={onTogglePin}
									onJumpToMessage={scrollToMessage}
									positionInGroup={positionInGroup}
								/>
							</div>
						);
					})
				)}
				{isLoadingMoreBottom && (
					<div className={styles.loadingMore}>
						<Loader size="small" />
					</div>
				)}
				{showScrollToBottom && (
					<div className={styles.jumpResetWrap}>
						<button
							className={styles.jumpResetBtn}
							onClick={handleScrollToBottom}
						>
							<ArrowDown size={24} />
						</button>
					</div>
				)}
				<div ref={endRef} />
			</div>
		</div>
	);
};

export default Messages;
