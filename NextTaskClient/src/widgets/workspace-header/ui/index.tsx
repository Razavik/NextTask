import { FC, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import styles from "./index.module.css";

interface WorkspaceHeaderProps {
	title: string;
	onBack: () => void;
	titleIcon?: ReactNode;
	backTitle?: string;
	rightElement?: ReactNode;
}

const WorkspaceHeader: FC<WorkspaceHeaderProps> = ({
	title,
	onBack,
	titleIcon,
	backTitle,
	rightElement,
}) => {
	return (
		<div className={styles.header}>
			<button
				onClick={onBack}
				className={styles.backBtn}
				title={backTitle || "Назад"}
				type="button"
			>
				<ArrowLeft size={20} />
			</button>
			<div className={styles.titleSection}>
				{titleIcon}
				<h1 className={styles.title}>{title}</h1>
			</div>
			{rightElement && (
				<div className={styles.rightSection}>{rightElement}</div>
			)}
		</div>
	);
};

export default WorkspaceHeader;
