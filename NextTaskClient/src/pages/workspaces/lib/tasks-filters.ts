import type { Task } from "@shared/types/task";

export const getUpcomingTasks = (tasks: Task[], limit: number = 4): Task[] => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	return tasks
		.filter((t: Task) => {
			if (t.status === "done" || !t.due_date) return false;
			const dueDate = new Date(t.due_date);
			dueDate.setHours(0, 0, 0, 0);
			return dueDate >= today; // Только будущие или сегодняшние дедлайны
		})
		.slice(0, limit);
};

export const getOverdueTasks = (tasks: Task[], limit: number = 4): Task[] => {
	return tasks
		.filter((t: Task) => {
			if (t.status === "done" || !t.due_date) return false;
			const dueDate = new Date(t.due_date);
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			dueDate.setHours(0, 0, 0, 0);
			return dueDate < today;
		})
		.slice(0, limit);
};

export const getTotalTasks = (workspaces: any[]): number => {
	return workspaces.reduce(
		(acc: number, w: any) => acc + (w.tasks_count || 0),
		0,
	);
};
