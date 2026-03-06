import { useQuery } from "@tanstack/react-query";
import { tasksService } from "./tasks.service";
import type { Task } from "@shared/types/task";

export function useTasksQuery(workspaceId?: number) {
	return useQuery<Task[], Error>({
		queryKey: ["tasks", workspaceId],
		queryFn: async () => {
			if (!workspaceId) return [];
			try {
				return await tasksService.fetchTasks(workspaceId);
			} catch (error) {
				console.error("Failed to fetch tasks:", error);
				return [];
			}
		},
		enabled: !!workspaceId,
		staleTime: 60_000,
	});
}
