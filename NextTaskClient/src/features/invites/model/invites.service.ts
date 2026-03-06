import api from "@shared/api/axios";
import type { IncomingInvite, EmailInvite, InviteLinkItem } from "@shared/types/invite";

/**
 * Принять приглашение по токену. Возвращает { workspace_id: number }
 */
export const createWorkspaceInvite = async (
	workspaceId: number,
	expiresHours: number = 24
): Promise<{
	invite_url: string;
	invite_token: string;
	workspace_id: number;
	expires_at?: string;
}> => {
	const { data } = await api.post(
		`/invites/workspaces/${workspaceId}/invites`,
		undefined,
		{
			params: { expires_hours: expiresHours },
		}
	);
	return data;
};

export const getWorkspaceInvites = async (workspaceId: number) => {
  const { data } = await api.get<InviteLinkItem[]>(
    `/invites/workspaces/${workspaceId}/invites`
  );
  return data;
};

export const revokeInvite = async (token: string) => {
  await api.delete(`/invites/revoke/${token}`);
};

export const acceptInvite = async (
	token: string
): Promise<{ workspace_id: number }> => {
	const { data } = await api.post<{ workspace_id: number }>(
		`/invites/join/${token}`
	);
	return data;
};

/**
 * Провалидировать приглашение по токену и получить информацию для экрана приглашения.
 * Используем общий axios-инстанс с baseURL на FastAPI, чтобы не ходить на Vite и не получать index.html.
 */
export const validateInvite = async (token: string): Promise<any> => {
    const { data } = await api.get(`/invites/validate/${token}`);
    return data;
};

/**
 * Входящие приглашения текущего пользователя (профиль)
 */
export const getMyInvites = async (): Promise<IncomingInvite[]> => {
  const { data } = await api.get<IncomingInvite[]>(`/me/invites`);
  return data;
};

export const declineInvite = async (inviteId: number): Promise<void> => {
  await api.post(`/invites/${inviteId}/decline`);
};

/**
 * Email-приглашения (workspace-scope, отправленные владельцем)
 */
export const getWorkspaceEmailInvites = async (workspaceId: number): Promise<EmailInvite[]> => {
  const { data } = await api.get<EmailInvite[]>(`/workspaces/${workspaceId}/email-invites`);
  return data;
};

export const resendEmailInvite = async (inviteId: number): Promise<void> => {
  await api.post(`/email-invites/${inviteId}/resend`);
};

export const revokeEmailInvite = async (inviteId: number): Promise<void> => {
  await api.delete(`/email-invites/${inviteId}`);
};
