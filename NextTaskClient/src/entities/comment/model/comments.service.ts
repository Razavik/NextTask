import api from "@shared/api/axios";
import type { CommentItem, CreateCommentRequest, CommentsQuery } from "@shared/types/comment";

class CommentsService {
	// Получить список комментариев по задаче с пагинацией
	async fetchByTask(taskId: number, params?: CommentsQuery): Promise<CommentItem[]> {
		const { data } = await api.get<CommentItem[]>(`/tasks/${taskId}/comments`, {
			params: {
				limit: params?.limit ?? 50,
				offset: params?.offset ?? 0,
				order: params?.order,
			},
		});
		return data;
	}

	// Получить общее число комментариев по задаче
	async countByTask(taskId: number): Promise<number> {
		const { data } = await api.get<number>(`/tasks/${taskId}/comments/count`);
		return data;
	}

	// Создать комментарий в задаче
	async create(taskId: number, payload: CreateCommentRequest): Promise<CommentItem> {
		const { data } = await api.post<CommentItem>(`/tasks/${taskId}/comments`, payload);
		return data;
	}

	// Обновить содержимое комментария
	async update(commentId: number, payload: { content: string }): Promise<CommentItem> {
		const { data } = await api.patch<CommentItem>(`/comments/${commentId}`, payload);
		return data;
	}

	// Удалить комментарий
	async delete(commentId: number): Promise<void> {
		await api.delete(`/comments/${commentId}`);
	}
}

export const commentsService = new CommentsService();
