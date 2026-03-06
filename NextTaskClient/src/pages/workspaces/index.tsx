import { FC, useState } from "react";
import { ListTodo, Building2, Plus } from "lucide-react";
import { useAuthStore } from "@entities/user";
import { useWorkspacesQuery, workspacesService } from "@entities/workspace";
import { useMyTasksQuery } from "@entities/task";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import styles from "./index.module.css";
import Loader from "@shared/ui/loader";
import StatCard from "@shared/ui/stat-card";
import Input from "@shared/ui/input";
import Button from "@shared/ui/button";
import Modal from "@shared/ui/modal";
import Textarea from "@shared/ui/textarea";
import WorkspaceCard from "@pages/workspaces/components/workspace-card";
import { TasksSection } from "@pages/workspaces/components/tasks-section";
import {
	getUpcomingTasks,
	getOverdueTasks,
	getTotalTasks,
} from "@pages/workspaces/lib/tasks-filters";

const Workspaces: FC = () => {
	const user = useAuthStore((state) => state.user);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const queryClient = useQueryClient();
	const userId = useAuthStore((state) => state.user?.id);

	const workspacesQuery = useWorkspacesQuery(userId);
	const {
		data: list = [],
		isLoading: wsLoading,
		error,
	} = workspacesQuery || {};

	const myTasksQuery = useMyTasksQuery(userId);
	const myTasks = myTasksQuery.data || [];

	const upcomingTasks = getUpcomingTasks(myTasks);
	const overdueTasks = getOverdueTasks(myTasks);
	const totalTasks = getTotalTasks(list);

	const createMutation = useMutation({
		mutationFn: (data: { name: string; description?: string }) =>
			workspacesService.createWorkspace(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["workspaces"] });
			setName("");
			setDescription("");
			setIsCreateModalOpen(false);
		},
	});

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) return;
		createMutation.mutate({
			name: name.trim(),
			description: description.trim() || undefined,
		});
	};

	if (wsLoading || myTasksQuery.isLoading) return <Loader />;

	return (
		<div className={styles.container}>
			{/* Header */}
			<div className={styles.dashboardHeader}>
				<div>
					<h1 className={styles.greeting}>
						Добро пожаловать, {user?.name || user?.email}!
					</h1>
				</div>
			</div>

			{/* Stats */}
			<div className={styles.statsContainer}>
				<StatCard
					value={list.length}
					label="Рабочих пространств"
					color="purple"
					icon={<Building2 size={24} />}
				/>
				<StatCard
					value={totalTasks}
					label="Всего задач"
					color="blue"
					icon={<ListTodo size={24} />}
				/>
			</div>

			<TasksSection
				title="Просроченные дедлайны"
				tasks={overdueTasks}
				variant="overdue"
			/>

			<TasksSection
				title="Ближайшие дедлайны"
				tasks={upcomingTasks}
				variant="upcoming"
			/>

			<div className={styles.sectionHeader}>
				<h2 className={styles.sectionTitle}>
					Ваши рабочие пространства
				</h2>
			</div>

			{error && (
				<div className={styles.error}>{(error as Error).message}</div>
			)}
			{createMutation.error && (
				<div className={styles.error}>
					{(createMutation.error as Error).message}
				</div>
			)}

			{list.length > 0 ? (
				<div className={styles.workspaceList}>
					<button
						className={styles.createCard}
						onClick={() => setIsCreateModalOpen(true)}
					>
						<div className={styles.createCardContent}>
							<Plus size={32} />
							<span>Создать пространство</span>
						</div>
					</button>
					{list.map((ws: any) => (
						<WorkspaceCard
							key={ws.id}
							id={ws.id}
							name={ws.name}
							description={ws.description}
							usersCount={ws.users_count}
							tasks_count={ws.tasks_count}
							members={ws.members}
						/>
					))}
				</div>
			) : (
				<div className={styles.emptyState}>
					<p className={styles.noWorkspaces}>
						Нет рабочих пространств
					</p>
					<Button onClick={() => setIsCreateModalOpen(true)}>
						Создать первое пространство
					</Button>
				</div>
			)}

			<Modal
				isOpen={isCreateModalOpen}
				onClose={() => {
					setIsCreateModalOpen(false);
					setName("");
					setDescription("");
				}}
				title="Создание рабочего пространства"
				maxWidth={500}
			>
				<form onSubmit={handleCreate} className={styles.createForm}>
					<div className={styles.formGroup}>
						<label className={styles.formLabel}>Название</label>
						<Input
							value={name}
							onChange={(
								e: React.ChangeEvent<HTMLInputElement>,
							) => setName(e.target.value)}
							placeholder="Название пространства"
							required
							autoFocus
						/>
					</div>
					<div className={styles.formGroup}>
						<label className={styles.formLabel}>
							Описание (необязательно)
						</label>
						<Textarea
							value={description}
							onChange={(
								e: React.ChangeEvent<HTMLTextAreaElement>,
							) => setDescription(e.target.value)}
							placeholder="Опишите цель рабочего пространства"
							rows={3}
						/>
					</div>
					<div className={styles.formActions}>
						<Button
							type="submit"
							disabled={createMutation.isPending}
						>
							{createMutation.isPending
								? "Создание..."
								: "Создать"}
						</Button>
					</div>
				</form>
			</Modal>
		</div>
	);
};

export default Workspaces;
