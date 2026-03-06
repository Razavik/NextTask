import React from "react";
import styles from "./index.module.css";
import glass from "@shared/styles/glass.module.css";

type Tone = "purple" | "blue" | "default" | "success" | "warning" | "danger";

interface DeltaInfo {
	value: number;
	positive: boolean;
}

interface StatCardProps {
	value: string | number;
	label: string;
	color?: Tone;
	icon?: React.ReactNode;
	delta?: DeltaInfo | null;
	loading?: boolean;
	onClick?: () => void;
	active?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
	value,
	label,
	color = "default",
	icon,
	delta,
	loading = false,
	onClick,
	active = false,
}) => {
	const cardClasses = `${styles.statCard} ${glass.glassSurface} ${styles[color]} ${
		loading ? styles.loading : ""
	} ${active ? styles.active : ""}`;

	return (
		<div
			className={cardClasses}
			onClick={onClick}
			style={onClick ? { cursor: "pointer" } : undefined}
		>
			{icon && <div className={styles.iconWrap}>{icon}</div>}
			<div className={styles.content}>
				<div className={styles.topRow}>
					<div className={styles.statValue}>{value}</div>
					{delta && (
						<span
							className={`${styles.delta} ${
								delta.positive
									? styles.deltaPositive
									: styles.deltaNegative
							}`}
						>
							{delta.positive ? "+" : "-"}
							{Math.abs(delta.value)}%
						</span>
					)}
				</div>
				<div className={styles.statLabel}>{label}</div>
			</div>
		</div>
	);
};

export default StatCard;
