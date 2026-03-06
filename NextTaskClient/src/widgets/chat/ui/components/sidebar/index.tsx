import { FC } from "react";
import { Users, Search, MessageCircle, Plus } from "lucide-react";
import styles from "./index.module.css";
import type { ChatContact } from "@entities/chat";

interface SidebarProps {
	contacts: ChatContact[];
	activeContactId?: string;
	scope: "current" | "all";
	onScopeChange: (s: "current" | "all") => void;
	searchQuery: string;
	onSearchChange: (q: string) => void;
	isCollapsed: boolean;
	onSelect: (contactId: string) => void;
	onCreateGroup?: () => void;
	currentWorkspaceId?: number;
	hideFilters?: boolean;
}

const Sidebar: FC<SidebarProps> = ({
	contacts,
	activeContactId,
	scope,
	onScopeChange,
	searchQuery,
	onSearchChange,
	isCollapsed,
	onSelect,
	onCreateGroup,
	currentWorkspaceId,
	hideFilters,
}) => {
	const filtered = contacts.filter((c) => {
		// Фильтр по workspace (только если фильтры не скрыты)
		if (!hideFilters && scope === "current" && currentWorkspaceId) {
			// Показываем только личные сообщения и групповые чаты текущего workspace
			if (c.type === "group") {
				return c.workspaceId === currentWorkspaceId;
			} else {
				// Для личных чатов проверяем, есть ли у пользователя workspace
				return c.workspaceId === currentWorkspaceId;
			}
		}
		// При scope="all" или скрытых фильтрах показываем все чаты (без фильтрации по workspace)

		// Фильтр по поисковому запросу
		if (!searchQuery.trim()) return true;
		return c.name.toLowerCase().includes(searchQuery.toLowerCase());
	});

	return (
		<div
			className={`${styles.contactsList} ${isCollapsed ? styles.contactsListCollapsed : ""}`}
		>
			{!isCollapsed && (
				<div className={styles.contactsToolbar}>
					<div className={styles.searchBox}>
						<Search size={14} />
						<input
							className={styles.searchInput}
							placeholder="Поиск чатов"
							value={searchQuery}
							onChange={(e) => onSearchChange(e.target.value)}
						/>
					</div>
					{!hideFilters && (
						<div className={styles.filterTabs}>
							<button
								className={`${styles.filterBtn} ${scope === "all" ? styles.filterBtnActive : ""}`}
								onClick={() => onScopeChange("all")}
							>
								Все
							</button>
							<button
								className={`${styles.filterBtn} ${scope === "current" ? styles.filterBtnActive : ""}`}
								onClick={() => onScopeChange("current")}
							>
								Текущее
							</button>
						</div>
					)}
				</div>
			)}

			{filtered.map((contact) => (
				<button
					key={contact.id}
					className={`${styles.contactItem} ${
						activeContactId === contact.id
							? styles.contactItemActive
							: ""
					}`}
					onClick={() => onSelect(contact.id)}
					title={isCollapsed ? contact.name : undefined}
				>
					<div className={styles.contactAvatar}>
						{contact.type === "group" ? (
							<Users size={20} />
						) : contact.avatar ? (
							<img src={contact.avatar} alt={contact.name} />
						) : (
							<span>{contact.name.charAt(0).toUpperCase()}</span>
						)}
					</div>
					{!isCollapsed && (
						<div className={styles.contactInfo}>
							<div className={styles.contactName}>
								{contact.name}
							</div>
							<div className={styles.contactType}>
								{contact.type === "group"
									? "Групповой чат"
									: "Личный чат"}
							</div>
						</div>
					)}
					{(contact.unreadCount || 0) > 0 && (
						<div className={styles.unreadBadge}>
							{(contact.unreadCount as number) > 99
								? "99+"
								: contact.unreadCount}
						</div>
					)}
				</button>
			))}

			{!isCollapsed && onCreateGroup && (
				<button
					className={styles.createGroupBtn}
					onClick={onCreateGroup}
					title="Создать групповой чат"
				>
					<Plus size={16} />
				</button>
			)}

			{contacts.length === 0 && !isCollapsed && (
				<div className={styles.noContacts}>
					<MessageCircle size={32} />
					<p>Нет активных чатов</p>
				</div>
			)}
		</div>
	);
};

export default Sidebar;
