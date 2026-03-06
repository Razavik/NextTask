import { FC } from "react";
import { CalendarClock } from "lucide-react";
import type { Task } from "@shared/types/task";
import { TaskCard } from "../task-card";
import styles from "./index.module.css";

interface TasksSectionProps {
	title: string;
	tasks: Task[];
	variant?: "upcoming" | "overdue";
}

export const TasksSection: FC<TasksSectionProps> = ({
	title,
	tasks,
	variant = "upcoming",
}) => {
	if (tasks.length === 0) return null;

	return (
		<>
			<div className={styles.sectionHeader}>
				<h2 className={styles.sectionTitle}>
					<CalendarClock size={20} className={styles.sectionIcon} />
					{title}
				</h2>
			</div>
			<div className={styles.tasksGrid}>
				{tasks.map((task: Task) => (
					<TaskCard key={task.id} task={task} variant={variant} />
				))}
			</div>
		</>
	);
};
