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
} from "lucide-react";
import type { Message } from "@shared/types/message";

export interface MessagesProps {
	messages: Message[];
	isLoading: boolean;
	currentUserId?: number;
	activeChat: { name: string; avatar?: string } | null;
	endRef: RefObject<HTMLDivElement | null>;
	onEdit?: (msg: Message) => void;
	onDelete?: (msgId: number, isGroup: boolean) => void;
	onReply?: (msg: Message) => void;
	onTogglePin?: (msg: Message) => void;
}

const MessageItem: FC<{
	msg: Message;
	isOwn: boolean;
	activeChat: { name: string; avatar?: string } | null;
	onEdit?: (msg: Message) => void;
	onDelete?: (msgId: number, isGroup: boolean) => void;
	onReply?: (msg: Message) => void;
	onTogglePin?: (msg: Message) => void;
	positionInGroup?: "top" | "middle" | "bottom" | "single";
}> = ({
	msg,
	isOwn,
	activeChat,
	onEdit,
	onDelete,
	onReply,
	onTogglePin,
	positionInGroup = "single",
}) => {
	const isGroupMsg = msg.chat_id != null;
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
	const menuOptions = [
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
			icon: msg.is_pinned ? <PinOff size={14} /> : <Pin size={14} />,
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

	const handleMenuAction = (action: string) => {
		switch (action) {
			case "reply":
				onReply?.(msg);
				break;
			case "copy":
				navigator.clipboard.writeText(msg.content);
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
						<div className={styles.repliedMessage}>
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
	isLoading,
	currentUserId,
	activeChat,
	endRef,
	onEdit,
	onDelete,
	onReply,
	onTogglePin,
}) => {
	const messageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());

	const setMessageRef = (id: number) => (el: HTMLDivElement | null) => {
		messageRefs.current.set(id, el);
	};

	const scrollToMessage = (id: number) => {
		const el = messageRefs.current.get(id);
		if (el) {
			el.scrollIntoView({ behavior: "auto", block: "center" });
		}
	};
	// Функция для форматирования даты разделителя
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

	// Получаем список закрепленных сообщений
	const pinnedMessages = messages.filter((msg) => msg.is_pinned);

	return (
		<div className={styles.messagesContainer}>
			{/* Баннер закрепленных сообщений */}
			{pinnedMessages.length > 0 && (
				<div
					className={styles.pinnedBanner}
					onClick={() => scrollToMessage(pinnedMessages[0].id)}
				>
					<Pin size={16} className={styles.pinnedIcon} />
					<div className={styles.pinnedContent}>
						<span className={styles.pinnedTitle}>
							Закрепленное сообщение
						</span>
						<span className={styles.pinnedText}>
							{pinnedMessages[0].content.length > 50
								? pinnedMessages[0].content.substring(0, 50) +
									"..."
								: pinnedMessages[0].content || "Вложение"}
						</span>
					</div>
					<button
						className={styles.unpinBtn}
						onClick={(e) => {
							e.stopPropagation();
							onTogglePin?.(pinnedMessages[0]);
						}}
						title="Открепить"
					>
						<PinOff size={14} />
					</button>
				</div>
			)}

			<div className={styles.messagesArea}>
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

						// Логика группировки сообщений
						const prevMsg = index > 0 ? messages[index - 1] : null;
						const nextMsg =
							index < messages.length - 1
								? messages[index + 1]
								: null;

						// Проверка на смену дня
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

						// Разница во времени менее 5 минут для группировки
						const isTimeCloseToPrev =
							prevMsg &&
							msgDate.getTime() - prevMsgDate!.getTime() <
								5 * 60 * 1000;
						const isTimeCloseToNext =
							nextMsg &&
							new Date(nextMsg.created_at).getTime() -
								msgDate.getTime() <
								5 * 60 * 1000;

						// Группируем только если это тот же день
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
									positionInGroup={positionInGroup}
								/>
							</div>
						);
					})
				)}
				<div ref={endRef} />
			</div>
		</div>
	);
};

export default Messages;
