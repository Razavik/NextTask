import { useQuery } from "@tanstack/react-query";
import { tasksService } from "./tasks.service";
import type { Task } from "@shared/types/task";

export function useMyTasksQuery(userId?: number) {
	return useQuery<Task[], Error>({
		queryKey: ["my-tasks", userId],
		queryFn: async () => {
			if (!userId) return [];
			try {
				return await tasksService.fetchMyTasks();
			} catch (error) {
				console.error("Failed to fetch my tasks:", error);
				return [];
			}
		},
		enabled: !!userId,
		staleTime: 60_000,
	});
}
