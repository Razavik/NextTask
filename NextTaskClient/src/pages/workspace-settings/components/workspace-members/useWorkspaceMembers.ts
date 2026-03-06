import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@entities/user";
import {
	useToastStore,
	createSuccessToast,
	createErrorToast,
} from "@shared/model/toastStore";
import {
	useWorkspaceMembersQuery,
	useInvalidateWorkspaceMembers,
	workspacesService,
} from "@entities/workspace";
import type { WorkspaceMember } from "@shared/types/workspace";
import { type WorkspaceRole, WORKSPACE_ROLE_LABELS } from "@shared/types/roles";

type ConfirmTarget =
	| { type: "role"; memberId: number; newRole: WorkspaceRole }
	| { type: "remove"; memberId: number }
	| null;

export const useWorkspaceMembers = (workspaceId: number) => {
	const currentUser = useAuthStore((state) => state.user);
	const addToast = useToastStore((state) => state.addToast);
	const queryClient = useQueryClient();
	const { data: members = [], isLoading } =
		useWorkspaceMembersQuery(workspaceId);
	const invalidateMembers = useInvalidateWorkspaceMembers(workspaceId);

	const [inviteEmail, setInviteEmail] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [isInviting, setIsInviting] = useState(false);
	const [showInviteForm, setShowInviteForm] = useState(false);
	const [activeDropdown, setActiveDropdown] = useState<number | null>(null);
	const [dropdownMode, setDropdownMode] = useState<"default" | "roles">(
		"default",
	);
	const rolePillRefs = useRef(new Map<number, HTMLDivElement>());

	const [confirmOpen, setConfirmOpen] = useState(false);
	const [confirmLoading, setConfirmLoading] = useState(false);
	const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

	const openDropdownForMember = (memberId: number) => {
		const el = rolePillRefs.current.get(memberId);
		if (!el) return;
		setDropdownMode("default");
		setActiveDropdown(memberId);
	};

	const handleInviteMember = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!inviteEmail.trim()) return;

		setIsInviting(true);
		try {
			await workspacesService.inviteUser(workspaceId, {
				email: inviteEmail.trim(),
			});
			addToast(
				createSuccessToast(
					"Приглашение отправлено",
					`Пользователь ${inviteEmail.trim()} приглашён в пространство`,
				),
			);
			await queryClient.invalidateQueries({
				queryKey: ["workspaceEmailInvites", workspaceId],
			});
			setInviteEmail("");
			setShowInviteForm(false);
		} catch (err) {
			const message =
				(err as any)?.response?.data?.detail ||
				(err instanceof Error
					? err.message
					: "Не удалось отправить приглашение");
			addToast(createErrorToast("Ошибка приглашения", message));
		} finally {
			setIsInviting(false);
		}
	};

	const handleChangeRole = async (
		memberId: number,
		newRole: WorkspaceRole,
	) => {
		try {
			const member = members.find((m) => m.id === memberId);
			const prevRole = member?.role as WorkspaceRole | undefined;
			const newRoleLabel = WORKSPACE_ROLE_LABELS[newRole];
			const prevRoleLabel = prevRole
				? WORKSPACE_ROLE_LABELS[prevRole]
				: undefined;

			await workspacesService.changeUserRole(
				workspaceId,
				memberId,
				newRole,
			);
			await invalidateMembers();
			setActiveDropdown(null);
			addToast(
				createSuccessToast(
					"Роль обновлена",
					`${member?.name ?? "Участник"}: ${
						prevRoleLabel ?? "текущая"
					} → ${newRoleLabel}`,
				),
			);
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "Произошла ошибка при смене роли";
			addToast(createErrorToast("Не удалось изменить роль", message));
		}
	};

	const handleRemoveMember = async (memberId: number) => {
		try {
			const member = members.find((m) => m.id === memberId);
			await workspacesService.removeUser(workspaceId, memberId);
			await invalidateMembers();
			addToast(
				createSuccessToast(
					"Участник исключён",
					`${member?.name ?? "Участник"} удален из пространства`,
				),
			);
		} catch (err) {
			const message =
				err instanceof Error
					? err.message
					: "Произошла ошибка при исключении";
			addToast(
				createErrorToast("Не удалось исключить участника", message),
			);
		}
	};

	const requestRoleChange = (memberId: number, newRole: WorkspaceRole) => {
		setConfirmTarget({ type: "role", memberId, newRole });
		setConfirmOpen(true);
	};

	const requestRemoveMember = (memberId: number) => {
		setConfirmTarget({ type: "remove", memberId });
		setConfirmOpen(true);
	};

	const confirmAction = async () => {
		if (!confirmTarget) return;
		setConfirmLoading(true);
		try {
			if (confirmTarget.type === "role") {
				await handleChangeRole(
					confirmTarget.memberId,
					confirmTarget.newRole,
				);
			} else if (confirmTarget.type === "remove") {
				await handleRemoveMember(confirmTarget.memberId);
			}
		} finally {
			setConfirmLoading(false);
			setConfirmOpen(false);
			setConfirmTarget(null);
		}
	};

	const cancelAction = () => {
		setConfirmOpen(false);
		setConfirmTarget(null);
	};

	const formatJoinDate = (dateStr?: string) => {
		if (!dateStr) return "-";
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return "сегодня";
		if (diffDays === 1) return "вчера";
		if (diffDays < 30) return `${diffDays} дн назад`;

		return date.toLocaleDateString("ru-RU", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	};

	// Закрытие dropdown при resize/scroll
	useEffect(() => {
		const closeDropdown = () => {
			setActiveDropdown(null);
			setDropdownMode("default");
		};

		window.addEventListener("resize", closeDropdown);
		window.addEventListener("scroll", closeDropdown);

		return () => {
			window.removeEventListener("resize", closeDropdown);
			window.removeEventListener("scroll", closeDropdown);
		};
	}, []);

	const trimmedQuery = searchQuery.trim();
	const filteredMembers = (members || []).filter((m: WorkspaceMember) =>
		trimmedQuery
			? (m.name || "").toLowerCase().includes(trimmedQuery.toLowerCase())
			: true,
	);

	// Вычисляемые данные для ConfirmModal
	const confirmTitle = !confirmTarget
		? "Подтвердите действие"
		: confirmTarget.type === "remove"
			? "Исключить участника из пространства?"
			: "Подтвердите смену роли";

	const confirmMessage = (() => {
		if (!confirmTarget) return undefined;
		const member = members.find((mm) => mm.id === confirmTarget.memberId);
		const name = member?.name ?? "Участник";
		if (confirmTarget.type === "remove") {
			return `${name} будет удален из пространства. Доступ к задачам и настройкам будет потерян.`;
		}
		const prevLabel = member
			? WORKSPACE_ROLE_LABELS[member.role as WorkspaceRole]
			: undefined;
		const nextLabel = WORKSPACE_ROLE_LABELS[confirmTarget.newRole];
		return `${name}: ${prevLabel ?? "текущая"} → ${nextLabel}`;
	})();

	const confirmLabel =
		confirmTarget?.type === "remove" ? "Удалить" : "Изменить";
	const confirmVariant: "danger" | "default" =
		confirmTarget?.type === "remove" ? "danger" : "default";

	return {
		currentUser,
		members,
		isLoading,
		filteredMembers,
		inviteEmail,
		setInviteEmail,
		searchQuery,
		setSearchQuery,
		isInviting,
		showInviteForm,
		setShowInviteForm,
		activeDropdown,
		setActiveDropdown,
		dropdownMode,
		setDropdownMode,
		rolePillRefs,
		confirmOpen,
		confirmLoading,
		confirmTarget,
		openDropdownForMember,
		handleInviteMember,
		requestRoleChange,
		requestRemoveMember,
		confirmAction,
		cancelAction,
		formatJoinDate,
		confirmTitle,
		confirmMessage,
		confirmLabel,
		confirmVariant,
	};
};
