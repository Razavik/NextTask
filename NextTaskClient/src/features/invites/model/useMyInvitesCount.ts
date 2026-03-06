import { useQuery } from "@tanstack/react-query";
import { getMyInvites } from "./invites.service";

/**
 * Возвращает количество входящих приглашений текущего пользователя.
 * Под капотом использует тот же ключ, что и список приглашений в профиле,
 * чтобы шарить кэш и не дублировать запросы.
 */
export function useMyInvitesCount(options?: {
	enabled?: boolean;
	refetchIntervalMs?: number;
}) {
	const enabled = options?.enabled ?? true;
	const refetchInterval = options?.refetchIntervalMs ?? 60_000; // 1 минута по умолчанию

	const { data, isLoading, isError } = useQuery({
		queryKey: ["myInvites"],
		queryFn: getMyInvites,
		staleTime: 30_000,
		refetchOnWindowFocus: true,
		refetchOnMount: "always",
		refetchInterval,
		enabled,
	});

	return {
		count: Array.isArray(data) ? data.length : 0,
		isLoading,
		isError,
	};
}
