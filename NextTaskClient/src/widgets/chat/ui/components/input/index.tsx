import { FC, KeyboardEvent, useRef } from "react";
import Textarea from "@shared/ui/textarea";
import Button from "@shared/ui/button";
import {
	Send,
	Paperclip,
	X,
	Image as ImageIcon,
	Edit2,
	Reply,
} from "lucide-react";
import styles from "./index.module.css";
import type { Message } from "@shared/types/message";

interface InputProps {
	value: string;
	disabled?: boolean;
	onChange: (v: string) => void;
	onSend: () => void;
	onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
	// New props
	isEditing?: boolean;
	replyingToMessage?: Message | null;
	attachments?: string[];
	onUpload?: (file: File) => void;
	onRemoveAttachment?: (url: string) => void;
	onCancelEdit?: () => void;
	onCancelReply?: () => void;
	isUploading?: boolean;
	currentUserId?: number;
	fallbackAuthorName?: string;
}

const Input: FC<InputProps> = ({
	value,
	disabled,
	onChange,
	onSend,
	onKeyDown,
	isEditing,
	replyingToMessage,
	attachments = [],
	onUpload,
	onRemoveAttachment,
	onCancelEdit,
	onCancelReply,
	isUploading,
	currentUserId,
	fallbackAuthorName,
}) => {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const replyAuthor = (() => {
		if (!replyingToMessage) return "";
		const sender = replyingToMessage.sender;
		if (sender?.name) return sender.name;
		if (sender?.email) return sender.email;
		if (
			replyingToMessage.sender_id &&
			replyingToMessage.sender_id === currentUserId
		)
			return "Вы";
		if (fallbackAuthorName) return fallbackAuthorName;
		return "Без имени";
	})();

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files[0]) {
			onUpload?.(e.target.files[0]);
		}
		// Reset value so same file can be selected again
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	// Determine base URL for uploads
	const getFullUrl = (url: string) => {
		if (url.startsWith("http")) return url;
		const base = import.meta.env.VITE_API_URL || "http://localhost:8000";
		// Ensure base doesn't have trailing slash and url starts with slash
		const cleanBase = base.replace(/\/$/, "");
		const cleanUrl = url.startsWith("/") ? url : `/${url}`;
		return `${cleanBase}${cleanUrl}`;
	};

	return (
		<div className={styles.container}>
			{(isEditing || replyingToMessage) && (
				<div className={styles.editBar}>
					<div className={styles.editInfo}>
						{isEditing ? (
							<Edit2 size={20} className={styles.editIcon} />
						) : (
							<Reply size={20} className={styles.editIcon} />
						)}
						<div className={styles.actionLine}></div>
						<div className={styles.actionContent}>
							<div className={styles.actionTitle}>
								{isEditing
									? "Редактирование сообщения"
									: replyAuthor}
							</div>
							<div className={styles.actionText}>
								{isEditing
									? "Редактировать сообщение..."
									: replyingToMessage?.content.length
										? replyingToMessage.content.length > 50
											? replyingToMessage.content.substring(
													0,
													50,
												) + "..."
											: replyingToMessage.content
										: "Вложение"}
							</div>
						</div>
					</div>
					<button
						onClick={isEditing ? onCancelEdit : onCancelReply}
						className={styles.cancelEditBtn}
					>
						<X size={20} />
					</button>
				</div>
			)}

			{attachments.length > 0 && (
				<div className={styles.attachmentsList}>
					{attachments.map((url, index) => (
						<div key={index} className={styles.attachmentItem}>
							<div className={styles.attachmentPreview}>
								<img
									src={getFullUrl(url)}
									alt="attachment"
									className={styles.attachmentImg}
									onError={(e) => {
										// Fallback for non-images
										(
											e.target as HTMLImageElement
										).style.display = "none";
										(
											e.target as HTMLImageElement
										).parentElement!.classList.add(
											styles.fallbackPreview,
										);
									}}
								/>
								<div className={styles.fileIcon}>
									<ImageIcon size={16} />
								</div>
							</div>
							<button
								className={styles.removeAttachmentBtn}
								onClick={() => onRemoveAttachment?.(url)}
							>
								<X size={12} />
							</button>
						</div>
					))}
				</div>
			)}

			<div className={styles.inputWrapper}>
				<input
					type="file"
					ref={fileInputRef}
					onChange={handleFileChange}
					style={{ display: "none" }}
					accept="image/*"
				/>

				<Textarea
					value={value}
					onChange={(e) => onChange(e.target.value)}
					onKeyDown={onKeyDown}
					placeholder="Написать сообщение..."
					disabled={disabled}
					autoGrow
					maxHeight={120}
					textareaClassName={styles.messageInput}
				/>

				<div className={styles.inputActions}>
					<Button
						variant="ghost"
						className={styles.attachBtn}
						onClick={() => fileInputRef.current?.click()}
						disabled={disabled || isUploading}
						title="Прикрепить изображение"
					>
						<Paperclip size={18} />
					</Button>
					<Button
						onClick={onSend}
						disabled={
							(!value.trim() && attachments.length === 0) ||
							!!disabled ||
							isUploading
						}
						className={styles.sendBtn}
						title={isEditing ? "Сохранить" : "Отправить"}
					>
						<Send size={18} />
					</Button>
				</div>
			</div>
		</div>
	);
};

export default Input;
