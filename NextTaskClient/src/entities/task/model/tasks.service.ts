import api from "@shared/api/axios";
import type {
	Task,
	CreateTaskRequest,
	UpdateTaskRequest,
	TaskResponse,
	TasksResponse,
	TaskTimeTrack,
	CreateTimeTrackRequest,
	TaskPlan,
	PlanningUser,
	PlanningTaskOption,
	CreateTaskPlanRequest,
	UpdateTaskPlanRequest,
} from "@shared/types/task";

class TasksService {
	async fetchMyTasks(): Promise<Task[]> {
		const { data } = await api.get<TasksResponse | Task[]>("/tasks/my");
		return Array.isArray(data) ? data : data.tasks;
	}

	async fetchTasks(workspaceId: number): Promise<Task[]> {
		const { data } = await api.get<TasksResponse | Task[]>(
			`/workspaces/${workspaceId}/tasks`,
		);
		return Array.isArray(data) ? data : data.tasks;
	}

	async createTask(
		workspaceId: number,
		request: CreateTaskRequest,
	): Promise<Task> {
		const { data } = await api.post<TaskResponse | Task>(`/tasks/`, {
			...request,
			workspace_id: workspaceId,
		});
		return "task" in data ? data.task : data;
	}

	async toggleTask(workspaceId: number, taskId: number): Promise<Task> {
		const { data } = await api.patch<TaskResponse>(
			`/workspaces/${workspaceId}/tasks/${taskId}/toggle`,
		);
		return data.task;
	}

	async updateTask(
		taskId: number,
		request: UpdateTaskRequest,
	): Promise<Task> {
		const { data } = await api.put<TaskResponse | Task>(
			`/tasks/${taskId}`,
			request,
		);
		return "task" in data ? data.task : data;
	}

	async deleteTask(taskId: number): Promise<void> {
		await api.delete(`/tasks/${taskId}`);
	}

	async fetchTask(taskId: number): Promise<Task> {
		const { data } = await api.get<TaskResponse | Task>(`/tasks/${taskId}`);
		return "task" in data ? data.task : data;
	}

	async setTaskAssignees(
		taskId: number,
		assigneesIds: number[],
	): Promise<Task> {
		const { data } = await api.post<TaskResponse | Task>(
			`/tasks/${taskId}/assignees`,
			{
				assignees_ids: assigneesIds,
			},
		);
		return "task" in data ? data.task : data;
	}

	async fetchTimeTracks(taskId: number): Promise<TaskTimeTrack[]> {
		const { data } = await api.get<TaskTimeTrack[]>(
			`/tasks/${taskId}/time-tracks`,
		);
		return data;
	}

	async fetchGlobalPlanning(
		startDate: string,
		endDate: string,
		userId?: number,
	): Promise<TaskPlan[]> {
		const params = new URLSearchParams({
			start_date: startDate,
			end_date: endDate,
		});
		if (userId) {
			params.append("user_id", userId.toString());
		}

		const { data } = await api.get<TaskPlan[]>(
			`/planning?${params.toString()}`,
		);
		return data;
	}

	async fetchPlanningUsers(): Promise<PlanningUser[]> {
		const { data } = await api.get<PlanningUser[]>("/planning/users");
		return data;
	}

	async fetchPlanningTasks(userId: number): Promise<PlanningTaskOption[]> {
		const { data } = await api.get<PlanningTaskOption[]>(
			`/planning/tasks?user_id=${userId}`,
		);
		return data;
	}

	async addTimeTrack(
		taskId: number,
		request: CreateTimeTrackRequest,
	): Promise<TaskTimeTrack> {
		const { data } = await api.post<TaskTimeTrack>(
			`/tasks/${taskId}/time-tracks`,
			request,
		);
		return data;
	}

	async updateTimeTrack(
		taskId: number,
		trackId: number,
		request: { comment: string; time_spent?: number },
	): Promise<TaskTimeTrack> {
		const { data } = await api.put<TaskTimeTrack>(
			`/tasks/${taskId}/time-tracks/${trackId}`,
			request,
		);
		return data;
	}

	async deleteTimeTrack(taskId: number, trackId: number): Promise<void> {
		await api.delete(`/tasks/${taskId}/time-tracks/${trackId}`);
	}

	async fetchWorkspacePlanning(
		workspaceId: number,
		startDate: string,
		endDate: string,
		userId?: number,
	): Promise<TaskPlan[]> {
		const params = new URLSearchParams({
			start_date: startDate,
			end_date: endDate,
		});
		if (userId) {
			params.append("user_id", userId.toString());
		}

		const { data } = await api.get<TaskPlan[]>(
			`/workspaces/${workspaceId}/planning?${params.toString()}`,
		);
		return data;
	}

	async createTaskPlan(
		taskId: number,
		request: CreateTaskPlanRequest,
	): Promise<TaskPlan> {
		const { data } = await api.post<TaskPlan>(
			`/tasks/${taskId}/planning`,
			request,
		);
		return data;
	}

	async updateTaskPlan(
		planId: number,
		request: UpdateTaskPlanRequest,
	): Promise<TaskPlan> {
		const { data } = await api.put<TaskPlan>(
			`/planning/${planId}`,
			request,
		);
		return data;
	}

	async deleteTaskPlan(planId: number): Promise<void> {
		await api.delete(`/planning/${planId}`);
	}
}

export const tasksService = new TasksService();
