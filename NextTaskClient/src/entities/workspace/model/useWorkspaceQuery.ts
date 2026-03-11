import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { apiService, ApiRoute } from "@shared/api";
import type { Workspace } from "@shared/types/workspace";

export function useWorkspaceQuery(id?: number, userId?: number) {
	const queryClient = useQueryClient();

	// Если сменился пользователь — инвалидируем связанные данные рабочего пространства
	useEffect(() => {
		if (id) {
			queryClient.invalidateQueries({
				queryKey: ["workspace", id],
				exact: false,
			});
		}
	}, [id, userId, queryClient]);

	return useQuery({
		queryKey: ["workspace", id, userId],
		queryFn: () =>
			id
				? apiService.get<Workspace>(ApiRoute.WorkspaceById, {
						pathParams: { workspaceId: id },
					})
				: Promise.reject("no id"),
		enabled: !!id,
		staleTime: 60_000,
	});
}
