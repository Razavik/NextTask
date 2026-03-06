import { FC } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import type { Task } from "@shared/types/task";
import styles from "./index.module.css";

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
