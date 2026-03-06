import { FC, useState } from "react";
import { History } from "lucide-react";
import ConfirmModal from "@shared/ui/confirm-modal";
import type { Task } from "@shared/types/task";
import { tasksService } from "@entities/task";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@entities/user";
import {
	useToastStore,
	createSuccessToast,
	createErrorToast,
} from "@shared/model/toastStore";
import styles from "./index.module.css";
import { useTaskTracker } from "../model/useTaskTracker";
import Loader from "@shared/ui/loader";
import { TimerPanel } from "./components/timer-panel";
import { TrackItem } from "./components/track-item";

interface TaskTrackerProps {
	task: Task;
	workspaceId: number;
	onTaskUpdated?: (task: Task) => void;
}

const formatTime = (seconds: number) => {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;

	const pad = (num: number) => num.toString().padStart(2, "0");

	if (h > 0) {
		return `${pad(h)}:${pad(m)}:${pad(s)}`;
	}
	return `00:${pad(m)}:${pad(s)}`;
};

const TaskTracker: FC<TaskTrackerProps> = ({
	task,
	workspaceId,
	onTaskUpdated,
}) => {
	const queryClient = useQueryClient();
	const { user: currentUser } = useAuthStore();
	const addToast = useToastStore((state) => state.addToast);

	const {
		isTracking,
		localTimeSpent,
		comment,
		setComment,
		timeTracks,
		isLoadingTracks,
		isSaving,
		toggleTracking,
		saveTimeTrack,
		addManualTimeTrack,
	} = useTaskTracker({
		taskId: task.id,
		workspaceId,
		onTaskUpdated,
	});

	const [isManualInput, setIsManualInput] = useState(false);
	const [manualHours, setManualHours] = useState("");
	const [manualMinutes, setManualMinutes] = useState("");
	const [editingTrackId, setEditingTrackId] = useState<number | null>(null);
	const [editingComment, setEditingComment] = useState("");
	const [editingTimeSpent, setEditingTimeSpent] = useState("");
	const [editingHours, setEditingHours] = useState("");
	const [editingMinutes, setEditingMinutes] = useState("");
	const [editingSeconds, setEditingSeconds] = useState("");
	const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
	const [deleteTrackId, setDeleteTrackId] = useState<number | null>(null);
	const [deleteTimeSpent, setDeleteTimeSpent] = useState<number>(0);

	// Группируем треки по дням
	const groupedTracks = timeTracks.reduce(
		(acc, track) => {
			const date = new Date(track.created_at).toLocaleDateString(
				"ru-RU",
				{
					day: "2-digit",
					month: "2-digit",
					year: "numeric",
				},
			);
			if (!acc[date]) acc[date] = [];
			acc[date].push(track);
			return acc;
		},
		{} as Record<string, typeof timeTracks>,
	);

	const handleSaveManualTime = () => {
		const h = parseInt(manualHours || "0", 10);
		const m = parseInt(manualMinutes || "0", 10);
		const totalSeconds = h * 3600 + m * 60;
		if (totalSeconds > 0) {
			addManualTimeTrack(totalSeconds, comment);
			setManualHours("");
			setManualMinutes("");
			setIsManualInput(false);
		}
	};

	const handleEditTrack = (
		trackId: number,
		currentComment: string | null | undefined,
		currentTimeSpent: number,
	) => {
		setEditingTrackId(trackId);
		setEditingComment(currentComment || "");
		setEditingTimeSpent(currentTimeSpent.toString());

		// Конвертируем секунды в часы, минуты и секунды
		const hours = Math.floor(currentTimeSpent / 3600);
		const minutes = Math.floor((currentTimeSpent % 3600) / 60);
		const seconds = currentTimeSpent % 60;
		setEditingHours(hours.toString());
		setEditingMinutes(minutes.toString());
		setEditingSeconds(seconds.toString());
	};

	const handleSaveEdit = async (trackId: number) => {
		try {
			// Конвертируем часы, минуты и секунды в секунды
			const h = parseInt(editingHours || "0", 10);
			const m = parseInt(editingMinutes || "0", 10);
			const s = parseInt(editingSeconds || "0", 10);
			const newTimeSpent = h * 3600 + m * 60 + s;

			const updateData: { comment: string; time_spent?: number } = {
				comment: editingComment,
			};

			// Включаем время только если оно изменилось
			if (newTimeSpent !== parseInt(editingTimeSpent, 10)) {
				updateData.time_spent = newTimeSpent;
			}

			const updatedTrack = await tasksService.updateTimeTrack(
				task.id,
				trackId,
				updateData,
			);

			// Обновляем локальный кэш
			queryClient.setQueryData(
				["task-time-tracks", task.id],
				(old: any[] = []) =>
					old.map((track) =>
						track.id === trackId ? updatedTrack : track,
					),
			);

			// Если время изменилось, обновляем и задачу
			if (updateData.time_spent) {
				const oldTimeSpent = parseInt(editingTimeSpent, 10);
				const timeDiff = newTimeSpent - oldTimeSpent;

				queryClient.setQueryData(
					["task", workspaceId, task.id],
					(prev: any) => {
						if (!prev) return prev;
						return {
							...prev,
							time_spent: (prev.time_spent || 0) + timeDiff,
						};
					},
				);

				onTaskUpdated?.({
					...task,
					time_spent: (task.time_spent || 0) + timeDiff,
				});
			}

			// Показываем успешный тост
			addToast(createSuccessToast("Запись о времени успешно обновлена"));

			setEditingTrackId(null);
			setEditingComment("");
			setEditingTimeSpent("");
			setEditingHours("");
			setEditingMinutes("");
			setEditingSeconds("");
		} catch (error) {
			console.error("Failed to update track:", error);
			addToast(createErrorToast("Не удалось обновить запись о времени"));
		}
	};

	const handleCancelEdit = () => {
		setEditingTrackId(null);
		setEditingComment("");
		setEditingTimeSpent("");
		setEditingHours("");
		setEditingMinutes("");
		setEditingSeconds("");
	};

	const handleDeleteTrack = async (trackId: number, timeSpent: number) => {
		setDeleteTrackId(trackId);
		setDeleteTimeSpent(timeSpent);
		setDeleteConfirmOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!deleteTrackId) return;

		try {
			await tasksService.deleteTimeTrack(task.id, deleteTrackId);

			// Обновляем локальный кэш - удаляем трек
			queryClient.setQueryData(
				["task-time-tracks", task.id],
				(old: any[] = []) =>
					old.filter((track) => track.id !== deleteTrackId),
			);

			// Обновляем общее время задачи
			queryClient.setQueryData(
				["task", workspaceId, task.id],
				(prev: any) => {
					if (!prev) return prev;
					return {
						...prev,
						time_spent: Math.max(
							0,
							(prev.time_spent || 0) - deleteTimeSpent,
						),
					};
				},
			);

			onTaskUpdated?.({
				...task,
				time_spent: Math.max(
					0,
					(task.time_spent || 0) - deleteTimeSpent,
				),
			});

			// Показываем успешный тост
			addToast(createSuccessToast("Запись о времени успешно удалена"));

			// Закрываем модалку и сбрасываем состояние
			setDeleteConfirmOpen(false);
			setDeleteTrackId(null);
			setDeleteTimeSpent(0);
		} catch (error) {
			console.error("Failed to delete track:", error);
			addToast(createErrorToast("Не удалось удалить запись о времени"));
		}
	};

	const handleCancelDelete = () => {
		setDeleteConfirmOpen(false);
		setDeleteTrackId(null);
		setDeleteTimeSpent(0);
	};

	const canSaveTime = isManualInput
		? parseInt(manualHours || "0", 10) > 0 ||
			parseInt(manualMinutes || "0", 10) > 0
		: localTimeSpent > 0;

	return (
		<>
			<div className={styles.container}>
				<TimerPanel
					isTracking={isTracking}
					isManualInput={isManualInput}
					isSaving={isSaving}
					localTimeSpent={localTimeSpent}
					comment={comment}
					manualHours={manualHours}
					manualMinutes={manualMinutes}
					canSaveTime={canSaveTime}
					setComment={setComment}
					setManualHours={setManualHours}
					setManualMinutes={setManualMinutes}
					setIsManualInput={setIsManualInput}
					toggleTracking={toggleTracking}
					handleSaveManualTime={handleSaveManualTime}
					saveTimeTrack={saveTimeTrack}
					formatTime={formatTime}
				/>

				<div className={styles.historyPanel}>
					<div className={styles.historyHeader}>
						<h3 className={styles.historyTitle}>
							<History size={20} className={styles.historyIcon} />
							История
						</h3>
						<span className={styles.totalTime}>
							Итого: {formatTime(task.time_spent || 0)}
						</span>
					</div>

					{isLoadingTracks ? (
						<div className={styles.loaderWrapper}>
							<Loader />
						</div>
					) : timeTracks.length === 0 ? (
						<div className={styles.emptyHistory}>
							Нет записей о затраченном времени
						</div>
					) : (
						<div className={styles.historyList}>
							{Object.entries(groupedTracks).map(
								([date, tracks]) => (
									<div
										key={date}
										className={styles.historyDay}
									>
										<div className={styles.dayDate}>
											{date}
										</div>
										{tracks.map((track) => (
											<TrackItem
												key={track.id}
												track={track}
												currentUser={currentUser}
												editingTrackId={editingTrackId}
												editingComment={editingComment}
												editingHours={editingHours}
												editingMinutes={editingMinutes}
												editingSeconds={editingSeconds}
												setEditingComment={
													setEditingComment
												}
												setEditingHours={
													setEditingHours
												}
												setEditingMinutes={
													setEditingMinutes
												}
												setEditingSeconds={
													setEditingSeconds
												}
												handleSaveEdit={handleSaveEdit}
												handleCancelEdit={
													handleCancelEdit
												}
												handleEditTrack={
													handleEditTrack
												}
												handleDeleteTrack={
													handleDeleteTrack
												}
												formatTime={formatTime}
											/>
										))}
									</div>
								),
							)}
						</div>
					)}
				</div>
			</div>

			<ConfirmModal
				open={deleteConfirmOpen}
				title="Удалить запись о времени"
				message={`Вы уверены, что хотите удалить запись о затраченном времени (${formatTime(deleteTimeSpent)})? Это действие нельзя отменить.`}
				confirmLabel="Удалить"
				cancelLabel="Отмена"
				variant="danger"
				onConfirm={handleConfirmDelete}
				onCancel={handleCancelDelete}
			/>
		</>
	);
};

export default TaskTracker;
