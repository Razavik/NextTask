import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspacesService } from "./workspaces.service";
import type { WorkspaceMember } from "@shared/types/workspace";

/**
 * React Query hook для получения участников рабочего пространства.
 * Кэшируется по ключу ["workspace", workspaceId, "members"],
 * чтобы избежать лишних сетевых запросов при повторных рендерах.
 */
export const useWorkspaceMembersQuery = (workspaceId?: number) => {
	return useQuery<WorkspaceMember[]>({
		queryKey: ["workspace", workspaceId, "members"],
		queryFn: () => {
			if (!workspaceId) return Promise.resolve([]);
			return workspacesService.fetchWorkspaceUsers(workspaceId);
		},
		enabled: !!workspaceId,
		staleTime: 1000 * 60, // 1 мин — можно настроить позже
	});
};

/**
 * Хук-утилита для инвалидации списка участников конкретного пространства.
 * Вызывайте после мутаций: выход из пространства, исключение участника, смена роли и т.п.
 */
export const useInvalidateWorkspaceMembers = (workspaceId?: number) => {
	const queryClient = useQueryClient();
	return () => {
		if (!workspaceId) return;
		queryClient.invalidateQueries({
			queryKey: ["workspace", workspaceId, "members"],
		});
	};
};
