import { useQuery } from "@tanstack/react-query";
import { apiService, ApiRoute } from "@shared/api";
import type { Task, TasksResponse } from "@shared/types/task";

export function useMyTasksQuery(userId?: number) {
	return useQuery<Task[], Error>({
		queryKey: ["my-tasks", userId],
		queryFn: async () => {
			if (!userId) return [];
			try {
				const response = await apiService.get<TasksResponse>(
					ApiRoute.TasksMy,
				);
				return response.tasks;
			} catch (error) {
				console.error("Failed to fetch my tasks:", error);
				return [];
			}
		},
		enabled: !!userId,
		staleTime: 60_000,
	});
}
