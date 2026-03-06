import { FC } from "react";
import { Edit2, Trash2, X, Check } from "lucide-react";
import Button from "@shared/ui/button";
import Textarea from "@shared/ui/textarea";
import Input from "@shared/ui/input";
import styles from "../index.module.css";
import type { TaskTimeTrack } from "@shared/types/task";

interface TrackItemProps {
	track: TaskTimeTrack;
	currentUser: any;
	editingTrackId: number | null;
	editingComment: string;
	editingHours: string;
	editingMinutes: string;
	editingSeconds: string;
	setEditingComment: (val: string) => void;
	setEditingHours: (val: string) => void;
	setEditingMinutes: (val: string) => void;
	setEditingSeconds: (val: string) => void;
	handleSaveEdit: (trackId: number) => void;
	handleCancelEdit: () => void;
	handleEditTrack: (
		trackId: number,
		comment: string | null | undefined,
		timeSpent: number,
	) => void;
	handleDeleteTrack: (trackId: number, timeSpent: number) => void;
	formatTime: (seconds: number) => string;
}

export const TrackItem: FC<TrackItemProps> = ({
	track,
	currentUser,
	editingTrackId,
	editingComment,
	editingHours,
	editingMinutes,
	editingSeconds,
	setEditingComment,
	setEditingHours,
	setEditingMinutes,
	setEditingSeconds,
	handleSaveEdit,
	handleCancelEdit,
	handleEditTrack,
	handleDeleteTrack,
	formatTime,
}) => {
	const isEditing = editingTrackId === track.id;
	const isOwner =
		track.user_id === currentUser?.id ||
		(!track.user_id && track.user?.id === currentUser?.id);

	return (
		<div className={styles.trackItem}>
			<div className={styles.trackInfo}>
				<div className={styles.trackAuthor}>
					{track.user?.avatar ? (
						<img
							src={track.user.avatar}
							alt={track.user.name || track.user.email}
							className={styles.authorAvatar}
						/>
					) : (
						<div className={styles.authorAvatarPlaceholder}>
							{(track.user?.name || track.user?.email || "?")
								.charAt(0)
								.toUpperCase()}
						</div>
					)}
					<span className={styles.authorName}>
						{track.user?.name || track.user?.email || "Неизвестный"}
					</span>
				</div>
				<div className={styles.trackTime}>
					{formatTime(track.time_spent)}
				</div>
			</div>
			<div className={styles.trackComment}>
				{isEditing ? (
					<div className={styles.editCommentContainer}>
						<Textarea
							value={editingComment}
							onChange={(e) => setEditingComment(e.target.value)}
							placeholder="Комментарий..."
							textareaClassName={styles.editCommentTextarea}
							autoFocus
						/>
						<div className={styles.editTimeContainer}>
							<div className={styles.editTimeInputs}>
								<div className={styles.editTimeWrapper}>
									<Input
										type="number"
										min="0"
										value={editingHours}
										onChange={(e) =>
											setEditingHours(e.target.value)
										}
										placeholder="0"
										className={styles.editTimeInput}
									/>
									<span className={styles.timeUnit}>ч</span>
								</div>
								<div className={styles.editTimeWrapper}>
									<Input
										type="number"
										min="0"
										max="59"
										value={editingMinutes}
										onChange={(e) =>
											setEditingMinutes(e.target.value)
										}
										placeholder="0"
										className={styles.editTimeInput}
									/>
									<span className={styles.timeUnit}>м</span>
								</div>
								<div className={styles.editTimeWrapper}>
									<Input
										type="number"
										min="0"
										max="59"
										value={editingSeconds}
										onChange={(e) =>
											setEditingSeconds(e.target.value)
										}
										placeholder="0"
										className={styles.editTimeInput}
									/>
									<span className={styles.timeUnit}>с</span>
								</div>
							</div>
							<div className={styles.editCommentActions}>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleCancelEdit}
									className={styles.editCommentBtn}
								>
									<X size={14} />
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleSaveEdit(track.id)}
									className={styles.editCommentBtn}
								>
									<Check size={14} />
								</Button>
							</div>
						</div>
					</div>
				) : (
					<div className={styles.commentContainer}>
						<span>{track.comment || "Без комментария"}</span>
						<div className={styles.commentActions}>
							{isOwner && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										handleEditTrack(
											track.id,
											track.comment,
											track.time_spent,
										)
									}
									className={styles.editCommentBtn}
								>
									<Edit2 size={14} />
								</Button>
							)}
							{isOwner && (
								<Button
									variant="ghost"
									size="sm"
									onClick={() =>
										handleDeleteTrack(
											track.id,
											track.time_spent,
										)
									}
									className={styles.deleteCommentBtn}
								>
									<Trash2 size={14} />
								</Button>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
