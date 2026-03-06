import api from "@shared/api/axios";

// Тип Workspace и WorkspaceMember теперь импортируются из централизованного файла типов
import type { Workspace, WorkspaceMember } from "@shared/types/workspace";

export interface CreateWorkspaceRequest {
	name: string;
	description?: string;
}

export interface UpdateWorkspaceRequest {
	name?: string;
	description?: string;
}

export interface InviteUserRequest {
	email: string;
	// Роль участника после принятия (опционально). Используем роли workspace: owner|editor|reader
	role?: "owner" | "editor" | "reader";
}

export interface WorkspaceResponse {
	workspace: Workspace;
	message?: string;
}

export interface WorkspacesResponse {
	workspaces: Workspace[];
}

export interface WorkspaceUsersResponse {
	users: WorkspaceMember[];
}

class WorkspacesService {
	async fetchWorkspaces(): Promise<Workspace[]> {
		const { data } = await api.get<Workspace[]>("/workspaces");
		return data;
	}

	async fetchWorkspace(id: number): Promise<Workspace> {
		const { data } = await api.get<Workspace>(`/workspaces/${id}`);
		return data;
	}

	async createWorkspace(request: CreateWorkspaceRequest): Promise<Workspace> {
		const { data } = await api.post<Workspace>("/workspaces", request);
		return data;
	}

	async updateWorkspace(
		id: number,
		request: UpdateWorkspaceRequest,
	): Promise<Workspace> {
		const { data } = await api.put<Workspace>(`/workspaces/${id}`, request);
		return data;
	}

	async deleteWorkspace(id: number): Promise<void> {
		await api.delete(`/workspaces/${id}`);
	}

	async fetchWorkspaceUsers(workspaceId: number): Promise<WorkspaceMember[]> {
		const { data } = await api.get<WorkspaceMember[]>(
			`/workspaces/${workspaceId}/members`,
		);
		return data;
	}

	async inviteUser(
		workspaceId: number,
		request: InviteUserRequest,
	): Promise<{ message: string }> {
		// Бэкенд: POST /workspaces/{id}/email-invites
		await api.post(`/workspaces/${workspaceId}/email-invites`, request);
		return { message: "Email-приглашение создано" };
	}

	async changeUserRole(
		workspaceId: number,
		userId: number,
		role: "owner" | "editor" | "reader",
	): Promise<void> {
		await api.patch(`/workspaces/${workspaceId}/members/${userId}/role`, {
			role,
		});
	}

	async removeUser(
		workspaceId: number,
		userId: number,
	): Promise<{ message: string }> {
		const { data } = await api.delete<{ message: string }>(
			`/workspaces/${workspaceId}/members/${userId}`,
		);
		return data;
	}
}

export const workspacesService = new WorkspacesService();
