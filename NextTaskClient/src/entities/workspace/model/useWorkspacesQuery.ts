import { useQuery } from "@tanstack/react-query";
import { workspacesService } from "./workspaces.service";
import { Workspace } from "@shared/types/workspace";

export function useWorkspacesQuery(userId?: number) {
	return useQuery<Workspace[], Error>({
		queryKey: ["workspaces", userId],
		queryFn: () => workspacesService.fetchWorkspaces(),
		enabled: !!userId,
		staleTime: 60_000,
	});
}
