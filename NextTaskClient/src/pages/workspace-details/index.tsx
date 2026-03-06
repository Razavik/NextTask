import { FC, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTasksQuery, tasksService } from "@entities/task";
import { useWorkspaceQuery } from "@entities/workspace";
import { useChatStore } from "@entities/chat";
import { useAuthStore } from "@entities/user";
import type { Task } from "@shared/types/task";
import {
	Settings,
	ClipboardList,
	ListTodo,
	CheckCircle,
	Timer,
	Plus,
	FileText,
} from "lucide-react";
import Button from "@shared/ui/button";
import WorkspaceHeader from "@widgets/workspace-header/ui";
import NotFoundCard from "@shared/ui/not-found-card";

import styles from "./index.module.css";
import Loader from "@shared/ui/loader";
import StatCard from "@shared/ui/stat-card";
import { CreateTaskModal } from "@features/task-edit";
import { KanbanBoard } from "@features/kanban-board";

const WorkspaceDetails: FC = () => {
	const navigate = useNavigate();
	const { setCurrentWorkspaceId } = useChatStore();
	const { workspaceId } = useParams<{ workspaceId: string }>();
	const [isCreateModalOpen, setCreateModalOpen] = useState(false);
	const [defaultTaskStatus, setDefaultTaskStatus] = useState<
		"todo" | "progress" | "done"
	>("todo");
	const [statusFilter, setStatusFilter] = useState<
		"all" | "todo" | "progress" | "done"
	>("all");

	const wsId = Number(workspaceId);
	const isValidId = !!workspaceId && !isNaN(wsId) && wsId > 0;

	const {
		data: tasks = [],
		isLoading: tasksLoading,
		error: tasksError,
		refetch: refetchTasks,
	} = useTasksQuery(isValidId ? wsId : undefined);

	const userId = useAuthStore((state) => state.user?.id);
	const {
		data: workspace,
		isLoading: wsLoading,
		error: wsError,
	} = useWorkspaceQuery(isValidId ? wsId : undefined, userId);

	// Синхронизация текущего пространства для фильтра "Текущее" в чате
	// и для загрузки участников
	// Обновляем при смене wsId, сбрасываем при размонтировании/некорректном id
	useEffect(() => {
		if (workspaceId) {
			setCurrentWorkspaceId(Number(workspaceId));
		}
	}, [workspaceId, setCurrentWorkspaceId]);

	if (!isValidId) {
		return (
			<div className={styles.container}>
				Рабочее пространство не найдено.
			</div>
		);
	}

	const handleTaskCreated = () => {
		setCreateModalOpen(false);
		refetchTasks();
	};

	const loading = tasksLoading || wsLoading;
	const error = tasksError || wsError;

	if (loading) return <Loader isFullheight />;
	if (error) {
		const msg =
			error instanceof Error ? error.message : "Неизвестная ошибка";
		const status = (error as { response?: { status?: number } })?.response
			?.status;
		if (status === 404) {
			return (
				<NotFoundCard
					icon={<ClipboardList size={40} />}
					title="Рабочее пространство не найдено"
					description="Возможно, ссылка устарела или у вас нет доступа к этому пространству."
				>
					<Button onClick={() => navigate("/workspaces")}>
						Перейти к списку пространств
					</Button>
				</NotFoundCard>
			);
		}
		return <div className={styles.error}>Ошибка: {msg}</div>;
	}
	if (!workspace) {
		return (
			<NotFoundCard
				icon={<ClipboardList size={40} />}
				title="Рабочее пространство недоступно"
				description="Попробуйте обновить страницу или вернуться к списку рабочих пространств."
			>
				<Button onClick={() => navigate("/workspaces")}>
					Перейти к списку пространств
				</Button>
			</NotFoundCard>
		);
	}

	const isReader = workspace?.role === "reader";

	const stats = {
		usersCount: workspace?.users_count || 0,
		tasksCount: tasks.length,
		tasksTodo: tasks.filter((t: Task) => t.status === "todo").length,
		tasksInProgress: tasks.filter((t: Task) => t.status === "progress")
			.length,
		tasksDone: tasks.filter((t: Task) => t.status === "done").length,
	};

	return (
		<>
			<CreateTaskModal
				workspaceId={Number(workspaceId)}
				onTaskCreated={handleTaskCreated}
				isOpen={isCreateModalOpen}
				onClose={() => setCreateModalOpen(false)}
				defaultStatus={defaultTaskStatus}
			/>
			<WorkspaceHeader
				title={workspace?.name || "Workspace"}
				onBack={() => navigate("/workspaces")}
				backTitle="Назад к списку пространств"
				titleIcon={<ClipboardList size={24} />}
			/>
			<div className={styles.workspaceHeaderActionsRow}>
				<div className={styles.workspaceActions}>
					<Button
						onClick={() => setCreateModalOpen(true)}
						disabled={isReader}
						title={
							isReader
								? "Недостаточно прав (роль: читатель)"
								: undefined
						}
					>
						<Plus size={16} /> Добавить задачу
					</Button>
					<Button
						onClick={() =>
							navigate(
								`/workspaces/workspace/${workspaceId}/settings/general`,
							)
						}
					>
						<Settings size={16} /> Настройки
					</Button>
				</div>
				{workspace.description && (
					<div className={styles.workspaceDescription}>
						<span className={styles.descriptionIcon} aria-hidden>
							<FileText size={16} />
						</span>
						<div className={styles.descriptionBody}>
							<span className={styles.descriptionLabel}>
								Описание
							</span>
							<p className={styles.descriptionText}>
								{workspace.description}
							</p>
						</div>
					</div>
				)}
			</div>

			<div className={styles.statsContainer}>
				<StatCard
					value={stats.tasksCount}
					label="Все задачи"
					color="purple"
					icon={<ListTodo size={18} />}
					onClick={() => setStatusFilter("all")}
					active={statusFilter === "all"}
				/>
				<StatCard
					value={stats.tasksTodo}
					label="К выполнению"
					color="default"
					icon={<ClipboardList size={18} />}
					onClick={() => setStatusFilter("todo")}
					active={statusFilter === "todo"}
				/>
				<StatCard
					value={stats.tasksInProgress}
					label="В процессе"
					color="warning"
					icon={<Timer size={18} />}
					onClick={() => setStatusFilter("progress")}
					active={statusFilter === "progress"}
				/>
				<StatCard
					value={stats.tasksDone}
					label="Выполнено"
					color="success"
					icon={<CheckCircle size={18} />}
					onClick={() => setStatusFilter("done")}
					active={statusFilter === "done"}
				/>
			</div>

			{tasks.length > 0 ? (
				<KanbanBoard
					tasks={tasks}
					workspaceId={wsId}
					statusFilter={statusFilter}
					onTaskUpdate={() => refetchTasks()}
					onTaskDelete={async (taskId: number) => {
						await tasksService.deleteTask(taskId);
						refetchTasks();
					}}
					onAddTask={(status) => {
						setDefaultTaskStatus(status);
						setCreateModalOpen(true);
					}}
				/>
			) : (
				<div className={styles.emptyTasks}>
					<ClipboardList size={48} strokeWidth={1} />
					<p>В этом пространстве еще нет задач.</p>
					<Button
						onClick={() => setCreateModalOpen(true)}
						disabled={isReader}
						title={
							isReader
								? "Недостаточно прав (роль: читатель)"
								: undefined
						}
					>
						Создать первую задачу
					</Button>
				</div>
			)}
		</>
	);
};

export default WorkspaceDetails;
