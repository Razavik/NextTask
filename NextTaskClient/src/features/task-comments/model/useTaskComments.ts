import { useEffect, useState } from "react";
import { useAuthStore } from "@entities/user";
import {
	useToastStore,
	createErrorToast,
	createSuccessToast,
} from "@shared/model/toastStore";
import { commentsService } from "@entities/comment";
import type { CommentItem } from "@shared/types/comment";

export type TaskComment = CommentItem & {
	author: {
		id: number;
		name: string;
		email: string;
		avatar?: string;
	};
};

const PAGE_INITIAL = 5;
const PAGE_MORE = 10;

const ISO_NO_TZ = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

const normalizeComment = (c: CommentItem): TaskComment => ({
	...c,
	created_at:
		typeof c.created_at === "string" && ISO_NO_TZ.test(c.created_at)
			? `${c.created_at}Z`
			: c.created_at,
	author: {
		id: c.author?.id ?? c.author_id,
		name: (c.author?.name ?? "") as string,
		email: (c.author?.email ?? "") as string,
		avatar: c.author?.avatar,
	},
});

export const useTaskComments = (taskId: number) => {
	const currentUser = useAuthStore((state) => state.user);
	const addToast = useToastStore((state) => state.addToast);

	const [comments, setComments] = useState<TaskComment[]>([]);
	const [newComment, setNewComment] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [deletingLoading, setDeletingLoading] = useState(false);

	const [editingId, setEditingId] = useState<number | null>(null);
	const [editingValue, setEditingValue] = useState("");
	const [editingLoading, setEditingLoading] = useState(false);

	const [loadedDescCount, setLoadedDescCount] = useState(0);
	const [isMoreLoading, setIsMoreLoading] = useState(false);
	const [hasMore, setHasMore] = useState(true);
	const [totalCount, setTotalCount] = useState<number | null>(null);

	const startEdit = (commentId: number, content: string) => {
		setEditingId(commentId);
		setEditingValue(content);
	};

	const cancelEdit = () => {
		setEditingId(null);
		setEditingValue("");
	};

	const saveEdit = async () => {
		if (editingId == null) return;
		const value = editingValue.trim();
		if (!value) {
			addToast(
				createErrorToast(
					"Ошибка",
					"Текст комментария не может быть пустым",
					2500,
				),
			);
			return;
		}
		try {
			setEditingLoading(true);
			const updated = await commentsService.update(editingId, {
				content: value,
			});
			setComments((prev) =>
				prev.map((c) =>
					c.id === editingId ? { ...c, content: updated.content } : c,
				),
			);
			setEditingId(null);
			setEditingValue("");
			addToast(
				createSuccessToast(
					"Комментарий обновлён",
					"Комментарий успешно обновлён",
					2000,
				),
			);
		} catch (error) {
			console.error("Failed to update comment:", error);
			addToast(
				createErrorToast(
					"Ошибка",
					"Не удалось обновить комментарий",
					3000,
				),
			);
		} finally {
			setEditingLoading(false);
		}
	};

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				setIsLoading(true);
				const [count, data] = await Promise.all([
					commentsService.countByTask(taskId),
					commentsService.fetchByTask(taskId, {
						limit: PAGE_INITIAL,
						offset: 0,
						order: "desc",
					}),
				]);
				if (!mounted) return;
				const normalizedDesc = data.map(normalizeComment);
				const asc = [...normalizedDesc].reverse();
				setComments(asc);
				setLoadedDescCount(data.length);
				setTotalCount(count);
				setHasMore(data.length < count);
			} catch (e) {
				console.error("Failed to fetch comments", e);
			} finally {
				if (mounted) setIsLoading(false);
			}
		})();
		return () => {
			mounted = false;
		};
	}, [taskId]);

	const loadMore = async () => {
		if (isMoreLoading || !hasMore) return;
		try {
			setIsMoreLoading(true);
			const data = await commentsService.fetchByTask(taskId, {
				limit: PAGE_MORE,
				offset: loadedDescCount,
				order: "desc",
			});
			const normalizedDesc = data.map(normalizeComment);
			const ascBatch = [...normalizedDesc].reverse();
			setComments((prev) => [...ascBatch, ...prev]);
			setLoadedDescCount((prev) => prev + data.length);
			const total = totalCount ?? 0;
			setHasMore(loadedDescCount + data.length < total);
		} catch (e) {
			console.error("Failed to load more comments", e);
		} finally {
			setIsMoreLoading(false);
		}
	};

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== "ArrowUp") return;
			if (editingId != null) return;
			if (newComment.trim().length > 0) return;
			const last = comments[comments.length - 1];
			if (last && currentUser && last.author.id === currentUser.id) {
				e.preventDefault();
				startEdit(last.id, last.content);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [comments, currentUser, editingId, newComment]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newComment.trim() || !currentUser) return;

		setIsSubmitting(true);
		try {
			const created = await commentsService.create(taskId, {
				content: newComment.trim(),
			});
			const withAuthor: TaskComment = {
				...created,
				author: {
					id: created.author?.id ?? currentUser.id,
					name:
						created.author?.name ??
						(currentUser.name || currentUser.email),
					email: created.author?.email ?? currentUser.email,
					avatar: created.author?.avatar ?? currentUser.avatar,
				},
			};
			setComments((prev) => [...prev, withAuthor]);
			setNewComment("");
			addToast(createSuccessToast("Успех", "Комментарий добавлен"));
		} catch (err) {
			addToast(
				createErrorToast("Ошибка", "Не удалось добавить комментарий"),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleDeleteComment = async () => {
		if (deletingId == null) return;
		try {
			setDeletingLoading(true);
			await commentsService.delete(deletingId);
			setComments((prev) => prev.filter((c) => c.id !== deletingId));
			setLoadedDescCount((prev) => Math.max(0, prev - 1));
			setTotalCount((prev) => (prev == null ? 0 : Math.max(0, prev - 1)));
			addToast(createSuccessToast("Успех", "Комментарий удалён"));
		} catch (error) {
			console.error("Failed to delete comment:", error);
			addToast(
				createErrorToast(
					"Ошибка",
					"Не удалось удалить комментарий",
					3500,
				),
			);
		} finally {
			setDeletingLoading(false);
			setConfirmOpen(false);
			setDeletingId(null);
		}
	};

	const requestDeleteComment = (commentId: number) => {
		setDeletingId(commentId);
		setConfirmOpen(true);
	};

	const formatDateTime = (dateStr?: string) => {
		if (!dateStr) return "только что";
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		if (diffMs < 0) return "только что";
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMins / 60);
		const diffDays = Math.floor(diffHours / 24);

		if (diffMins < 1) return "только что";
		if (diffMins < 60) return `${diffMins} мин назад`;
		if (diffHours < 24) return `${diffHours} ч назад`;
		if (diffDays < 7) return `${diffDays} дн назад`;
		return date.toLocaleDateString("ru-RU", {
			day: "numeric",
			month: "short",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	return {
		PAGE_MORE,
		comments,
		newComment,
		setNewComment,
		isLoading,
		isSubmitting,
		confirmOpen,
		setConfirmOpen,
		deletingId,
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
	};
};
