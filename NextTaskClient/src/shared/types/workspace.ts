// Централизованные типы для рабочих пространств и участников

import type { WorkspaceRole } from "./roles";

export interface WorkspaceMember {
	id: number;
	name: string;
	email: string;
	role: WorkspaceRole;
	joined_at: string;
	avatar?: string;
	position?: string;
}

export interface Workspace {
	id: number;
	name: string;
	description?: string;
	tasks_count: number;
	users_count: number;
	role: WorkspaceRole; // роль текущего пользователя в пространстве
	owner_id?: number;
	created_at?: string;
	updated_at?: string;
	members?: WorkspaceMember[];
}

export interface WorkspaceSettingsForm {
	name: string;
	description: string;
}

// Можно расширять другими связанными типами (например, Invite, WorkspaceSettings и т.д.)
