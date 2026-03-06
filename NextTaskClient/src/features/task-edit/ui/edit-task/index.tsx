import { FC } from "react";
import Button from "@shared/ui/button";
import Input from "@shared/ui/input";
import Dropdown from "@shared/ui/dropdown";
import Modal from "@shared/ui/modal";
import ConfirmModal from "@shared/ui/confirm-modal";
import type { Task } from "@shared/types/task";
import AssigneeMultiSelectModal from "@shared/ui/assignee-multi-select-modal";
import { Clock, Save, Trash2 } from "lucide-react";
import styles from "./index.module.css";
import { useEditTask } from "@features/task-edit/model/useEditTask";

interface EditTaskModalProps {
	task: Task;
	workspaceId: number;
	isOpen: boolean;
	onClose: () => void;
	onUpdate: () => void;
	onDelete: () => void;
}

const EditTaskModal: FC<EditTaskModalProps> = ({
	task,
	workspaceId,
	isOpen,
	onClose,
	onUpdate,
	onDelete,
}) => {
	const {
		title,
		setTitle,
		content,
		setContent,
		status,
		setStatus,
		priority,
		setPriority,
		dueDate,
		setDueDate,
		isLoading,
		confirmOpen,
		setConfirmOpen,
		assigneeIds,
		memberOptions,
		handleSubmit,
		handleDelete,
		handleAssigneeChange,
	} = useEditTask({ task, workspaceId, isOpen, onClose, onUpdate, onDelete });

	if (!isOpen) {
		return null;
	}

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Редактировать задачу">
			<form
				onSubmit={handleSubmit}
				noValidate
				className={styles.form}
				onKeyDown={(event) => {
					if (
						event.key === "Enter" &&
						!event.shiftKey &&
						(event.target as HTMLElement).tagName !== "TEXTAREA"
					) {
						event.preventDefault();
						void handleSubmit();
					}
				}}
			>
				<div className={styles.field}>
					<label htmlFor="task-title" className={styles.label}>
						Название задачи
					</label>
					<Input
						id="task-title"
						type="text"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						placeholder="Введите название задачи"
						required
					/>
				</div>

				<div className={styles.field}>
					<label htmlFor="task-content" className={styles.label}>
						Описание
					</label>
					<textarea
						id="task-content"
						className={styles.textarea}
						value={content}
						onChange={(event) => setContent(event.target.value)}
						placeholder="Описание задачи"
						rows={4}
					/>
				</div>

				<div className={styles.row}>
					<div className={styles.field}>
						<label htmlFor="task-status" className={styles.label}>
							Статус
						</label>
						<Dropdown
							options={[
								{ value: "todo", label: "К выполнению" },
								{ value: "progress", label: "В процессе" },
								{ value: "done", label: "Выполнено" },
							]}
							value={status}
							onChange={(value) =>
								setStatus(value as "todo" | "progress" | "done")
							}
						/>
					</div>

					<div className={styles.field}>
						<label htmlFor="task-priority" className={styles.label}>
							Приоритет
						</label>
						<Dropdown
							options={[
								{ value: "low", label: "Низкий" },
								{ value: "medium", label: "Средний" },
								{ value: "high", label: "Высокий" },
							]}
							value={priority}
							onChange={(value) =>
								setPriority(value as "low" | "medium" | "high")
							}
						/>
					</div>
				</div>

				<div className={styles.field}>
					<label htmlFor="task-due-date" className={styles.label}>
						Срок выполнения
					</label>
					<Input
						id="task-due-date"
						type="datetime-local"
						value={dueDate}
						onChange={(event) => setDueDate(event.target.value)}
						min={new Date(
							new Date().getFullYear(),
							new Date().getMonth(),
							new Date().getDate(),
						)
							.toISOString()
							.slice(0, 16)}
					/>
				</div>

				<div className={styles.field}>
					<label className={styles.label}>Исполнители</label>
					<AssigneeMultiSelectModal
						members={memberOptions}
						selectedIds={assigneeIds}
						onChange={handleAssigneeChange}
						placeholder="Не назначены"
					/>
				</div>
				{task.created_at && (
					<div className={`${styles.field} ${styles.createdMeta}`}>
						<label className={styles.label}>Создано</label>
						<div
							className={styles.createdWrapper}
							title={new Date(task.created_at).toLocaleString()}
						>
							<Clock size={16} className={styles.createdIcon} />
							<span className={styles.createdDate}>
								{new Date(task.created_at).toLocaleDateString(
									"ru-RU",
								)}
							</span>
							<span className={styles.createdSubtle}>
								в{" "}
								{new Date(task.created_at).toLocaleTimeString(
									"ru-RU",
								)}
							</span>
						</div>
					</div>
				)}

				<div className={styles.actionsRow}>
					<Button
						type="button"
						disabled={isLoading || !title.trim()}
						onClick={() => {
							void handleSubmit();
						}}
					>
						<Save size={16} /> Сохранить
					</Button>
					<Button
						type="button"
						onClick={() => setConfirmOpen(true)}
						disabled={isLoading}
						className={styles.deleteBtn}
						title="Удалить задачу"
					>
						<Trash2 size={16} /> Удалить
					</Button>
				</div>
			</form>
			<ConfirmModal
				open={confirmOpen}
				loading={isLoading}
				variant="danger"
				title="Удалить задачу?"
				message={`Задача "${title}" будет удалена без возможности восстановления.`}
				confirmLabel="Удалить"
				cancelLabel="Отмена"
				onConfirm={async () => {
					await handleDelete();
					setConfirmOpen(false);
				}}
				onCancel={() => setConfirmOpen(false)}
			/>
		</Modal>
	);
};

export default EditTaskModal;
