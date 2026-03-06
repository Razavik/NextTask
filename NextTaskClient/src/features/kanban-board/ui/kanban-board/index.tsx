import { FC, useMemo, useState, useEffect } from "react";
import { Plus, ClipboardList } from "lucide-react";
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	useSensor,
	useSensors,
	rectIntersection,
	useDroppable,
	type DragStartEvent,
	type DragEndEvent,
	type DragOverEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQueryClient } from "@tanstack/react-query";
import type { Task } from "@shared/types/task";
import {
	STATUS_LABELS,
	STATUS_ORDER,
	type TaskStatus,
} from "../../model/types";
import KanbanCard from "../kanban-card";
import Button from "@shared/ui/button";
import { tasksService } from "@entities/task";
import styles from "./index.module.css";

interface KanbanBoardProps {
	tasks: Task[];
	workspaceId: number;
	onTaskUpdate: () => void;
	onTaskDelete: (taskId: number) => void;
	onAddTask: (status: TaskStatus) => void;
	statusFilter?: "all" | TaskStatus;
}

interface KanbanColumnProps {
	column: {
		id: TaskStatus;
		title: string;
		tasks: Task[];
	};
	workspaceId: number;
	activeMenu: number | null;
	onToggleMenu: (taskId: number) => void;
	onTaskUpdate: () => void;
	onTaskDelete: (taskId: number) => void;
	onAddTask: (status: TaskStatus) => void;
}

const KanbanColumn: FC<KanbanColumnProps> = ({
	column,
	workspaceId,
	activeMenu,
	onToggleMenu,
	onTaskUpdate,
	onTaskDelete,
	onAddTask,
}) => {
	const { setNodeRef, isOver } = useDroppable({
		id: column.id,
	});

	return (
		<div
			ref={setNodeRef}
			className={`${styles.column} ${isOver ? styles.columnDragOver : ""}`}
		>
			<div className={styles.columnHeader}>
				<div className={styles.columnTitle}>
					<span
						className={`${styles.statusDot} ${styles[`status_${column.id}`]}`}
					/>
					<h3>{column.title}</h3>
					<span className={styles.taskCount}>
						{column.tasks.length}
					</span>
				</div>
				<button
					className={styles.addBtn}
					onClick={() => onAddTask(column.id)}
					title="Добавить задачу"
				>
					<Plus size={18} />
				</button>
			</div>
			<SortableContext
				items={column.tasks.map((t) => `task-${t.id}`)}
				strategy={verticalListSortingStrategy}
			>
				<div className={styles.columnContent}>
					{column.tasks.length > 0 ? (
						column.tasks.map((task) => (
							<KanbanCard
								key={task.id}
								task={task}
								workspaceId={workspaceId}
								onUpdate={onTaskUpdate}
								onDelete={onTaskDelete}
								isMenuOpen={activeMenu === task.id}
								onToggleMenu={() => onToggleMenu(task.id)}
							/>
						))
					) : (
						<div className={styles.emptyColumn}>
							<div className={styles.emptyIcon}>
								<ClipboardList size={32} strokeWidth={1.5} />
							</div>
							<p>Нет задач</p>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => onAddTask(column.id)}
							>
								<Plus size={14} />
								Добавить
							</Button>
						</div>
					)}
				</div>
			</SortableContext>
		</div>
	);
};

const KanbanBoard: FC<KanbanBoardProps> = ({
	tasks,
	workspaceId,
	onTaskUpdate,
	onTaskDelete,
	onAddTask,
	statusFilter = "all",
}) => {
	const queryClient = useQueryClient();
	const [activeMenu, setActiveMenu] = useState<number | null>(null);
	const [activeTask, setActiveTask] = useState<Task | null>(null);
	const [localTasks, setLocalTasks] = useState<Task[]>(tasks);

	// Синхронизируем localTasks когда меняется props tasks
	useEffect(() => {
		setLocalTasks(tasks);
	}, [tasks]);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 5, // Требуем сдвиг мыши на 5px для старта drag, чтобы работали обычные клики
			},
		}),
	);

	const columns = useMemo(() => {
		const order =
			statusFilter === "all"
				? STATUS_ORDER
				: [statusFilter as TaskStatus];
		return order.map((status) => {
			const columnTasks = localTasks.filter(
				(task) => task.status === status,
			);
			// Сортировка по дедлайну: сначала с дедлайном (по возрастанию), потом без дедлайна
			columnTasks.sort((a, b) => {
				if (!a.due_date && !b.due_date) return 0;
				if (!a.due_date) return 1; // Задачи без дедлайна в конец
				if (!b.due_date) return -1;
				return (
					new Date(a.due_date).getTime() -
					new Date(b.due_date).getTime()
				);
			});
			return {
				id: status,
				title: STATUS_LABELS[status],
				tasks: columnTasks,
			};
		});
	}, [localTasks, statusFilter]);

	const toggleMenu = (taskId: number) => {
		setActiveMenu(activeMenu === taskId ? null : taskId);
	};

	const handleDragStart = (event: DragStartEvent) => {
		const taskId = String(event.active.id).replace("task-", "");
		const task = localTasks.find((t) => t.id === Number(taskId));
		if (task) setActiveTask(task);
	};

	const handleDragOver = (event: DragOverEvent) => {
		const { active, over } = event;
		if (!over) return;

		const activeId = String(active.id).replace("task-", "");
		const overId = String(over.id);

		// Определяем целевой статус (колонку)
		let targetStatus: TaskStatus | null = null;
		if (STATUS_ORDER.includes(overId as TaskStatus)) {
			targetStatus = overId as TaskStatus;
		} else {
			const taskId = overId.replace("task-", "");
			const overTask = localTasks.find((t) => t.id === Number(taskId));
			if (overTask) targetStatus = overTask.status as TaskStatus;
		}

		if (!targetStatus) return;

		// Обновляем локальное состояние только если статус изменился
		// (перенос между колонками). Внутри колонки сортировка автоматическая.
		setLocalTasks((prev) => {
			const activeTaskIndex = prev.findIndex(
				(t) => t.id === Number(activeId),
			);
			if (activeTaskIndex === -1) return prev;

			const activeTask = prev[activeTaskIndex];
			if (activeTask.status === targetStatus) return prev;

			const updated = [...prev];
			updated[activeTaskIndex] = { ...activeTask, status: targetStatus };
			return updated;
		});
	};

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		setActiveTask(null);

		if (!over) {
			setLocalTasks(tasks);
			return;
		}

		const activeId = String(active.id).replace("task-", "");
		const draggedTask = tasks.find((t) => t.id === Number(activeId)); // Берём из исходного tasks для сравнения
		if (!draggedTask) return;

		// Определяем целевой статус
		let targetStatus: TaskStatus | null = null;
		const overId = String(over.id);
		if (STATUS_ORDER.includes(overId as TaskStatus)) {
			targetStatus = overId as TaskStatus;
		} else {
			const taskId = overId.replace("task-", "");
			const overTask = localTasks.find((t) => t.id === Number(taskId)); // Тут можно из localTasks
			if (overTask) targetStatus = overTask.status as TaskStatus;
		}

		if (!targetStatus || targetStatus === draggedTask.status) {
			// Если статус не изменился или не определен - сбрасываем локальные изменения на серверные данные
			// (чтобы убрать возможные визуальные артефакты)
			setLocalTasks(tasks);
			return;
		}

		try {
			// Оптимистично оставляем localTasks как есть (оно уже обновлено в handleDragOver)
			await tasksService.updateTask(draggedTask.id, {
				status: targetStatus,
			});

			// Инвалидируем кэш задач пользователя для обновления карточек дедлайнов
			queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
			queryClient.refetchQueries({ queryKey: ["my-tasks"] });

			onTaskUpdate();
		} catch {
			setLocalTasks(tasks);
		}
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={rectIntersection}
			onDragStart={handleDragStart}
			onDragOver={handleDragOver}
			onDragEnd={handleDragEnd}
		>
			<div className={styles.board}>
				{columns.map((column) => (
					<KanbanColumn
						key={column.id}
						column={column}
						workspaceId={workspaceId}
						activeMenu={activeMenu}
						onToggleMenu={toggleMenu}
						onTaskUpdate={onTaskUpdate}
						onTaskDelete={onTaskDelete}
						onAddTask={onAddTask}
					/>
				))}
			</div>
			<DragOverlay dropAnimation={null}>
				{activeTask ? (
					<div className={styles.dragOverlay}>
						<KanbanCard
							task={activeTask}
							workspaceId={workspaceId}
							onUpdate={() => {}}
							onDelete={() => {}}
							isMenuOpen={false}
							onToggleMenu={() => {}}
						/>
					</div>
				) : null}
			</DragOverlay>
		</DndContext>
	);
};

export default KanbanBoard;
