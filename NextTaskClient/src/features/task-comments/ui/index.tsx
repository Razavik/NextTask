import { FC } from "react";
import { Clock, Edit2, MessageCircle, Trash2 } from "lucide-react";
import Button from "@shared/ui/button";
import ConfirmModal from "@shared/ui/confirm-modal";
import Loader from "@shared/ui/loader";
import styles from "./index.module.css";
import Textarea from "@shared/ui/textarea";
import glass from "@shared/styles/glass.module.css";
import { useTaskComments } from "@features/task-comments/model/useTaskComments";

interface TaskCommentsProps {
	taskId: number;
	workspaceId: number;
}

const TaskComments: FC<TaskCommentsProps> = ({ taskId }) => {
	const {
		PAGE_MORE,
		comments,
		newComment,
		setNewComment,
		isLoading,
		isSubmitting,
		confirmOpen,
		setConfirmOpen,
		setDeletingId,
		deletingLoading,
		editingId,
		editingValue,
		setEditingValue,
		editingLoading,
		hasMore,
		totalCount,
		loadedDescCount,
		isMoreLoading,
		currentUser,
		handleSubmit,
		loadMore,
		startEdit,
		cancelEdit,
		saveEdit,
		requestDeleteComment,
		handleDeleteComment,
		formatDateTime,
	} = useTaskComments(taskId);

	return (
		<div className={`${styles.comments} ${glass.glassSurface}`}>
			<div className={styles.header}>
				<MessageCircle size={18} />
				<h3 className={styles.title}>
					Комментарии ({totalCount ?? 0})
				</h3>
			</div>

			<form onSubmit={handleSubmit} className={styles.commentForm}>
				<div className={styles.commentFormContainer}>
					<Textarea
						value={newComment}
						onChange={(e) => setNewComment(e.target.value)}
						placeholder="Введите сообщение..."
						disabled={isSubmitting}
						autoGrow
						maxHeight={180}
						textareaClassName={styles.commentInput}
					/>
					<Button
						type="submit"
						disabled={isSubmitting || !newComment.trim()}
						className={styles.sendBtn}
						title="Отправить сообщение"
					>
						Отправить
					</Button>
				</div>
			</form>

			{hasMore &&
				!isLoading &&
				totalCount !== null &&
				totalCount - loadedDescCount > 0 && (
					<div className={styles.loadMore}>
						<Button
							onClick={() => void loadMore()}
							disabled={isMoreLoading}
							className={styles.loadMoreBtn}
						>
							{`Загрузить ещё (${Math.min(PAGE_MORE, Math.max(0, totalCount - loadedDescCount))})`}
						</Button>
					</div>
				)}

			<div className={styles.commentsList}>
				{isLoading && (
					<div className={styles.emptyState}>
						<Loader />
					</div>
				)}

				{comments.length > 0
					? comments.map((comment) => {
							const avatarInitial =
								(
									comment.author?.name ||
									comment.author?.email ||
									"?"
								)
									.trim()
									.charAt(0)
									.toUpperCase() || "?";
							const isAuthor =
								currentUser?.id === comment.author.id;
							const isEditingThis = editingId === comment.id;

							return (
								<div
									key={comment.id}
									className={styles.comment}
								>
									<div className={styles.avatar}>
										{comment.author?.avatar ? (
											<img
												src={comment.author.avatar}
												alt={comment.author.name}
												className={styles.avatarImage}
											/>
										) : (
											avatarInitial
										)}
									</div>
									<div className={styles.commentRight}>
										<div className={styles.commentHeader}>
											<div className={styles.commentMeta}>
												<span
													className={
														styles.authorName
													}
												>
													{comment.author.name ||
														comment.author.email ||
														""}
												</span>
												<span
													className={
														styles.commentTime
													}
												>
													<Clock size={12} />
													{formatDateTime(
														comment.created_at,
													)}
												</span>
											</div>
											{isAuthor && !isEditingThis && (
												<div className={styles.actions}>
													<button
														onClick={() =>
															startEdit(
																comment.id,
																comment.content,
															)
														}
														className={
															styles.editBtn
														}
														title="Редактировать комментарий"
													>
														<Edit2 size={14} />
													</button>
													<button
														onClick={() =>
															requestDeleteComment(
																comment.id,
															)
														}
														className={
															styles.deleteBtn
														}
														title="Удалить комментарий"
													>
														<Trash2 size={14} />
													</button>
												</div>
											)}
										</div>

										{isEditingThis ? (
											<div className={styles.editRow}>
												<Textarea
													value={editingValue}
													onChange={(e) =>
														setEditingValue(
															e.target.value,
														)
													}
													autoFocus
													disabled={editingLoading}
													onKeyDown={(e) => {
														if (
															e.key === "Enter" &&
															!e.shiftKey
														) {
															e.preventDefault();
															void saveEdit();
														}
														if (
															e.key === "Escape"
														) {
															e.preventDefault();
															cancelEdit();
														}
													}}
													autoGrow
													maxHeight={220}
													textareaClassName={
														styles.editInput
													}
													placeholder="Изменить комментарий"
												/>
												<div
													className={
														styles.editActions
													}
												>
													<Button
														onClick={() =>
															void saveEdit()
														}
														disabled={
															editingLoading ||
															!editingValue.trim()
														}
														className={
															styles.saveBtn
														}
													>
														Сохранить
													</Button>
													<Button
														onClick={() =>
															cancelEdit()
														}
														disabled={
															editingLoading
														}
														className={
															styles.cancelBtn
														}
													>
														Отменить
													</Button>
												</div>
											</div>
										) : (
											<div
												className={
													styles.commentContent
												}
											>
												{comment.content}
											</div>
										)}
									</div>
								</div>
							);
						})
					: !isLoading && (
							<div className={styles.emptyState}>
								<MessageCircle size={48} strokeWidth={1} />
								<p>Пока комментариев нет</p>
							</div>
						)}
			</div>

			<ConfirmModal
				open={confirmOpen}
				title="Удалить комментарий?"
				message="Это действие необратимо. Комментарий будет удалён."
				confirmLabel="Удалить"
				cancelLabel="Отмена"
				variant="danger"
				loading={deletingLoading}
				onConfirm={handleDeleteComment}
				onCancel={() => {
					setConfirmOpen(false);
					setDeletingId(null);
				}}
			/>
		</div>
	);
};

export default TaskComments;
