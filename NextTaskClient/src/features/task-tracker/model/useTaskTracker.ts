import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiService, ApiRoute } from "@shared/api";
import {
	useToastStore,
	createErrorToast,
	createSuccessToast,
} from "@shared/model/toastStore";
import type {
	CreateTimeTrackRequest,
	Task,
	TaskTimeTrack,
} from "@shared/types/task";

interface UseTaskTrackerProps {
	taskId: number;
	workspaceId: number;
	onTaskUpdated?: (task: Task) => void;
}

interface PersistedTrackingSession {
	taskId: number;
	workspaceId: number;
	accumulatedSeconds: number;
	startedAt: number | null;
	comment: string;
}

const TRACKING_SESSION_STORAGE_KEY = "active-task-tracking-session";

const readTrackingSession = (): PersistedTrackingSession | null => {
	try {
		const rawValue = localStorage.getItem(TRACKING_SESSION_STORAGE_KEY);
		if (!rawValue) return null;

		const parsed = JSON.parse(
			rawValue,
		) as Partial<PersistedTrackingSession>;
		if (
			typeof parsed.taskId !== "number" ||
			typeof parsed.workspaceId !== "number" ||
			typeof parsed.accumulatedSeconds !== "number" ||
			typeof parsed.comment !== "string"
		) {
			return null;
		}

		return {
			taskId: parsed.taskId,
			workspaceId: parsed.workspaceId,
			accumulatedSeconds: parsed.accumulatedSeconds,
			startedAt:
				typeof parsed.startedAt === "number" ? parsed.startedAt : null,
			comment: parsed.comment,
		};
	} catch {
		return null;
	}
};

const writeTrackingSession = (session: PersistedTrackingSession | null) => {
	try {
		if (!session) {
			localStorage.removeItem(TRACKING_SESSION_STORAGE_KEY);
			return;
		}

		localStorage.setItem(
			TRACKING_SESSION_STORAGE_KEY,
			JSON.stringify(session),
		);
	} catch {}
};

const getElapsedSeconds = (session: PersistedTrackingSession) => {
	if (!session.startedAt) {
		return session.accumulatedSeconds;
	}

	return (
		session.accumulatedSeconds +
		Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000))
	);
};

const invalidateSessionQueries = (
	queryClient: ReturnType<typeof useQueryClient>,
	session: PersistedTrackingSession,
) => {
	queryClient.invalidateQueries({
		queryKey: ["task", session.workspaceId, session.taskId],
	});
	queryClient.invalidateQueries({
		queryKey: ["task-time-tracks", session.taskId],
	});
	queryClient.invalidateQueries({
		queryKey: ["tasks", session.workspaceId],
	});
	queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
};

export const useTaskTracker = ({
	taskId,
	workspaceId,
	onTaskUpdated,
}: UseTaskTrackerProps) => {
	const queryClient = useQueryClient();
	const addToast = useToastStore((state) => state.addToast);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const invalidateTaskQueries = useCallback(() => {
		queryClient.invalidateQueries({
			queryKey: ["task", workspaceId, taskId],
		});
		queryClient.invalidateQueries({ queryKey: ["tasks", workspaceId] });
		queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
	}, [queryClient, taskId, workspaceId]);

	const [isTracking, setIsTracking] = useState(false);
	const [localTimeSpent, setLocalTimeSpent] = useState(0);
	const [comment, setComment] = useState("");

	const { data: timeTracks = [], isLoading: isLoadingTracks } = useQuery<
		TaskTimeTrack[]
	>({
		queryKey: ["task-time-tracks", taskId],
		queryFn: () =>
			apiService.get<TaskTimeTrack[]>(ApiRoute.TaskTimeTracks, {
				pathParams: { taskId },
			}),
		enabled: !!taskId,
	});

	const addTimeTrackMutation = useMutation({
		mutationFn: (data: CreateTimeTrackRequest) =>
			apiService.post<TaskTimeTrack, CreateTimeTrackRequest>(
				ApiRoute.TaskTimeTracks,
				data,
				{
					pathParams: { taskId },
				},
			),
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

			invalidateTaskQueries();
			writeTrackingSession(null);
			setLocalTimeSpent(0);
			setComment("");
			setIsTracking(false);
			addToast(createSuccessToast("Время сохранено"));
		},
		onError: () => {
			addToast(createErrorToast("Ошибка", "Не удалось сохранить время"));
		},
	});

	useEffect(() => {
		const savedSession = readTrackingSession();
		if (!savedSession || savedSession.taskId !== taskId) {
			setIsTracking(false);
			setLocalTimeSpent(0);
			setComment("");
			return;
		}

		setComment(savedSession.comment);
		setLocalTimeSpent(getElapsedSeconds(savedSession));
		setIsTracking(savedSession.startedAt !== null);
	}, [taskId]);

	useEffect(() => {
		if (!isTracking) {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			return;
		}

		const updateElapsedTime = () => {
			const session = readTrackingSession();
			if (!session || session.taskId !== taskId || !session.startedAt) {
				setIsTracking(false);
				return;
			}

			setLocalTimeSpent(getElapsedSeconds(session));
		};

		updateElapsedTime();
		intervalRef.current = setInterval(updateElapsedTime, 1000);

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		};
	}, [isTracking, taskId]);

	useEffect(() => {
		const savedSession = readTrackingSession();
		if (!savedSession || savedSession.taskId !== taskId) {
			return;
		}

		writeTrackingSession({
			...savedSession,
			comment,
			accumulatedSeconds: savedSession.startedAt
				? savedSession.accumulatedSeconds
				: localTimeSpent,
		});
	}, [comment, localTimeSpent, taskId]);

	const toggleTracking = useCallback(async () => {
		const savedSession = readTrackingSession();
		const currentSession: PersistedTrackingSession =
			savedSession && savedSession.taskId === taskId
				? savedSession
				: {
						taskId,
						workspaceId,
						accumulatedSeconds: localTimeSpent,
						startedAt: null,
						comment,
					};

		if (currentSession.startedAt) {
			const pausedSeconds = getElapsedSeconds(currentSession);
			writeTrackingSession({
				...currentSession,
				accumulatedSeconds: pausedSeconds,
				startedAt: null,
				comment,
			});
			setLocalTimeSpent(pausedSeconds);
			setIsTracking(false);
			return;
		}

		if (
			savedSession &&
			savedSession.taskId !== taskId &&
			savedSession.startedAt
		) {
			const previousSessionSeconds = getElapsedSeconds(savedSession);
			if (previousSessionSeconds > 0) {
				try {
					await apiService.post<
						TaskTimeTrack,
						CreateTimeTrackRequest
					>(
						ApiRoute.TaskTimeTracks,
						{
							time_spent: previousSessionSeconds,
						},
						{
							pathParams: { taskId: savedSession.taskId },
						},
					);
					invalidateSessionQueries(queryClient, savedSession);
				} catch {
					addToast(
						createErrorToast(
							"Ошибка",
							"Не удалось сохранить время предыдущей задачи",
						),
					);
					return;
				}
			}
		}

		writeTrackingSession({
			...currentSession,
			accumulatedSeconds: localTimeSpent,
			startedAt: Date.now(),
			comment,
		});
		setIsTracking(true);
	}, [addToast, comment, localTimeSpent, queryClient, taskId, workspaceId]);

	const saveTimeTrack = useCallback(() => {
		const savedSession = readTrackingSession();
		const secondsToSave =
			savedSession && savedSession.taskId === taskId
				? getElapsedSeconds(savedSession)
				: localTimeSpent;

		if (secondsToSave === 0 && !comment.trim()) {
			return;
		}

		if (savedSession && savedSession.taskId === taskId) {
			writeTrackingSession({
				...savedSession,
				accumulatedSeconds: secondsToSave,
				startedAt: null,
				comment,
			});
		}

		if (secondsToSave > 0) {
			setLocalTimeSpent(secondsToSave);
			setIsTracking(false);
			addTimeTrackMutation.mutate({
				time_spent: secondsToSave,
				comment: comment.trim() || undefined,
			});
			return;
		}

		addToast(createErrorToast("Ошибка", "Добавлено 0 секунд"));
	}, [comment, localTimeSpent, addTimeTrackMutation, addToast, taskId]);

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
