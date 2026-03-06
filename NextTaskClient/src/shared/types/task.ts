// Типы задач. Используются по всему фронтенду
// Внимание: комментарии на русском по требованию стиля проекта

export interface TaskAssignee {
	id: number;
	name: string | null;
	email: string;
	position?: string | null;
	avatar?: string | null;
}

export interface Task {
	id: number;
	title: string;
	content?: string;
	status: string; // 'todo' | 'progress' | 'done'
	priority: string; // 'low' | 'medium' | 'high'
	due_date?: string; // ISO дата
	time_spent?: number; // Потраченное время в секундах
	created_at?: string; // ISO дата создания
	assignees_ids?: number[]; // Массив ID исполнителей
	assignees?: TaskAssignee[] | null; // Полные данные об исполнителях (если вернул API)
	owner_id: number;
	workspace_id: number;
	author?: {
		id: number;
		name: string;
		position?: string | null;
		email?: string;
	};
}

export interface CreateTaskRequest {
	title: string;
	content?: string;
	due_date?: string;
	status: "todo" | "progress" | "done";
	priority: "low" | "medium" | "high";
	assignees_ids?: number[]; // Исполнители (по желанию)
}

export interface UpdateTaskRequest {
	title?: string;
	content?: string;
	due_date?: string;
	status?: "todo" | "progress" | "done";
	priority?: "low" | "medium" | "high";
	time_spent?: number;
	assignees_ids?: number[] | null;
}

export interface TaskResponse {
	task: Task;
	message?: string;
}

export interface TasksResponse {
	tasks: Task[];
}

export interface TaskTimeTrack {
	id: number;
	task_id: number;
	user_id: number;
	time_spent: number;
	comment?: string | null;
	created_at: string;
	user?: {
		id: number;
		name: string | null;
		email: string;
		avatar?: string | null;
		position?: string | null;
	} | null;
}

export interface CreateTimeTrackRequest {
	time_spent: number;
	comment?: string | null;
}

export interface TaskPlan {
	id: number;
	task_id: number;
	user_id: number;
	workspace_id: number;
	date: string; // YYYY-MM-DD
	hours: number;
	created_at: string;
	updated_at?: string;
	created_by: {
		id: number;
		name: string | null;
		email: string;
		avatar?: string | null;
		position?: string | null;
	} | null;
}

export interface CreateTaskPlanRequest {
	task_id: number;
	user_id: number;
	date: string;
	hours: number;
}

export interface UpdateTaskPlanRequest {
	hours: number;
}

export interface PlanningUser {
	id: number;
	email: string;
	name?: string | null;
	position?: string | null;
	avatar?: string | null;
	is_active: boolean;
	created_at: string;
	updated_at?: string | null;
}

export interface PlanningTaskOption {
	id: number;
	title: string;
	workspace_id: number;
}
