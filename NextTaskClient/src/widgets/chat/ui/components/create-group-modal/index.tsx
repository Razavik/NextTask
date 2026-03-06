import { FC, useState, useEffect } from "react";
import styles from "./index.module.css";
import { X } from "lucide-react";
import Button from "@shared/ui/button";
import api from "@shared/api/axios";
import { useAuthStore } from "@entities/user";
import type { User } from "@entities/user";
import Loader from "@shared/ui/loader";

interface CreateGroupModalProps {
	onClose: () => void;
	onCreate: (name: string, userIds: number[]) => void;
}

const CreateGroupModal: FC<CreateGroupModalProps> = ({ onClose, onCreate }) => {
	const [name, setName] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [allUsers, setAllUsers] = useState<User[]>([]);
	const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
	const [isLoading, setIsLoading] = useState(false);
	const currentUser = useAuthStore((state) => state.user);

	// Debounce-поиск пользователей на сервере
	useEffect(() => {
		let cancelled = false;

		const query = searchQuery.trim();
		if (!query) {
			setAllUsers([]);
			setIsLoading(false);
			return () => {
				cancelled = true;
			};
		}

		setIsLoading(true);
		const timer = setTimeout(async () => {
			try {
				const { data } = await api.get<User[]>("/users", {
					params: { search: query },
				});
				if (cancelled) return;
				setAllUsers(data.filter((u: User) => u.id !== currentUser?.id));
			} catch (error) {
				if (!cancelled) console.error("Failed to load users:", error);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		}, 300);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [searchQuery, currentUser?.id]);

	const toggleUser = (userId: number) => {
		const newSet = new Set(selectedUsers);
		if (newSet.has(userId)) {
			newSet.delete(userId);
		} else {
			newSet.add(userId);
		}
		setSelectedUsers(newSet);
	};

	const handleCreate = () => {
		if (!name.trim()) return;
		onCreate(name.trim(), Array.from(selectedUsers));
	};

	const filteredUsers = allUsers; // фильтрация теперь на сервере

	return (
		<div className={styles.overlay} onClick={onClose}>
			<div className={styles.modal} onClick={(e) => e.stopPropagation()}>
				<div className={styles.header}>
					<h3>Создать группу</h3>
					<button className={styles.closeBtn} onClick={onClose}>
						<X size={20} />
					</button>
				</div>

				<div className={styles.content}>
					<div className={styles.inputGroup}>
						<label>Название чата</label>
						<input
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Введите название..."
							autoFocus
						/>
					</div>

					<div className={styles.inputGroup}>
						<label>Участники</label>
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Поиск по email или имени..."
						/>
					</div>

					{searchQuery.trim() ? (
						<div className={styles.usersList}>
							{isLoading ? (
								<div className={styles.emptyState}>
									<Loader />
								</div>
							) : filteredUsers.length === 0 ? (
								<div className={styles.emptyState}>
									Ничего не найдено
								</div>
							) : (
								filteredUsers.map((user) => (
									<div
										key={user.id}
										className={`${styles.userItem} ${
											selectedUsers.has(user.id)
												? styles.selected
												: ""
										}`}
										onClick={() => toggleUser(user.id)}
									>
										<div className={styles.userAvatar}>
											{user.avatar ? (
												<img
													src={user.avatar}
													alt={user.name}
												/>
											) : (
												<span>
													{(user.name || user.email)
														.charAt(0)
														.toUpperCase()}
												</span>
											)}
										</div>
										<div className={styles.userInfo}>
											<span className={styles.userName}>
												{user.name || "Без имени"}
											</span>
											<span className={styles.userEmail}>
												{user.email}
											</span>
										</div>
										<div className={styles.checkbox}>
											{selectedUsers.has(user.id) && (
												<div
													className={styles.checked}
												/>
											)}
										</div>
									</div>
								))
							)}
						</div>
					) : (
						<div className={styles.emptyState}>
							Начните вводить, чтобы найти участников
						</div>
					)}
				</div>

				<div className={styles.footer}>
					<Button variant="ghost" onClick={onClose}>
						Отмена
					</Button>
					<Button
						onClick={handleCreate}
						disabled={!name.trim() || isLoading}
					>
						Создать
					</Button>
				</div>
			</div>
		</div>
	);
};

export default CreateGroupModal;
