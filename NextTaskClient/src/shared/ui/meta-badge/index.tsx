import { FC, HTMLAttributes, ReactNode } from "react";
import styles from "./index.module.css";

type MetaBadgeProps = HTMLAttributes<HTMLSpanElement> & {
	icon?: ReactNode;
	emphasis?: boolean;
	children: ReactNode;
};

const MetaBadge: FC<MetaBadgeProps> = ({ icon, emphasis = false, children, className, ...rest }) => {
	const classes = [styles.badge, emphasis ? styles.emphasis : "", className]
		.filter(Boolean)
		.join(" ");

	return (
		<span className={classes} {...rest}>
			{icon && <span className={styles.icon}>{icon}</span>}
			<span className={styles.content}>{children}</span>
		</span>
	);
};

export default MetaBadge;
