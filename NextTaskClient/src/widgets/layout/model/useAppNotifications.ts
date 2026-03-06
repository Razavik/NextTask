import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { chatService } from "@entities/chat";
import { createMessageToast } from "@shared/model/toastStore";

interface TaskAssignedEvent {
	type: "task_assigned";
	task: {
		id: number;
		title: string;
		workspace_id: number;
	};
	assigned_by?: {
		id: number;
		name?: string;
		email?: string;
		avatar?: string;
	};
}

interface WorkspaceInvitedEvent {
	type: "workspace_invited";
	invite: {
		id: number;
		token: string;
		workspace: {
			id: number;
			name: string;
		};
		inviter?: {
			name?: string;
			email?: string;
			avatar?: string;
		};
		expires_at?: string | null;
		status: "pending" | "accepted" | "declined" | "expired";
	};
}

interface WorkspaceInviteRevokedEvent {
	type: "workspace_invite_revoked";
	invite: {
		id: number;
		token: string;
		workspace: {
			id: number;
			name: string;
		};
		status: "revoked" | "expired" | "declined" | "accepted";
	};
}

interface WorkspaceInviteStatusChangedEvent {
	type: "workspace_invite_status_changed";
	invite: {
		id: number;
		email: string;
		workspace: {
			id: number;
			name: string;
		};
		status: "accepted" | "declined" | "revoked" | "expired" | "pending";
	};
}

interface WorkspaceMemberRemovedEvent {
	type: "workspace_member_removed";
	workspace: {
		id: number;
		name: string;
	};
}

interface UseAppNotificationsOptions {
	authToken: string | null;
	isAuthPage: boolean;
	addToast: (toast: ReturnType<typeof createMessageToast>) => void;
}

export const useAppNotifications = ({
	authToken,
	isAuthPage,
	addToast,
}: UseAppNotificationsOptions) => {
	const queryClient = useQueryClient();

	useEffect(() => {
		const token = localStorage.getItem("token") || "";

		if (!token || !authToken || isAuthPage) {
			return;
		}

		chatService.connect(token);
		let redirectTimeout: number | undefined;

		const off = chatService.onMessage((msg) => {
			const eventType =
				typeof msg === "object" && msg && "type" in msg
					? (msg as { type?: string }).type
					: "new_message";

			if (eventType === "task_assigned") {
				const payload = msg as unknown as TaskAssignedEvent;
				const assignerName =
					payload.assigned_by?.name ||
					payload.assigned_by?.email ||
					"Пользователь";
				addToast(
					createMessageToast(
						"Назначение на задачу",
						`${assignerName} назначил вас на задачу «${payload.task.title}»`,
						payload.assigned_by?.avatar,
						() => {
							window.location.href = `/workspaces/workspace/${payload.task.workspace_id}/tasks/${payload.task.id}`;
						},
						7000,
					),
				);
				return;
			}

			if (eventType === "workspace_invited") {
				const payload = msg as unknown as WorkspaceInvitedEvent;
				const inviterName =
					payload.invite.inviter?.name ||
					payload.invite.inviter?.email ||
					"Пользователь";
				queryClient.invalidateQueries({ queryKey: ["myInvites"] });
				addToast(
					createMessageToast(
						"Приглашение в пространство",
						`${inviterName} пригласил вас в пространство «${payload.invite.workspace.name}»`,
						payload.invite.inviter?.avatar,
						() => {
							window.location.href = "/profile/invites";
						},
						7000,
					),
				);
				return;
			}

			if (eventType === "workspace_invite_revoked") {
				const payload = msg as unknown as WorkspaceInviteRevokedEvent;
				queryClient.invalidateQueries({ queryKey: ["myInvites"] });
				addToast(
					createMessageToast(
						"Приглашение отозвано",
						`Приглашение в пространство «${payload.invite.workspace.name}» было удалено`,
						undefined,
						() => {
							window.location.href = "/profile/invites";
						},
						5000,
					),
				);
				return;
			}

			if (eventType === "workspace_invite_status_changed") {
				const payload =
					msg as unknown as WorkspaceInviteStatusChangedEvent;
				queryClient.invalidateQueries({
					queryKey: [
						"workspaceEmailInvites",
						payload.invite.workspace.id,
					],
				});
				if (payload.invite.status === "accepted") {
					queryClient.invalidateQueries({
						queryKey: [
							"workspace",
							payload.invite.workspace.id,
							"members",
						],
					});
				}
				return;
			}

			if (eventType === "workspace_member_removed") {
				const payload = msg as unknown as WorkspaceMemberRemovedEvent;
				queryClient.invalidateQueries({ queryKey: ["workspaces"] });
				queryClient.invalidateQueries({
					queryKey: ["workspace", payload.workspace.id, "members"],
				});
				queryClient.removeQueries({
					queryKey: ["workspace", payload.workspace.id],
				});
				addToast(
					createMessageToast(
						"Исключение из пространства",
						`Вас исключили из пространства «${payload.workspace.name}»`,
						undefined,
						() => {
							window.location.href = "/workspaces";
						},
						7000,
					),
				);
				if (
					window.location.pathname.startsWith(
						`/workspaces/workspace/${payload.workspace.id}`,
					)
				) {
					redirectTimeout = window.setTimeout(() => {
						window.location.href = "/workspaces";
					}, 1800);
				}
			}
		});

		return () => {
			if (redirectTimeout) {
				window.clearTimeout(redirectTimeout);
			}
			off?.();
		};
	}, [addToast, authToken, isAuthPage, queryClient]);
};
