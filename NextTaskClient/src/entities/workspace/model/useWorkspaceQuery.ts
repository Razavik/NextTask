import { useQuery, useQueryClient } from "@tanstack/react-query";
import { workspacesService } from "./workspaces.service";
import { useEffect } from "react";

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
			id ? workspacesService.fetchWorkspace(id) : Promise.reject("no id"),
		enabled: !!id,
		staleTime: 60_000,
	});
}
