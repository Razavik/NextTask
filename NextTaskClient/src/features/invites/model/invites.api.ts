import { apiService, ApiRoute } from "@shared/api";
import type {
	EmailInvite,
	IncomingInvite,
	InviteLinkItem,
} from "@shared/types/invite";

interface IncomingInvitesResponse {
	invites: IncomingInvite[];
}

interface EmailInvitesResponse {
	invites: EmailInvite[];
}

interface AcceptInviteResponse {
	workspace_id: number;
}

interface RevokeResponse {
	message: string;
}

export const getMyInvites = async (): Promise<IncomingInvite[]> => {
	const response = await apiService.get<IncomingInvitesResponse>(
		ApiRoute.MyInvites,
	);
	return response.invites;
};

export const acceptInvite = async (
	token: string,
): Promise<AcceptInviteResponse> =>
	apiService.post<AcceptInviteResponse>(ApiRoute.InviteAccept, undefined, {
		pathParams: { token },
	});

export const declineInvite = async (
	inviteId: number,
): Promise<RevokeResponse> =>
	apiService.post<RevokeResponse>(ApiRoute.InviteDecline, undefined, {
		pathParams: { inviteId },
	});

export const validateInvite = async (token: string): Promise<unknown> =>
	apiService.get<unknown>(ApiRoute.InviteValidate, {
		pathParams: { token },
	});

export const createWorkspaceInvite = async (
	workspaceId: number,
): Promise<InviteLinkItem> =>
	apiService.post<InviteLinkItem>(ApiRoute.WorkspaceInvites, undefined, {
		pathParams: { workspaceId },
	});

export const getWorkspaceInvites = async (
	workspaceId: number,
): Promise<InviteLinkItem[]> =>
	apiService.get<InviteLinkItem[]>(ApiRoute.WorkspaceInvites, {
		pathParams: { workspaceId },
	});

export const getWorkspaceEmailInvites = async (
	workspaceId: number,
): Promise<EmailInvite[]> => {
	const response = await apiService.get<EmailInvitesResponse>(
		ApiRoute.WorkspaceEmailInvites,
		{
			pathParams: { workspaceId },
		},
	);
	return response.invites;
};

export const revokeInvite = async (token: string): Promise<RevokeResponse> =>
	apiService.delete<RevokeResponse>(ApiRoute.InviteRevokeByToken, undefined, {
		pathParams: { token },
	});

export const revokeEmailInvite = async (
	inviteId: number,
): Promise<RevokeResponse> =>
	apiService.delete<RevokeResponse>(ApiRoute.InviteRevokeEmail, undefined, {
		pathParams: { inviteId },
	});
