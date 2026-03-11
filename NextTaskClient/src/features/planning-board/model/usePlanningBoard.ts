import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService, ApiRoute } from "@shared/api";
import {
	useToastStore,
	createErrorToast,
	createSuccessToast,
} from "@shared/model/toastStore";
import type {
	CreateTaskPlanRequest,
	UpdateTaskPlanRequest,
	PlanningUser,
	PlanningTaskOption,
	TaskPlan,
} from "@shared/types/task";

const getErrorMessage = (error: unknown, fallback: string) => {
	if (
		error &&
		typeof error === "object" &&
		"response" in error &&
		error.response &&
		typeof error.response === "object" &&
		"data" in error.response &&
		error.response.data &&
		typeof error.response.data === "object" &&
		"detail" in error.response.data &&
		typeof error.response.data.detail === "string"
	) {
		return error.response.data.detail;
	}

	return fallback;
};

export const usePlanningBoard = (
	userId?: number,
	startDate?: string,
	endDate?: string,
) => {
	const queryClient = useQueryClient();
	const queryKey = ["planning", "global", startDate, endDate, userId];

	const { data: plans = [], isLoading } = useQuery<TaskPlan[]>({
		queryKey,
		queryFn: () =>
			apiService.get<TaskPlan[]>(ApiRoute.Planning, {
				query: {
					start_date: startDate!,
					end_date: endDate!,
					user_id: userId,
				},
			}),
		enabled: !!startDate && !!endDate,
	});

	const { data: planningUsers = [], isLoading: isLoadingUsers } = useQuery<
		PlanningUser[]
	>({
		queryKey: ["planning", "users"],
		queryFn: () => apiService.get<PlanningUser[]>(ApiRoute.PlanningUsers),
	});

	const { data: planningTasks = [], isLoading: isLoadingTasks } = useQuery<
		PlanningTaskOption[]
	>({
		queryKey: ["planning", "tasks", userId],
		queryFn: () =>
			apiService.get<PlanningTaskOption[]>(ApiRoute.PlanningTasks, {
				query: { user_id: userId! },
			}),
		enabled: !!userId,
	});

	const { mutate: createPlan, isPending: isCreating } = useMutation({
		mutationFn: (request: CreateTaskPlanRequest) => {
			// Проверяем, есть ли уже план для этой задачи в этот день
			const existingPlan = plans.find(
				(plan) =>
					plan.task_id === request.task_id &&
					plan.date === request.date &&
					plan.user_id === request.user_id,
			);

			if (existingPlan) {
				// Если план существует, обновляем его, суммируя часы
				return apiService.put<TaskPlan, UpdateTaskPlanRequest>(
					ApiRoute.PlanningById,
					{ hours: existingPlan.hours + request.hours },
					{
						pathParams: { planId: existingPlan.id },
					},
				);
			} else {
				// Если плана нет, создаем новый
				return apiService.post<TaskPlan, CreateTaskPlanRequest>(
					ApiRoute.TaskPlanning,
					request,
					{
						pathParams: { taskId: request.task_id },
					},
				);
			}
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["planning", "global"],
			});

			// Проверяем, был ли существующий план
			const existingPlan = plans.find(
				(plan) =>
					plan.task_id === variables.task_id &&
					plan.date === variables.date &&
					plan.user_id === variables.user_id,
			);

			if (existingPlan) {
				useToastStore
					.getState()
					.addToast(
						createSuccessToast(
							"Время добавлено к существующему плану",
						),
					);
			} else {
				useToastStore
					.getState()
					.addToast(createSuccessToast("Время запланировано"));
			}
		},
		onError: (error: unknown) => {
			const message = getErrorMessage(
				error,
				"Ошибка при планировании времени",
			);
			useToastStore.getState().addToast(createErrorToast(message));
		},
	});

	const { mutate: updatePlan, isPending: isUpdating } = useMutation({
		mutationFn: ({
			planId,
			request,
		}: {
			planId: number;
			request: UpdateTaskPlanRequest;
		}) =>
			apiService.put<TaskPlan, UpdateTaskPlanRequest>(
				ApiRoute.PlanningById,
				request,
				{
					pathParams: { planId },
				},
			),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["planning", "global"],
			});
			useToastStore
				.getState()
				.addToast(createSuccessToast("План обновлен"));
		},
		onError: (error: unknown) => {
			const message = getErrorMessage(
				error,
				"Ошибка при обновлении плана",
			);
			useToastStore.getState().addToast(createErrorToast(message));
		},
	});

	const { mutate: deletePlan, isPending: isDeleting } = useMutation({
		mutationFn: (planId: number) =>
			apiService.delete<{ status: string; message: string }>(
				ApiRoute.PlanningById,
				undefined,
				{
					pathParams: { planId },
				},
			),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["planning", "global"],
			});
			useToastStore
				.getState()
				.addToast(createSuccessToast("План удален"));
		},
		onError: () => {
			useToastStore
				.getState()
				.addToast(createErrorToast("Ошибка при удалении плана"));
		},
	});

	return {
		plans,
		isLoading,
		planningUsers,
		isLoadingUsers,
		planningTasks,
		isLoadingTasks,
		createPlan,
		isCreating,
		updatePlan,
		isUpdating,
		deletePlan,
		isDeleting,
	};
};
