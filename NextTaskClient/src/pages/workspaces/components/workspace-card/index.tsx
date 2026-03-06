import { FC } from "react";
import { Link } from "react-router-dom";
import { Users, ListChecks } from "lucide-react";
import styles from "./index.module.css";
import glass from "@shared/styles/glass.module.css";
import type { WorkspaceMember } from "@shared/types/workspace";

export interface WorkspaceCardProps {
	id: number;
	name: string;
	description?: string | null;
	usersCount?: number;
	tasks_count?: number;
	members?: WorkspaceMember[];
}

const WorkspaceCard: FC<WorkspaceCardProps> = ({
	id,
	name,
	description,
	usersCount = 0,
	tasks_count = 0,
	members = [],
}) => {
	return (
		<Link
			to={`/workspaces/workspace/${id}`}
			className={`${styles.card} ${glass.glassSurface} ${styles.interactiveCard}`}
		>
			<div className={styles.header}>
				<h3 className={styles.title}>{name}</h3>
				{description && (
					<p className={styles.description} title={description}>
						{description}
					</p>
				)}
			</div>

			<div className={styles.footer}>
				<div className={styles.members}>
					{members.length > 0 ? (
						<div className={styles.avatarStack}>
							{members.slice(0, 3).map((member) => (
								<div
									key={member.id}
									className={styles.avatar}
									title={member.name || member.email}
								>
									{member.avatar ? (
										<img
											src={member.avatar}
											alt={member.name}
											className={styles.avatarImg}
										/>
									) : (
										(member.name || member.email)
											.charAt(0)
											.toUpperCase()
									)}
								</div>
							))}
							{members.length > 3 && (
								<div className={styles.avatarMore}>
									+{members.length - 3}
								</div>
							)}
						</div>
					) : (
						<span className={styles.statItem}>
							<Users size={14} /> {usersCount}
						</span>
					)}
				</div>

				<div className={styles.stats}>
					<span className={styles.statBadge}>
						<ListChecks size={14} /> {tasks_count}
					</span>
				</div>
			</div>
		</Link>
	);
};

export default WorkspaceCard;
