import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksService } from "@entities/task";
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
} from "@shared/types/task";

export const usePlanningBoard = (
	userId?: number,
	startDate?: string,
	endDate?: string,
) => {
	const queryClient = useQueryClient();
	const queryKey = ["planning", "global", startDate, endDate, userId];

	const { data: plans = [], isLoading } = useQuery({
		queryKey,
		queryFn: () =>
			tasksService.fetchGlobalPlanning(startDate!, endDate!, userId),
		enabled: !!startDate && !!endDate,
	});

	const { data: planningUsers = [], isLoading: isLoadingUsers } = useQuery<
		PlanningUser[]
	>({
		queryKey: ["planning", "users"],
		queryFn: () => tasksService.fetchPlanningUsers(),
	});

	const { data: planningTasks = [], isLoading: isLoadingTasks } = useQuery<
		PlanningTaskOption[]
	>({
		queryKey: ["planning", "tasks", userId],
		queryFn: () => tasksService.fetchPlanningTasks(userId!),
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
				return tasksService.updateTaskPlan(existingPlan.id, {
					hours: existingPlan.hours + request.hours,
				});
			} else {
				// Если плана нет, создаем новый
				return tasksService.createTaskPlan(request.task_id, request);
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
		onError: (error: any) => {
			const message =
				error.response?.data?.detail ||
				"Ошибка при планировании времени";
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
		}) => tasksService.updateTaskPlan(planId, request),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["planning", "global"],
			});
			useToastStore
				.getState()
				.addToast(createSuccessToast("План обновлен"));
		},
		onError: (error: any) => {
			const message =
				error.response?.data?.detail || "Ошибка при обновлении плана";
			useToastStore.getState().addToast(createErrorToast(message));
		},
	});

	const { mutate: deletePlan, isPending: isDeleting } = useMutation({
		mutationFn: (planId: number) => tasksService.deleteTaskPlan(planId),
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
