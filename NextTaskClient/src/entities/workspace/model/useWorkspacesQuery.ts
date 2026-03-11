import { useQuery } from "@tanstack/react-query";
import { apiService, ApiRoute } from "@shared/api";
import { Workspace } from "@shared/types/workspace";

export function useWorkspacesQuery(userId?: number) {
	return useQuery<Workspace[], Error>({
		queryKey: ["workspaces", userId],
		queryFn: () => apiService.get<Workspace[]>(ApiRoute.Workspaces),
		enabled: !!userId,
		staleTime: 60_000,
	});
}
