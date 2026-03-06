import { FC } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { Task } from "@shared/types/task";
import styles from "./index.module.css";

const formatTime = (seconds: number): string => {
	const pad = (num: number) => num.toString().padStart(2, "0");
	if (seconds >= 3600) {
		const h = Math.floor(seconds / 3600);
		const m = Math.floor((seconds % 3600) / 60);
		const s = seconds % 60;
		return `${pad(h)}:${pad(m)}:${pad(s)}`;
	}
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${pad(m)}:${pad(s)}`;
};

interface TaskCardProps {
	task: Task;
	variant?: "upcoming" | "overdue";
}

export const TaskCard: FC<TaskCardProps> = ({ task, variant = "upcoming" }) => {
	const isOverdue = variant === "overdue";

	return (
		<Link
			key={task.id}
			to={`/workspaces/workspace/${task.workspace_id}/tasks/${task.id}`}
			className={isOverdue ? styles.overdueTaskCard : styles.taskCard}
		>
			<div className={styles.taskHeader}>
				<span className={styles.taskTitle}>{task.title}</span>
				<span
					className={`${styles.priority} ${styles[`priority_${task.priority}`]}`}
				>
					{task.priority}
				</span>
			</div>
			<div className={styles.timeSpent}>
				Затрачено: {formatTime(task.time_spent || 0)}
			</div>
			<div className={styles.taskFooter}>
				<span
					className={isOverdue ? styles.overdueDate : styles.taskDate}
				>
					{isOverdue ? "Просрочено: " : "Дедлайн: "}
					{new Date(task.due_date!).toLocaleDateString()}
				</span>
				<ChevronRight size={16} className={styles.arrow} />
			</div>
		</Link>
	);
};
