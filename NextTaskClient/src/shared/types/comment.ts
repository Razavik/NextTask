// Типы комментариев. Централизовано для всего фронтенда
// Комментарии в коде — на русском, согласно правилам проекта

export interface CommentAuthor {
	id: number;
	name?: string;
	email: string;
	avatar?: string;
}

export interface CommentItem {
	id: number;
	content: string;
	author_id: number; // для совместимости с прямым ответом бэкенда
	author?: CommentAuthor; // может прийти в расширенном ответе
	task_id: number;
	created_at?: string; // ISO
}

export interface CreateCommentRequest {
	content: string;
}

export interface CommentsQuery {
	limit?: number; // 1..100, по умолчанию 50
	offset?: number; // >=0, по умолчанию 0
	order?: "asc" | "desc"; // порядок сортировки на бэкенде
}
