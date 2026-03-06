import type { Task } from "@shared/types/task";

export type TaskStatus = "todo" | "progress" | "done";

export interface KanbanColumn {
	id: TaskStatus;
	title: string;
	tasks: Task[];
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
	todo: "К выполнению",
	progress: "В процессе",
	done: "Выполнено",
};

export const STATUS_ORDER: TaskStatus[] = ["todo", "progress", "done"];
