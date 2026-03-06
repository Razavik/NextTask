import { useEffect, useMemo, useState } from "react";
import {
	useToastStore,
	createErrorToast,
	createSuccessToast,
} from "@shared/model/toastStore";
import { useWorkspaceMembersQuery } from "@entities/workspace";
import { tasksService } from "@entities/task";
import type { Task } from "@shared/types/task";
import { toLocalISOString } from "@shared/lib/date";
import { useQueryClient } from "@tanstack/react-query";

interface UseEditTaskOptions {
	task: Task;
	workspaceId: number;
	isOpen: boolean;
	onClose: () => void;
	onUpdate: () => void;
	onDelete: () => void;
}

export const useEditTask = ({
	task,
	workspaceId,
	isOpen,
	onClose,
	onUpdate,
	onDelete,
}: UseEditTaskOptions) => {
	const addToast = useToastStore((state) => state.addToast);
	const queryClient = useQueryClient();
	const [title, setTitle] = useState(task.title);
	const [content, setContent] = useState(task.content || "");
	const [status, setStatus] = useState<"todo" | "progress" | "done">(
		task.status as "todo" | "progress" | "done",
	);
	const [priority, setPriority] = useState<"low" | "medium" | "high">(
		task.priority as "low" | "medium" | "high",
	);
	const [dueDate, setDueDate] = useState(
		task.due_date ? toLocalISOString(task.due_date) : "",
	);
	const [isLoading, setIsLoading] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [assigneeIds, setAssigneeIds] = useState<number[]>(
		task.assignees_ids ?? task.assignees?.map((a) => a.id) ?? [],
	);

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

	useEffect(() => {
		if (!isOpen) return;
		setTitle(task.title);
		setContent(task.content || "");
		setStatus(task.status as "todo" | "progress" | "done");
		setPriority(task.priority as "low" | "medium" | "high");
		setDueDate(task.due_date ? toLocalISOString(task.due_date) : "");
		setAssigneeIds(
			task.assignees_ids ?? task.assignees?.map((a) => a.id) ?? [],
		);
	}, [isOpen, task]);

	const handleSubmit = async (event?: React.FormEvent) => {
		event?.preventDefault();
		if (!title.trim()) return;

		if (dueDate) {
			const maxYear = new Date().getFullYear() + 5;
			const dueDateYear = new Date(dueDate).getFullYear();
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
		}

		setIsLoading(true);
		try {
			// Передаём локальное время без перевода в UTC. Добавляем секунды, если их нет.
			const normalizedDue =
				dueDate && dueDate.length === 16 ? `${dueDate}:00` : dueDate;
			const payload = {
				title: title.trim(),
				content: content || undefined,
				status,
				priority,
				due_date: normalizedDue || undefined,
				assignees_ids: Array.from(new Set(assigneeIds)),
			};

			await tasksService.updateTask(task.id, payload);
			addToast(
				createSuccessToast(
					"Задача обновлена",
					"Изменения успешно сохранены",
					3000,
				),
			);

			// Инвалидируем кэш задач пользователя для обновления карточек дедлайнов
			queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
			queryClient.refetchQueries({ queryKey: ["my-tasks"] });

			onUpdate();
			onClose();
		} catch (error) {
			console.error("Failed to update task:", error);
			addToast(
				createErrorToast(
					"Ошибка",
					"Не удалось сохранить изменения задачи",
					4000,
				),
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleDelete = async () => {
		if (isLoading) return;
		setIsLoading(true);
		try {
			await tasksService.deleteTask(task.id);
			addToast(createSuccessToast("Задача удалена"));

			// Инвалидируем кэш задач пользователя для обновления карточек дедлайнов
			queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
			queryClient.refetchQueries({ queryKey: ["my-tasks"] });

			onDelete();
			onClose();
		} catch (error) {
			console.error("Failed to delete task:", error);
			addToast(
				createErrorToast("Ошибка", "Не удалось удалить задачу", 4000),
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleAssigneeChange = (ids: number[]) => {
		const validIds = ids.filter((id) =>
			members.some((member) => member.id === id),
		);
		setAssigneeIds(Array.from(new Set(validIds)));
	};

	return {
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
		members,
		handleSubmit,
		handleDelete,
		handleAssigneeChange,
	};
};
