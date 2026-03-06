import { FC, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit, Trash, MoreVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import type { Task, TaskAssignee } from "@shared/types/task";
import { EditTaskModal } from "@features/task-edit";
import styles from "./index.module.css";

interface KanbanCardProps {
	task: Task;
	workspaceId: number;
	onUpdate: () => void;
	onDelete: (taskId: number) => void;
	isMenuOpen: boolean;
	onToggleMenu: () => void;
}

const KanbanCard: FC<KanbanCardProps> = ({
	task,
	workspaceId,
	onUpdate,
	onDelete,
	isMenuOpen,
	onToggleMenu,
}) => {
	const navigate = useNavigate();
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);

	const { attributes, listeners, setNodeRef, isDragging } = useSortable({
		id: `task-${task.id}`,
	});

	const style = {
		opacity: isDragging ? 0.3 : 1,
	};

	const assigneesList = useMemo<TaskAssignee[]>(() => {
		if (Array.isArray(task.assignees) && task.assignees.length > 0) {
			return task.assignees;
		}
		return [];
	}, [task.assignees]);

	const isOverdue = useMemo(() => {
		if (!task.due_date || task.status === "done") return false;
		const dueDate = new Date(task.due_date);
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		dueDate.setHours(0, 0, 0, 0);
		return dueDate < today;
	}, [task.due_date, task.status]);

	const openDetails = () => {
		navigate(`/workspaces/workspace/${workspaceId}/tasks/${task.id}`);
	};

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		onDelete(task.id);
		onToggleMenu();
	};

	return (
		<>
			<div
				ref={setNodeRef}
				style={style}
				className={`${styles.card} ${isOverdue ? styles.overdue : ""}`}
				onClick={openDetails}
			>
				{/* Header */}
				<div
					className={styles.cardHeader}
					{...attributes}
					{...listeners}
				>
					<span className={styles.cardTitle}>{task.title}</span>
					<div className={styles.cardMenu}>
						<button
							className={styles.menuBtn}
							data-no-dnd="true"
							onClick={(e) => {
								e.stopPropagation();
								onToggleMenu();
							}}
						>
							<MoreVertical size={16} />
						</button>
						{isMenuOpen && (
							<div className={styles.menuDropdown}>
								<button
									className={styles.menuItem}
									onClick={(e) => {
										e.stopPropagation();
										setIsEditModalOpen(true);
										onToggleMenu();
									}}
								>
									<Edit size={14} />
									Редактировать
								</button>
								<button
									className={`${styles.menuItem} ${styles.menuItemDelete}`}
									onClick={handleDelete}
								>
									<Trash size={14} />
									Удалить
								</button>
							</div>
						)}
					</div>
				</div>

				{/* Content */}
				<div className={styles.cardContent}>
					{task.content && (
						<p className={styles.cardDescription}>{task.content}</p>
					)}

					<div className={styles.cardFooter}>
						<div className={styles.cardMeta}>
							<span
								className={`${styles.priority} ${styles[`priority_${task.priority}`]}`}
							>
								{task.priority}
							</span>
						</div>

						<div className={styles.cardAssignees}>
							{assigneesList.length > 0 ? (
								<div className={styles.avatarStack}>
									{assigneesList
										.slice(0, 3)
										.map((assignee) => (
											<div
												key={assignee.id}
												className={styles.avatar}
												title={
													assignee.name ??
													assignee.email ??
													"?"
												}
											>
												{assignee.avatar ? (
													<img
														src={assignee.avatar}
														alt={
															assignee.name ??
															assignee.email ??
															"Аватар"
														}
														className={
															styles.avatarImg
														}
													/>
												) : (
													(
														assignee.name ??
														assignee.email ??
														"?"
													)
														.charAt(0)
														.toUpperCase()
												)}
											</div>
										))}
									{assigneesList.length > 3 && (
										<div className={styles.avatarMore}>
											+{assigneesList.length - 3}
										</div>
									)}
								</div>
							) : (
								<div className={styles.noAssignee}>
									<div className={styles.noAssigneeAvatar}>
										<svg
											width="14"
											height="14"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
										>
											<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
											<circle cx="12" cy="7" r="4" />
										</svg>
									</div>
									<span>Нет</span>
								</div>
							)}
						</div>
					</div>

					{task.due_date && (
						<div
							className={`${styles.dueDate} ${isOverdue ? styles.overdueDueDate : ""}`}
						>
							Дедлайн:{" "}
							{new Date(task.due_date).toLocaleDateString(
								"ru-RU",
							)}
						</div>
					)}
				</div>
			</div>

			<EditTaskModal
				task={task}
				workspaceId={workspaceId}
				isOpen={isEditModalOpen}
				onClose={() => setIsEditModalOpen(false)}
				onUpdate={() => {
					onUpdate();
					setIsEditModalOpen(false);
				}}
				onDelete={() => {
					onDelete(task.id);
					setIsEditModalOpen(false);
				}}
			/>
		</>
	);
};

export default KanbanCard;
