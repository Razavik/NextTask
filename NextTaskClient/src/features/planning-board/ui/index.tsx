import { FC, useState, useMemo } from "react";
import { format, startOfWeek, addDays } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import {
	ChevronLeft,
	ChevronRight,
	Plus,
	Trash2,
	Clock,
	Edit2,
} from "lucide-react";
import Button from "@shared/ui/button";
import { useAuthStore } from "@entities/user";
import Dropdown from "@shared/ui/dropdown";
import { usePlanningBoard } from "../model/usePlanningBoard";
import { PlanTaskModal } from "./plan-task-modal";
import type { PlanningTaskOption } from "@shared/types/task";
import styles from "./index.module.css";
import Loader from "@shared/ui/loader";

const DAYS_IN_WEEK = 5; // Показывать только будние дни (пн-пт)

export const PlanningBoard: FC = () => {
	const navigate = useNavigate();
	const { user } = useAuthStore();
	const currentUserId = user?.id;
	const [currentDate, setCurrentDate] = useState(new Date());
	// По умолчанию показываем планирование для текущего пользователя
	const [selectedUserId, setSelectedUserId] = useState<number | undefined>(
		currentUserId,
	);

	const [modalState, setModalState] = useState<{
		isOpen: boolean;
		date: Date;
		totalHours: number;
		editPlan?: { id: number; taskId: number; hours: number };
	}>({
		isOpen: false,
		date: new Date(),
		totalHours: 0,
	});

	// Вычисляем начало текущей недели (понедельник)
	const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
	const endDate = addDays(startDate, 6); // Воскресенье

	const startDateStr = format(startDate, "yyyy-MM-dd");
	const endDateStr = format(endDate, "yyyy-MM-dd");

	const {
		plans,
		isLoading,
		planningUsers,
		planningTasks,
		createPlan,
		isCreating,
		updatePlan,
		isUpdating,
		deletePlan,
	} = usePlanningBoard(selectedUserId, startDateStr, endDateStr);

	// Генерируем дни недели (Пн-Пт)
	const weekDays = useMemo(() => {
		return Array.from({ length: DAYS_IN_WEEK }).map((_, i) => {
			const date = addDays(startDate, i);
			const dateStr = format(date, "yyyy-MM-dd");
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const isPast = date < today;

			// Находим планы на этот день
			const dayPlans = plans.filter((p) => p.date === dateStr);

			// Считаем общую сумму часов за день
			const totalHours = dayPlans.reduce(
				(sum, plan) => sum + plan.hours,
				0,
			);

			return {
				date,
				dateStr,
				name: format(date, "EEEE", { locale: ru }), // Пн, Вт, и тд
				dayMonth: format(date, "d MMM", { locale: ru }),
				plans: dayPlans,
				totalHours,
				isPast,
			};
		});
	}, [startDate, plans]);

	const handlePrevWeek = () => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });

		// Нельзя переходить на недели раньше текущей
		if (startDate > currentWeekStart) {
			setCurrentDate((prev) => addDays(prev, -7));
		}
	};

	const handleNextWeek = () => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
		const nextWeekStart = addDays(currentWeekStart, 7);

		// Можно переходить только на 1 неделю вперёд от текущей
		if (currentDate < nextWeekStart) {
			setCurrentDate((prev) => addDays(prev, 7));
		}
	};

	const handleOpenModal = (
		date: Date,
		totalHours: number,
		editPlan?: { id: number; taskId: number; hours: number },
	) => {
		if (!selectedUserId) return;
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		if (date < today) return; // Запрет для прошедших дней
		setModalState({ isOpen: true, date, totalHours, editPlan });
	};

	const handleSavePlan = (taskId: number, hours: number) => {
		if (!selectedUserId) return;

		if (modalState.editPlan) {
			// Редактирование существующего плана
			updatePlan({
				planId: modalState.editPlan.id,
				request: { hours: hours },
			});
			// Закрываем модалку после редактирования
			setModalState((prev) => ({ ...prev, isOpen: false }));
		} else {
			// Создание нового плана
			createPlan(
				{
					task_id: taskId,
					user_id: selectedUserId,
					date: format(modalState.date, "yyyy-MM-dd"),
					hours,
				},
				{
					onSuccess: () => {
						setModalState((prev) => ({ ...prev, isOpen: false }));
					},
				},
			);
		}
	};

	// Вспомогательная функция для получения задачи по id
	const getTask = (taskId: number) =>
		planningTasks.find((task) => task.id === taskId);

	const handleTaskClick = (task: PlanningTaskOption) => {
		// Переходим на страницу задачи в её воркспейсе
		navigate(`/workspaces/workspace/${task.workspace_id}/tasks/${task.id}`);
	};

	const formatHoursMinutes = (hours: number) => {
		const wholeHours = Math.floor(hours);
		let minutes = Math.round((hours - wholeHours) * 60);
		let h = wholeHours;
		if (minutes === 60) {
			h += 1;
			minutes = 0;
		}
		if (minutes > 0) {
			return `${h} ч ${minutes} м`;
		}
		return `${h} ч`;
	};

	const userOptions = useMemo(
		() =>
			planningUsers.map((member) => ({
				value: member.id.toString(),
				label: `${member.name || member.email}${member.id === currentUserId ? " (Вы)" : ""}`,
			})),
		[planningUsers, currentUserId],
	);

	// Вычисляем, можно ли двигаться по неделям
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
	const canGoPrev = startDate > currentWeekStart;
	const nextWeekStart = addDays(currentWeekStart, 7);
	const canGoNext = currentDate < nextWeekStart;

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<div className={styles.controls}>
					<div className={styles.weekSelector}>
						<Button
							variant="ghost"
							size="sm"
							onClick={handlePrevWeek}
							disabled={!canGoPrev}
						>
							<ChevronLeft size={16} />
						</Button>
						<span className={styles.weekDates}>
							{format(startDate, "d MMM", { locale: ru })} -{" "}
							{format(endDate, "d MMM", { locale: ru })}
						</span>
						<Button
							variant="ghost"
							size="sm"
							onClick={handleNextWeek}
							disabled={!canGoNext}
						>
							<ChevronRight size={16} />
						</Button>
					</div>

					<div className={styles.userSelectorWrapper}>
						<Dropdown
							options={userOptions}
							value={selectedUserId?.toString() || ""}
							onChange={(val) => setSelectedUserId(Number(val))}
							placeholder="Выберите исполнителя"
						/>
					</div>
				</div>
			</div>

			{!selectedUserId ? (
				<div
					style={{
						textAlign: "center",
						padding: "40px",
						color: "var(--text-secondary)",
					}}
				>
					Выберите исполнителя, чтобы просмотреть или добавить
					планирование
				</div>
			) : isLoading ? (
				<div
					style={{
						padding: "40px",
						display: "flex",
						justifyContent: "center",
					}}
				>
					<Loader />
				</div>
			) : (
				<div className={styles.board}>
					{weekDays.map((day) => (
						<div
							key={day.dateStr}
							className={`${styles.column} ${day.isPast ? styles.past : ""}`}
						>
							<div className={styles.columnHeader}>
								<div className={styles.dayInfo}>
									<span
										className={styles.dayName}
										style={{ textTransform: "capitalize" }}
									>
										{day.name}
									</span>
									<span className={styles.dayDate}>
										{day.dayMonth}
									</span>
								</div>
								<div className={styles.dayProgress}>
									<div className={styles.progressBar}>
										<div
											className={`${styles.progressFill} ${day.totalHours >= 8 ? styles.overlimit : ""}`}
											style={{
												width: `${Math.min((day.totalHours / 8) * 100, 100)}%`,
											}}
										/>
									</div>
									<span className={styles.progressText}>
										{Number(day.totalHours.toFixed(2))} / 8
										ч
									</span>
								</div>
							</div>

							<div className={styles.columnContent}>
								{day.plans.map((plan) => {
									const task = getTask(plan.task_id);
									if (!task) return null;

									return (
										<div
											key={plan.id}
											className={styles.planCard}
											onClick={() =>
												handleTaskClick(task)
											}
											title="Нажмите, чтобы открыть задачу"
										>
											<div className={styles.taskHeader}>
												<div
													className={styles.taskTitle}
												>
													{task.title}
												</div>
												{(!plan.created_by ||
													plan.created_by.id ===
														currentUserId) && (
													<div
														className={
															styles.planActions
														}
													>
														<button
															className={
																styles.editBtn
															}
															onClick={(e) => {
																e.stopPropagation();
																handleOpenModal(
																	day.date,
																	day.totalHours,
																	{
																		id: plan.id,
																		taskId: plan.task_id,
																		hours: plan.hours,
																	},
																);
															}}
															title="Изменить время"
														>
															<Edit2 size={14} />
														</button>
														<button
															className={
																styles.deleteBtn
															}
															onClick={(e) => {
																e.stopPropagation();
																deletePlan(
																	plan.id,
																);
															}}
															title="Удалить план"
														>
															<Trash2 size={14} />
														</button>
													</div>
												)}
											</div>
											<div className={styles.planMeta}>
												<span
													className={
														styles.hoursBadge
													}
												>
													<Clock size={12} />
													{formatHoursMinutes(
														plan.hours,
													)}
												</span>
												{plan.created_by && (
													<span
														className={
															styles.authorBadge
														}
													>
														{plan.created_by.name ||
															plan.created_by
																.email}
													</span>
												)}
											</div>
										</div>
									);
								})}

								{!day.isPast && day.totalHours < 8 && (
									<button
										className={styles.addPlanBtn}
										onClick={() =>
											handleOpenModal(
												day.date,
												day.totalHours,
											)
										}
									>
										<Plus size={16} /> Добавить
									</button>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			{selectedUserId && (
				<PlanTaskModal
					isOpen={modalState.isOpen}
					onClose={() =>
						setModalState((prev) => ({ ...prev, isOpen: false }))
					}
					onSave={handleSavePlan}
					tasks={planningTasks}
					date={modalState.date}
					currentTotalHours={modalState.totalHours}
					isSaving={isCreating || isUpdating}
					editPlan={modalState.editPlan}
				/>
			)}
		</div>
	);
};
