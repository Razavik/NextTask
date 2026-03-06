import { FC, useMemo, useState, useEffect } from "react";
import { tasksService } from "@entities/task";
import type { CreateTaskRequest } from "@shared/types/task";
import Input from "@shared/ui/input";
import Dropdown from "@shared/ui/dropdown";
import Button from "@shared/ui/button";
import styles from "./index.module.css";
import Modal from "@shared/ui/modal";
import { useWorkspaceMembersQuery } from "@entities/workspace";
import AssigneeMultiSelectModal from "@shared/ui/assignee-multi-select-modal";
import {
	useToastStore,
	createErrorToast,
	createSuccessToast,
} from "@shared/model/toastStore";
import { toLocalISOString } from "@shared/lib/date";

interface CreateTaskModalProps {
	workspaceId: number;
	onTaskCreated: () => void; // Callback для закрытия модалки и обновления списка
	isOpen: boolean;
	onClose: () => void;
	defaultStatus?: "todo" | "progress" | "done";
}

const CreateTaskModal: FC<CreateTaskModalProps> = ({
	workspaceId,
	onTaskCreated,
	isOpen,
	onClose,
	defaultStatus = "todo",
}) => {
	const addToast = useToastStore((state) => state.addToast);
	const [newTask, setNewTask] = useState<
		Omit<CreateTaskRequest, "workspace_id">
	>({
		title: "",
		due_date: "",
		priority: "medium",
		status: defaultStatus,
	});

	useEffect(() => {
		setNewTask((prev) => ({ ...prev, status: defaultStatus }));
	}, [defaultStatus]);
	const [assigneeIds, setAssigneeIds] = useState<number[]>([]);

	// Список участников рабочего пространства для выбора исполнителя
	const { data: members = [] } = useWorkspaceMembersQuery(workspaceId);
	const memberOptions = useMemo(
		() =>
			members.map((member) => ({
				id: member.id,
				name: member.name,
				email: member.email ?? "",
				position: member.position,
			})),
		[members],
	);

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
	) => {
		const { name, value } = e.target;
		setNewTask((prev) => ({ ...prev, [name]: value }));
	};

	const handleAddTask = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newTask.title.trim()) return;
		if (!newTask.priority.trim()) return;
		if (!newTask.status.trim()) return;
		if (!newTask.due_date?.trim()) return;

		const today = new Date();
		const todayStr = toLocalISOString(today);
		if (newTask.due_date < todayStr) return;

		const maxYear = today.getFullYear() + 5;
		const dueDateYear = new Date(newTask.due_date).getFullYear();
		if (dueDateYear > maxYear) {
			addToast(
				createErrorToast(
					"Некорректная дата",
					`Дедлайн не может быть позже ${maxYear} года`,
					4000,
				),
			);
			return;
		}

		// Передаём локальное время без преобразования в UTC. Добавляем секунды, если их нет.
		const normalizedDue =
			newTask.due_date?.length === 16
				? `${newTask.due_date}:00`
				: newTask.due_date;

		await tasksService.createTask(workspaceId, {
			...newTask,
			due_date: normalizedDue,
			assignees_ids: assigneeIds,
		});
		addToast(createSuccessToast("Задача создана"));
		onTaskCreated();
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} title="Создать задачу">
			<form onSubmit={handleAddTask} className={styles.taskForm}>
				<Input
					type="text"
					id="title"
					name="title"
					label="Название задачи"
					placeholder="Название задачи"
					value={newTask.title}
					onChange={handleInputChange}
					required
					autoFocus
				/>
				<div className={styles.formGroup}>
					<label htmlFor="content" className={styles.formLabel}>
						Описание
					</label>
					<textarea
						id="content"
						name="content"
						className={styles.textarea}
						placeholder="Описание задачи"
						value={newTask.content || ""}
						onChange={(e) =>
							setNewTask((prev) => ({
								...prev,
								content: e.target.value,
							}))
						}
						rows={4}
					/>
				</div>
				<Input
					type="datetime-local"
					id="due_date"
					name="due_date"
					label="Срок выполнения"
					value={newTask.due_date || ""}
					onChange={handleInputChange}
					min={toLocalISOString(new Date())}
				/>
				<div className={styles.formRow}>
					<div className={styles.formGroup}>
						<Dropdown
							label="Статус"
							options={[
								{ value: "todo", label: "К выполнению" },
								{ value: "progress", label: "В процессе" },
								{ value: "done", label: "Выполнено" },
							]}
							value={newTask.status}
							onChange={(value) =>
								setNewTask((prev) => ({
									...prev,
									status: value as typeof newTask.status,
								}))
							}
						/>
					</div>
					<div className={styles.formGroup}>
						<Dropdown
							label="Приоритет"
							options={[
								{ value: "low", label: "Низкий" },
								{ value: "medium", label: "Средний" },
								{ value: "high", label: "Высокий" },
							]}
							value={newTask.priority}
							onChange={(value) =>
								setNewTask((prev) => ({
									...prev,
									priority: value as typeof newTask.priority,
								}))
							}
						/>
					</div>
				</div>
				<div className={styles.formGroup}>
					<label className={styles.formLabel}>Исполнители</label>
					<AssigneeMultiSelectModal
						members={memberOptions}
						selectedIds={assigneeIds}
						onChange={(ids) =>
							setAssigneeIds(Array.from(new Set(ids)))
						}
						placeholder="Не назначены"
					/>
				</div>
				<Button
					type="submit"
					disabled={
						!newTask.title.trim() ||
						!newTask.priority ||
						!newTask.status ||
						!newTask.due_date
					}
				>
					Добавить задачу
				</Button>
			</form>
		</Modal>
	);
};

export default CreateTaskModal;
