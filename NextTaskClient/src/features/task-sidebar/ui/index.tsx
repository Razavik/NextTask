import { FC } from "react";
import { useChatStore } from "@entities/chat";
import AssigneeMultiSelect from "@shared/ui/assignee-multi-select";
import Button from "@shared/ui/button";
import styles from "./index.module.css";
import type { Task } from "@shared/types/task";
import { MessageCircle } from "lucide-react";
import { useTaskSidebar, type Member } from "../model/useTaskSidebar";

interface TaskSidebarProps {
	task: Task;
	members: Member[];
	workspaceId: number;
	canManageAssignees: boolean;
	onTaskUpdated?: (task: Task) => void;
}

const formatTime = (seconds: number): string => {
	const pad = (num: number) => num.toString().padStart(2, "0");
	if (seconds >= 3600) {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		return `${pad(h)}:${pad(m)}:${pad(s)}`;
	}
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${pad(m)}:${pad(s)}`;
};

const TaskSidebar: FC<TaskSidebarProps> = ({
	task,
	members,
	workspaceId,
	canManageAssignees,
	onTaskUpdated,
}) => {
	const { openChat } = useChatStore();
	const {
		currentUser,
		effectiveAssigneeIds,
		isEditing,
		setIsEditing,
		isSaving,
		selectedIds,
		setSelectedIds,
		assignees,
		memberOptions,
		authorMember,
		handleSaveAssignees,
		selectedMembers,
	} = useTaskSidebar({ task, members, workspaceId, onTaskUpdated });

	const handleOpenChat = (member: Member) => {
		openChat({
			id: `user-${member.id}`,
			type: "personal",
			userId: member.id,
			name: member.name,
			avatar: member.avatar,
		});
	};

	return (
		<aside className={styles.sidebar} aria-label="Сводка по задаче">
			<div className={styles.section}>
				<div className={styles.row}>
					<span className={styles.label}>Статус</span>
					<span
						className={`${styles.badge} ${styles[`status_${task.status}` as const]}`}
					>
						{task.status}
					</span>
				</div>
				<div className={styles.row}>
					<span className={styles.label}>Приоритет</span>
					<span
						className={`${styles.badge} ${
							styles[`priority_${task.priority}` as const]
						}`}
					>
						{task.priority}
					</span>
				</div>
				<div className={styles.row}>
					<span className={styles.label}>
						Затрачено времени
					</span>
					<span className={styles.value}>
						{formatTime(task.time_spent || 0)}
					</span>
				</div>
				{task.due_date && (
					<div className={styles.row}>
						<span className={styles.label}>Крайний срок</span>
						<span className={styles.value}>
							{new Date(task.due_date).toLocaleString("ru-RU")}
						</span>
					</div>
				)}
				{task.created_at && (
					<div className={styles.row}>
						<span className={styles.label}>Создана</span>
						<span className={styles.value}>
							{new Date(task.created_at).toLocaleString("ru-RU")}
						</span>
					</div>
				)}
			</div>

			<div className={styles.peopleBlock}>
				{authorMember && (
					<div className={styles.peopleSection}>
						<div className={styles.blockTitle}>Постановщик</div>
						<div className={styles.person}>
							<div className={styles.personMain}>
								<div className={styles.avatar}>
									{authorMember.avatar ? (
										<img
											src={authorMember.avatar}
											alt={authorMember.name}
											className={styles.avatarImage}
										/>
									) : (
										(authorMember.name || "?")
											.charAt(0)
											.toUpperCase()
									)}
								</div>
								<div className={styles.personInfo}>
									<div className={styles.personName}>
										{authorMember.name}
									</div>
									{authorMember.position && (
										<div className={styles.personSub}>
											{authorMember.position}
										</div>
									)}
								</div>
							</div>
							{authorMember.id !== currentUser?.id && (
								<button
									type="button"
									className={styles.chatButton}
									onClick={() => handleOpenChat(authorMember)}
									title="Открыть чат"
								>
									<MessageCircle size={18} />
								</button>
							)}
						</div>
					</div>
				)}
				<div className={styles.peopleSection}>
					<div className={styles.assigneeHeader}>
						<div className={styles.blockTitle}>Исполнители</div>
						{canManageAssignees && !isEditing && (
							<Button
								className={styles.inlineBtn}
								variant="ghost"
								size="sm"
								onClick={() => setIsEditing(true)}
							>
								Изменить
							</Button>
						)}
					</div>

					{isEditing ? (
						<div className={styles.assigneeEditor}>
							<AssigneeMultiSelect
								members={memberOptions}
								selectedIds={selectedIds}
								onChange={setSelectedIds}
								placeholder="Выберите исполнителей"
							/>
							<div className={styles.assigneeActions}>
								<Button
									variant="primary"
									size="sm"
									onClick={() => {
										void handleSaveAssignees();
									}}
									disabled={isSaving}
								>
									{isSaving ? "Сохранение..." : "Сохранить"}
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										setIsEditing(false);
										setSelectedIds(effectiveAssigneeIds);
									}}
									disabled={isSaving}
								>
									Отмена
								</Button>
							</div>
							{selectedIds.length !== selectedMembers.length && (
								<div className={styles.validationWarning}>
									Некоторые выбранные пользователи больше не
									состоят в пространстве.
								</div>
							)}
						</div>
					) : assignees.length > 0 ? (
						assignees.map((u) => (
							<div key={u.id} className={styles.person}>
								<div className={styles.personMain}>
									<div className={styles.avatar}>
										{u.avatar ? (
											<img
												src={u.avatar}
												alt={u.name || u.email}
												className={styles.avatarImage}
											/>
										) : (
											(u.name || u.email || "?")
												.charAt(0)
												.toUpperCase()
										)}
									</div>
									<div className={styles.personInfo}>
										<div className={styles.personName}>
											{u.name ?? u.email}
										</div>
										{u.position && (
											<div className={styles.personSub}>
												{u.position}
											</div>
										)}
									</div>
								</div>
								{u.id !== currentUser?.id && (
									<button
										type="button"
										className={styles.chatButton}
										onClick={() => handleOpenChat(u)}
										title="Открыть чат"
									>
										<MessageCircle size={18} />
									</button>
								)}
							</div>
						))
					) : (
						<div className={styles.placeholder}>Не назначены</div>
					)}
				</div>
			</div>
		</aside>
	);
};

export default TaskSidebar;
