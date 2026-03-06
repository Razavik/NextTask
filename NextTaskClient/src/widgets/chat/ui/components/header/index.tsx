import { FC } from "react";
import {
	Users,
	MessageCircle,
	ChevronLeft,
	ChevronRight,
	X,
	ArrowLeft,
} from "lucide-react";
import styles from "./index.module.css";

export interface ChatHeaderProps {
	activeChat: {
		type: "personal" | "group";
		name: string;
		avatar?: string;
	} | null;
	isSidebarCollapsed: boolean;
	onToggleSidebar: () => void;
	onClose: () => void;
	onDragMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
	onMobileBack?: () => void; // Для кнопки "назад" на мобильных
	showMobileBack?: boolean; // Показывать ли кнопку "назад"
}

const Header: FC<ChatHeaderProps> = ({
	activeChat,
	isSidebarCollapsed,
	onToggleSidebar,
	onClose,
	onDragMouseDown,
	onMobileBack,
	showMobileBack,
}) => {
	return (
		<div className={styles.header} onMouseDown={onDragMouseDown}>
			<div className={styles.recipientInfo}>
				{showMobileBack && onMobileBack && (
					<button
						onClick={onMobileBack}
						className={styles.mobileBackBtn}
						title="Назад к чатам"
					>
						<ArrowLeft size={20} />
					</button>
				)}
				<div className={styles.recipientAvatarPlaceholder}>
					{activeChat ? (
						activeChat.type === "group" ? (
							<Users size={20} />
						) : activeChat.avatar ? (
							<img
								src={activeChat.avatar}
								alt={activeChat.name}
								className={styles.headerAvatar}
							/>
						) : (
							<span>
								{activeChat.name.charAt(0).toUpperCase()}
							</span>
						)
					) : (
						<MessageCircle size={20} />
					)}
				</div>
				<div className={styles.recipientDetails}>
					<div className={styles.recipientName}>
						{activeChat ? activeChat.name : "Чаты"}
					</div>
					<div className={styles.recipientStatus}>
						{activeChat
							? activeChat.type === "group"
								? "Групповой чат"
								: "Личный чат"
							: ""}
					</div>
				</div>
			</div>
			<div className={styles.headerActions}>
				<button
					onClick={onToggleSidebar}
					className={styles.iconBtn}
					title={
						isSidebarCollapsed
							? "Развернуть панель"
							: "Свернуть панель"
					}
				>
					{isSidebarCollapsed ? (
						<ChevronRight size={18} />
					) : (
						<ChevronLeft size={18} />
					)}
				</button>
				<button
					onClick={onClose}
					className={styles.iconBtn}
					title="Закрыть"
				>
					<X size={18} />
				</button>
			</div>
		</div>
	);
};

export default Header;
