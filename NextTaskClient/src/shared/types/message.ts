// Типы для сообщений чата
export interface MessageAuthor {
	id: number;
	name?: string;
	email: string;
	avatar?: string;
}

export interface RepliedMessageRef {
	id: number;
	content: string;
	is_edited?: boolean;
	created_at: string;
	sender?: MessageAuthor;
}

export interface Message {
	id: number;
	sender_id: number;
	receiver_id?: number | null;
	chat_id?: number | null;
	content: string;
	is_read: number;
	is_edited?: boolean;
	is_pinned?: boolean;
	reply_to_id?: number | null;
	replied_message?: RepliedMessageRef | null;
	created_at: string;
	updated_at?: string | null;
	attachments?: string[];
	sender?: MessageAuthor;
	receiver?: MessageAuthor;
}

export interface MessageCreate {
	receiver_id?: number | null;
	chat_id?: number | null;
	content: string;
	attachments?: string[];
	reply_to_id?: number | null;
}

export interface MessageUpdate {
	content?: string;
	attachments?: string[];
	is_pinned?: boolean;
}

export interface ChatMember {
	id: number;
	user_id: number;
	chat_id: number;
	joined_at: string;
	user?: MessageAuthor;
}

export interface GroupChat {
	id: number;
	name?: string;
	is_group: boolean;
	created_at: string;
	members: ChatMember[];
}
