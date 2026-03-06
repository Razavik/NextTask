import { FC } from "react";
import { CalendarClock } from "lucide-react";
import { PlanningBoard } from "@features/planning-board";
import styles from "./index.module.css";

const PlanningPage: FC = () => {
	return (
		<div className={styles.container}>
			<header className={styles.header}>
				<h1 className={styles.title}>
					<CalendarClock size={24} />
					Планирование
				</h1>
				<p className={styles.subtitle}>
					Глобальный план загрузки исполнителей по задачам на неделю
				</p>
			</header>
			<PlanningBoard />
		</div>
	);
};

export default PlanningPage;
