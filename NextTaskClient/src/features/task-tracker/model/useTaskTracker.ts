import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksService } from "@entities/task";
import {
	useToastStore,
	createErrorToast,
	createSuccessToast,
} from "@shared/model/toastStore";
import type { Task, TaskTimeTrack } from "@shared/types/task";

interface UseTaskTrackerProps {
	taskId: number;
	workspaceId: number;
	onTaskUpdated?: (task: Task) => void;
}

export const useTaskTracker = ({
	taskId,
	workspaceId,
	onTaskUpdated,
}: UseTaskTrackerProps) => {
	const queryClient = useQueryClient();
	const addToast = useToastStore((state) => state.addToast);

	const [isTracking, setIsTracking] = useState(false);
	const [localTimeSpent, setLocalTimeSpent] = useState(0); // Время, натреканное в текущей сессии
	const [comment, setComment] = useState("");
	const intervalRef = useRef<NodeJS.Timeout | null>(null);

	const { data: timeTracks = [], isLoading: isLoadingTracks } = useQuery({
		queryKey: ["task-time-tracks", taskId],
		queryFn: () => tasksService.fetchTimeTracks(taskId),
		enabled: !!taskId,
	});

	const addTimeTrackMutation = useMutation({
		mutationFn: (data: { time_spent: number; comment?: string }) =>
			tasksService.addTimeTrack(taskId, data),
		onSuccess: (newTrack) => {
			queryClient.setQueryData<TaskTimeTrack[]>(
				["task-time-tracks", taskId],
				(old = []) => [newTrack, ...old],
			);

			queryClient.setQueryData<Task | undefined>(
				["task", workspaceId, taskId],
				(prev) => {
					if (!prev) return prev;
					const updatedTask = {
						...prev,
						time_spent:
							(prev.time_spent || 0) + newTrack.time_spent,
					};
					onTaskUpdated?.(updatedTask);
					return updatedTask;
				},
			);

			addToast(createSuccessToast("Время сохранено"));
			setLocalTimeSpent(0);
			setComment("");
		},
		onError: () => {
			addToast(createErrorToast("Ошибка", "Не удалось сохранить время"));
		},
	});

	// Эффект для управления таймером
	useEffect(() => {
		if (isTracking) {
			// Запускаем таймер
			intervalRef.current = setInterval(() => {
				setLocalTimeSpent((prev) => prev + 1);
			}, 1000); // Увеличиваем на 1 секунду
		} else {
			// Останавливаем таймер
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		}

		// Очистка при размонтировании
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [isTracking]);

	const toggleTracking = useCallback(() => {
		setIsTracking((prev) => !prev);
	}, []);

	const saveTimeTrack = useCallback(() => {
		if (localTimeSpent === 0 && !comment.trim()) {
			return; // Ничего не сохраняем, если нечего
		}

		if (isTracking) {
			setIsTracking(false);
		}

		if (localTimeSpent > 0) {
			addTimeTrackMutation.mutate({
				time_spent: localTimeSpent,
				comment: comment.trim() || undefined,
			});
		} else {
			addToast(createErrorToast("Ошибка", "Добавлено 0 секунд"));
		}
	}, [isTracking, localTimeSpent, comment, addTimeTrackMutation, addToast]);

	const addManualTimeTrack = useCallback(
		(timeInSeconds: number, manualComment: string) => {
			if (timeInSeconds <= 0) return;
			addTimeTrackMutation.mutate({
				time_spent: timeInSeconds,
				comment: manualComment.trim() || undefined,
			});
		},
		[addTimeTrackMutation],
	);

	return {
		isTracking,
		localTimeSpent,
		setLocalTimeSpent,
		comment,
		setComment,
		timeTracks,
		isLoadingTracks,
		isSaving: addTimeTrackMutation.isPending,
		toggleTracking,
		saveTimeTrack,
		addManualTimeTrack,
	};
};
