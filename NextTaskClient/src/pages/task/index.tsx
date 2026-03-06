import { FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
	useToastStore,
	createErrorToast,
	createSuccessToast,
} from "@shared/model/toastStore";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@entities/user";

import WorkspaceHeader from "@widgets/workspace-header/ui";
import {
	useWorkspaceMembersQuery,
	useWorkspaceQuery,
} from "@entities/workspace";
import { tasksService } from "@entities/task";
import Loader from "@shared/ui/loader";
import Button from "@shared/ui/button";
import Textarea from "@shared/ui/textarea";
import NotFoundCard from "@shared/ui/not-found-card";
import { TaskComments } from "@features/task-comments";
import { TaskSidebar } from "@features/task-sidebar";
import { TaskTracker } from "@features/task-tracker";

import styles from "./index.module.css";

const TaskPage = () => {
	const { workspaceId, taskId } = useParams();
	const wid = Number(workspaceId);
	const tid = Number(taskId);
	const tabSuffix = useMemo(
		() => (Number.isFinite(tid) ? tid : "unknown"),
		[tid],
	);
	const commentsTabId = `task-tab-comments-${tabSuffix}`;
	const sidebarTabId = `task-tab-sidebar-${tabSuffix}`;
	const trackerTabId = `task-tab-tracker-${tabSuffix}`;
	const sidebarPanelId = `task-panel-sidebar-${tabSuffix}`;

	const {
		data: task,
		isLoading,
		isError,
	} = useQuery({
		queryKey: ["task", wid, tid],
		queryFn: () => tasksService.fetchTask(tid),
		enabled: Number.isFinite(wid) && Number.isFinite(tid),
	});

	const queryClient = useQueryClient();
	const userId = useAuthStore((state) => state.user?.id);
	const { data: members = [] } = useWorkspaceMembersQuery(wid);
	const { data: workspace } = useWorkspaceQuery(wid, userId);
	const isReader = workspace?.role === "reader";
	const [content, setContent] = useState<string>("");
	const [activeMobileTab, setActiveMobileTab] = useState<
		"comments" | "sidebar" | "tracker"
	>("comments");

	// Состояние для десктопных вкладок (Комментарии / Трекер)
	const [activeDesktopTab, setActiveDesktopTab] = useState<
		"comments" | "tracker"
	>("tracker");

	// Синхронизируем мобильную вкладку с десктопной для корректного отображения
	useEffect(() => {
		setActiveMobileTab(activeDesktopTab);
	}, [activeDesktopTab]);

	const handleTaskUpdated = (updatedTask: any) => {
		queryClient.setQueryData(["task", wid, tid], updatedTask);
	};

	useEffect(() => {
		if (task?.content !== undefined && task?.content !== null) {
			setContent(task.content);
		} else {
			setContent("");
		}
	}, [task?.content]);

	const { mutate: saveContent, isPending: isSaving } = useMutation({
		mutationFn: (value: string) =>
			tasksService.updateTask(tid, { content: value }),
		onSuccess: (updated) => {
			queryClient.setQueryData(["task", wid, tid], updated);
			useToastStore.getState().addToast(createSuccessToast("Сохранено"));
		},
		onError: () => {
			useToastStore
				.getState()
				.addToast(createErrorToast("Ошибка сохранения"));
		},
	});

	const { mutate: completeTask, isPending: isCompleting } = useMutation({
		mutationFn: () => tasksService.updateTask(tid, { status: "done" }),
		onSuccess: (updated) => {
			queryClient.setQueryData(["task", wid, tid], updated);
			useToastStore
				.getState()
				.addToast(createSuccessToast("Задача завершена"));
		},
		onError: () => {
			useToastStore
				.getState()
				.addToast(createErrorToast("Ошибка завершения задачи"));
		},
	});

	const navigate = useNavigate();

	if (isLoading) {
		return <Loader isFullheight />;
	}

	if (isError || !task) {
		return (
			<NotFoundCard
				title="Задача не найдена или недоступна"
				description="Возможно, она была удалена или у вас нет доступа к ней."
				icon={<FileText size={40} />}
			>
				<Link to={`/workspaces/workspace/${workspaceId}`}>
					<Button variant="primary">
						Перейти к рабочему пространству
					</Button>
				</Link>
			</NotFoundCard>
		);
	}

	return (
		<section className={styles.pageLayout}>
			<WorkspaceHeader
				title={task.title}
				onBack={() => navigate(`/workspaces/workspace/${workspaceId}`)}
				backTitle="Назад к пространству"
				rightElement={
					task.status !== "done" &&
					!isReader && (
						<Button
							variant="primary"
							size="sm"
							onClick={() => completeTask()}
							disabled={isCompleting}
						>
							{isCompleting
								? "Завершение..."
								: "Завершить задачу"}
						</Button>
					)
				}
			/>
			<div className={styles.pageContent}>
				<div className={styles.mainColumn}>
					{/* Контент задачи */}
					<div className={styles.contentEditor}>
						<Textarea
							textareaClassName={styles.contentInput}
							placeholder="Напишите подробности, заметки, чек-листы и т.п."
							value={content}
							onChange={(e) => setContent(e.target.value)}
							disabled={!!isReader}
						/>
						<div className={styles.contentActions}>
							<Button
								onClick={() => saveContent(content)}
								disabled={isSaving || !!isReader}
							>
								{isSaving ? "Сохранение..." : "Сохранить"}
							</Button>
						</div>
					</div>
					{/* Мобильные вкладки */}
					<div className={styles.mobileTabs} role="tablist">
						<Button
							type="button"
							id={commentsTabId}
							variant={
								activeMobileTab === "comments"
									? "primary"
									: "ghost"
							}
							size="sm"
							onClick={() => setActiveMobileTab("comments")}
							role="tab"
							aria-selected={activeMobileTab === "comments"}
						>
							Комментарии
						</Button>
						<Button
							type="button"
							id={trackerTabId}
							variant={
								activeMobileTab === "tracker"
									? "primary"
									: "ghost"
							}
							size="sm"
							onClick={() => setActiveMobileTab("tracker")}
							role="tab"
							aria-selected={activeMobileTab === "tracker"}
						>
							Трекер
						</Button>
						<Button
							type="button"
							id={sidebarTabId}
							variant={
								activeMobileTab === "sidebar"
									? "primary"
									: "ghost"
							}
							size="sm"
							onClick={() => setActiveMobileTab("sidebar")}
							role="tab"
							aria-selected={activeMobileTab === "sidebar"}
						>
							Сводка
						</Button>
					</div>

					{/* Десктопные вкладки */}
					<div className={styles.desktopTabs} role="tablist">
						<Button
							type="button"
							variant={
								activeDesktopTab === "comments"
									? "primary"
									: "ghost"
							}
							size="sm"
							onClick={() => setActiveDesktopTab("comments")}
						>
							Комментарии
						</Button>
						<Button
							type="button"
							variant={
								activeDesktopTab === "tracker"
									? "primary"
									: "ghost"
							}
							size="sm"
							onClick={() => setActiveDesktopTab("tracker")}
						>
							Трекер
						</Button>
					</div>

					{/* Содержимое вкладок */}
					<div className={styles.tabContent}>
						{/* Для десктопа используем activeDesktopTab, для мобилки activeMobileTab */}
						<div
							className={`${styles.desktopPanel} ${activeDesktopTab === "comments" ? styles.active : ""}`}
						>
							<div
								className={`${styles.mobilePanel} ${activeMobileTab === "comments" ? styles.active : ""}`}
							>
								<div className={styles.commentsPanel}>
									<TaskComments
										taskId={tid}
										workspaceId={wid}
									/>
								</div>
							</div>
						</div>

						<div
							className={`${styles.desktopPanel} ${activeDesktopTab === "tracker" ? styles.active : ""}`}
						>
							<div
								className={`${styles.mobilePanel} ${activeMobileTab === "tracker" ? styles.active : ""}`}
							>
								<div className={styles.trackerPanel}>
									<TaskTracker
										task={task}
										workspaceId={wid}
										onTaskUpdated={handleTaskUpdated}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Правый сайдбар (Сводка) */}
				<div
					className={`${styles.sidebarColumn} ${styles.mobilePanel} ${activeMobileTab === "sidebar" ? styles.active : ""}`}
					id={sidebarPanelId}
					role="tabpanel"
					aria-labelledby={sidebarTabId}
				>
					<TaskSidebar
						task={task}
						members={members}
						workspaceId={wid}
						canManageAssignees={!isReader}
						onTaskUpdated={handleTaskUpdated}
					/>
				</div>
			</div>
		</section>
	);
};

export default TaskPage;
