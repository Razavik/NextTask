import { FC, ReactNode } from "react";
import styles from "./index.module.css";

interface NotFoundCardProps {
	icon?: ReactNode;
	title: string;
	description?: string;
	align?: "center" | "left";
	children?: ReactNode; // экшены (кнопки, ссылки)
}

const NotFoundCard: FC<NotFoundCardProps> = ({
	icon,
	title,
	description,
	align = "center",
	children,
}) => {
	const alignClass = align === "left" ? styles.alignLeft : styles.alignCenter;

	return (
		<div className={styles.container}>
			<div className={`${styles.card} ${alignClass}`}>
				{icon && <div className={styles.icon}>{icon}</div>}
				<div className={styles.body}>
					<h2 className={styles.title}>{title}</h2>
					{description && <p className={styles.text}>{description}</p>}
					{children && <div className={styles.actions}>{children}</div>}
				</div>
			</div>
		</div>
	);
};

export default NotFoundCard;
