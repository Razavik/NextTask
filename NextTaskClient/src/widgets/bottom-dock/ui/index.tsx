import { FC, useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
	LayoutGrid,
	CalendarClock,
	Settings,
	User as UserIcon,
	MessageSquare,
	LogOut,
} from "lucide-react";
import styles from "./index.module.css";
import glass from "@shared/styles/glass.module.css";
import type { User } from "@entities/user";
import { authService } from "@entities/user";
import { useChatStore, selectTotalUnreadCount } from "@entities/chat";

interface BottomDockProps {
	user: User;
}

const BottomDock: FC<BottomDockProps> = ({ user }) => {
	const navigate = useNavigate();
	const location = useLocation();
	const { toggleChat, isOpen } = useChatStore();
	const totalUnread = useChatStore(selectTotalUnreadCount);

	const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
	const profileMenuRef = useRef<HTMLDivElement>(null);

	// Закрытие меню при клике вне
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				profileMenuRef.current &&
				!profileMenuRef.current.contains(event.target as Node)
			) {
				setIsProfileMenuOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside);
		return () =>
			document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleLogout = () => {
		authService.logout();
		navigate("/login");
	};

	const items = [
		{
			id: "workspaces",
			icon: <LayoutGrid size={24} />,
			label: "Воркспейсы",
			action: () => navigate("/"),
			isActive:
				location.pathname === "/" ||
				location.pathname.startsWith("/workspaces"),
		},
		{
			id: "chat",
			icon: (
				<div style={{ position: "relative" }}>
					<MessageSquare size={24} />
					{totalUnread > 0 && (
						<span className={styles.badge}>
							{totalUnread > 99 ? "99+" : totalUnread}
						</span>
					)}
				</div>
			),
			label: "Чат",
			action: toggleChat,
			isActive: isOpen,
		},
		{
			id: "planning",
			icon: <CalendarClock size={24} />,
			label: "Планирование",
			action: () => navigate("/planning"),
			isActive: location.pathname.startsWith("/planning"),
		},
		{
			id: "settings",
			icon: <Settings size={24} />,
			label: "Настройки",
			action: () => navigate("/settings"),
			isActive: location.pathname.startsWith("/settings"),
		},
		{
			id: "profile",
			icon: user.avatar ? (
				<img
					src={user.avatar}
					alt={user.name || "User"}
					className={styles.avatarImg}
				/>
			) : (
				<UserIcon size={24} />
			),
			label: "Профиль",
			action: () => setIsProfileMenuOpen(!isProfileMenuOpen),
			isActive:
				location.pathname.startsWith("/profile") || isProfileMenuOpen,
		},
	];

	return (
		<div className={styles.dockContainer}>
			<div style={{ position: "relative" }}>
				{isProfileMenuOpen && (
					<div className={styles.profileMenu} ref={profileMenuRef}>
						<button
							className={styles.profileMenuItem}
							onClick={() => {
								setIsProfileMenuOpen(false);
								navigate("/profile");
							}}
						>
							<UserIcon size={16} />
							Мой профиль
						</button>
						<button
							className={`${styles.profileMenuItem} ${styles.logoutItem}`}
							onClick={handleLogout}
						>
							<LogOut size={16} />
							Выйти
						</button>
					</div>
				)}
				<nav className={`${styles.dock} ${glass.glassSurface}`}>
					{items.map((item) => (
						<div key={item.id} className={styles.dockItemWrapper}>
							<button
								className={`${styles.dockItem} ${
									item.isActive ? styles.active : ""
								}`}
								onClick={item.action}
								aria-label={item.label}
							>
								{item.icon}
								{item.isActive && (
									<span className={styles.activeDot} />
								)}
							</button>
							<span className={styles.tooltip}>{item.label}</span>
						</div>
					))}
				</nav>
			</div>
		</div>
	);
};

export default BottomDock;
