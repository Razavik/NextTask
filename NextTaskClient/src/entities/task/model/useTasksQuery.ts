import { useQuery } from "@tanstack/react-query";
import { apiService, ApiRoute } from "@shared/api";
import type { Task, TasksResponse } from "@shared/types/task";

export function useTasksQuery(workspaceId?: number) {
	return useQuery<Task[], Error>({
		queryKey: ["tasks", workspaceId],
		queryFn: async () => {
			if (!workspaceId) return [];
			try {
				const response = await apiService.get<TasksResponse>(
					`${ApiRoute.WorkspaceById}/tasks`,
					{
						pathParams: { workspaceId },
					},
				);
				return response.tasks;
			} catch (error) {
				console.error("Failed to fetch tasks:", error);
				return [];
			}
		},
		enabled: !!workspaceId,
		staleTime: 60_000,
	});
}
