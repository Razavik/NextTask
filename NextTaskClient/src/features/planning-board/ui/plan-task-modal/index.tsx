import { FC, useState, useEffect, useMemo } from "react";
import Button from "@shared/ui/button";
import Modal from "@shared/ui/modal";
import Dropdown from "@shared/ui/dropdown";
import Input from "@shared/ui/input";
import type { PlanningTaskOption } from "@shared/types/task";
import styles from "./index.module.css";

interface PlanTaskModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSave: (taskId: number, hours: number) => void;
	tasks: PlanningTaskOption[];
	date: Date;
	currentTotalHours: number;
	isSaving: boolean;
	editPlan?: { id: number; taskId: number; hours: number };
}

export const PlanTaskModal: FC<PlanTaskModalProps> = ({
	isOpen,
	onClose,
	onSave,
	tasks,
	date,
	currentTotalHours,
	isSaving,
	editPlan,
}) => {
	const [selectedTaskId, setSelectedTaskId] = useState<string>("");
	const [hours, setHours] = useState<string>("1");
	const [minutes, setMinutes] = useState<string>("0");

	// Инициализация при редактировании
	useEffect(() => {
		if (editPlan) {
			setSelectedTaskId(editPlan.taskId.toString());
			const wholeHours = Math.floor(editPlan.hours);
			const mins = Math.round((editPlan.hours - wholeHours) * 60);
			setHours(wholeHours.toString());
			setMinutes(mins.toString());
		} else {
			setSelectedTaskId("");
			setHours("1");
			setMinutes("0");
		}
	}, [editPlan, isOpen]);

	const availableTasks = useMemo(() => tasks, [tasks]);

	const numHours = parseFloat(hours);
	const numMinutes = parseFloat(minutes);
	const totalHours = numHours + numMinutes / 60;
	const isValidTime =
		!isNaN(numHours) &&
		!isNaN(numMinutes) &&
		(numHours > 0 || numMinutes > 0);
	const isOverLimit = editPlan
		? currentTotalHours - editPlan.hours + (isValidTime ? totalHours : 0) >
			8
		: currentTotalHours + (isValidTime ? totalHours : 0) > 8;
	const isFormValid = selectedTaskId && isValidTime && !isOverLimit;

	const formattedDate = date.toLocaleDateString("ru-RU", {
		weekday: "long",
		day: "numeric",
		month: "long",
	});

	const taskOptions = useMemo(
		() =>
			availableTasks.map((task) => ({
				value: task.id.toString(),
				label: task.title,
			})),
		[availableTasks],
	);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={editPlan ? "Изменить время" : "Запланировать время"}
			maxWidth="500px"
		>
			<div className={styles.modalBody}>
				<div className={styles.formGroup}>
					<label className={styles.label}>Дата</label>
					<div className={styles.dateDisplay}>{formattedDate}</div>
				</div>

				{editPlan ? (
					<div className={styles.formGroup}>
						<label className={styles.label}>Задача</label>
						<div className={styles.taskDisplay}>
							{tasks.find((t) => t.id === editPlan.taskId)
								?.title || "Задача не найдена"}
						</div>
					</div>
				) : (
					<div className={styles.formGroup}>
						<label className={styles.label}>Задача</label>
						{availableTasks.length > 0 ? (
							<Dropdown
								options={taskOptions}
								value={selectedTaskId}
								onChange={setSelectedTaskId}
								placeholder="Выберите задачу"
							/>
						) : (
							<div className={styles.errorText}>
								Нет доступных задач для планирования.
							</div>
						)}
					</div>
				)}

				<div className={styles.formGroup}>
					<label className={styles.label}>Время</label>
					<div className={styles.timeInputGroup}>
						<div className={styles.timeInputWrapper}>
							<Input
								type="number"
								className={styles.timeInput}
								min="0"
								step="1"
								max="8"
								value={hours}
								onChange={(e) => setHours(e.target.value)}
							/>
							<span className={styles.timeLabel}>ч</span>
						</div>
						<div className={styles.timeInputWrapper}>
							<Input
								type="number"
								className={styles.timeInput}
								min="0"
								step="15"
								max="45"
								value={minutes}
								onChange={(e) => setMinutes(e.target.value)}
							/>
							<span className={styles.timeLabel}>мин</span>
						</div>
						<span className={styles.hoursHint}>
							Уже запланировано: {currentTotalHours} ч. из 8 ч.
						</span>
					</div>
					{isOverLimit && (
						<div className={styles.errorText}>
							Превышен лимит (максимум 8 часов в день)
						</div>
					)}
				</div>

				<div className={styles.footer}>
					<Button
						variant="ghost"
						onClick={onClose}
						disabled={isSaving}
					>
						Отмена
					</Button>
					<Button
						variant="primary"
						onClick={() =>
							onSave(
								Number(editPlan?.taskId || selectedTaskId),
								totalHours,
							)
						}
						disabled={
							!isFormValid ||
							isSaving ||
							availableTasks.length === 0
						}
					>
						{isSaving ? "Сохранение..." : "Сохранить"}
					</Button>
				</div>
			</div>
		</Modal>
	);
};
