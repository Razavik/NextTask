import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@entities/user";
import {
	useToastStore,
	createErrorToast,
	createSuccessToast,
} from "@shared/model/toastStore";
import { tasksService } from "@entities/task";
import { useQueryClient } from "@tanstack/react-query";
import type { Task } from "@shared/types/task";

export interface Member {
	id: number;
	name: string;
	email?: string;
	position?: string;
	role?: string;
	title?: string;
	avatar?: string;
}

interface UseTaskSidebarOptions {
	task: Task;
	members: Member[];
	workspaceId: number;
	onTaskUpdated?: (task: Task) => void;
}

export const useTaskSidebar = ({
	task,
	members,
	workspaceId,
	onTaskUpdated,
}: UseTaskSidebarOptions) => {
	const currentUser = useAuthStore((state) => state.user);
	const addToast = useToastStore((state) => state.addToast);
	const queryClient = useQueryClient();

	const effectiveAssigneeIds = useMemo(
		() =>
			task.assignees_ids ??
			task.assignees?.map((assignee) => assignee.id) ??
			[],
		[task],
	);

	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [selectedIds, setSelectedIds] =
		useState<number[]>(effectiveAssigneeIds);

	useEffect(() => {
		if (isEditing) return;
		setSelectedIds(effectiveAssigneeIds);
	}, [effectiveAssigneeIds, isEditing]);

	const assignees = useMemo(() => {
		if (task.assignees && task.assignees.length > 0) {
			return task.assignees.map((assignee) => {
				const member = members.find((m) => m.id === assignee.id);
				const merged: Member = {
					id: assignee.id,
					name: (member?.name ??
						assignee.name ??
						assignee.email) as string,
					email: member?.email ?? assignee.email,
					position:
						member?.position ?? assignee.position ?? undefined,
					avatar: member?.avatar ?? assignee.avatar ?? undefined,
					role: member?.role,
					title: member?.title,
				};
				return merged;
			});
		}

		return effectiveAssigneeIds
			.map((id) => members.find((m) => m.id === id))
			.filter((member): member is Member => Boolean(member));
	}, [effectiveAssigneeIds, members, task.assignees]);

	const memberOptions = useMemo(
		() =>
			members.map((member) => ({
				id: member.id,
				name: member.name,
				email: member.email ?? "",
				position: member.position,
			})),
		[members],
	);

	const authorMember = useMemo(() => {
		if (task?.author?.id) {
			const foundById = members.find((m) => m.id === task.author!.id);
			if (foundById) {
				return {
					...foundById,
					position:
						foundById.position ??
						task.author?.position ??
						undefined,
					email: foundById.email ?? task.author?.email,
				};
			}
		}
		if (task?.author?.name) {
			const foundByName = members.find(
				(m) => m.name === task.author!.name,
			);
			if (foundByName) {
				return {
					...foundByName,
					position:
						foundByName.position ??
						task.author?.position ??
						undefined,
					email: foundByName.email ?? task.author?.email,
				};
			}
		}
		const owner = members.find((m) => m.id === task.owner_id);
		if (owner) return owner;
		if (task?.author?.name) {
			return {
				id: task.author.id,
				name: task.author.name,
				position: task.author.position ?? undefined,
				email: task.author.email,
				avatar: undefined,
			} as Member;
		}
		return null;
	}, [members, task.author, task.owner_id]);

	const handleSaveAssignees = useCallback(async () => {
		setIsSaving(true);
		try {
			const normalizedIds = Array.from(
				new Set(
					selectedIds.filter((id) =>
						members.some((member) => member.id === id),
					),
				),
			);
			const response = await tasksService.setTaskAssignees(
				task.id,
				normalizedIds,
			);
			queryClient.setQueryData<Task | undefined>(
				["task", workspaceId, task.id],
				(prev) => (prev ? { ...prev, ...response } : response),
			);
			addToast(
				createSuccessToast("Исполнители обновлены", undefined, 2500),
			);
			onTaskUpdated?.(response);
			setSelectedIds(normalizedIds);
			setIsEditing(false);
		} catch {
			addToast(
				createErrorToast("Ошибка", "Не удалось обновить исполнителей"),
			);
		} finally {
			setIsSaving(false);
		}
	}, [
		onTaskUpdated,
		queryClient,
		selectedIds,
		task.id,
		workspaceId,
		members,
		addToast,
	]);

	const handleSaveTime = useCallback(
		async (timeSpent: number) => {
			try {
				const response = await tasksService.updateTask(task.id, {
					time_spent: timeSpent,
				});
				queryClient.setQueryData<Task | undefined>(
					["task", workspaceId, task.id],
					(prev) => (prev ? { ...prev, ...response } : response),
				);
				onTaskUpdated?.(response);
			} catch {
				addToast(
					createErrorToast(
						"Ошибка",
						"Не удалось сохранить затраченное время",
					),
				);
			}
		},
		[task.id, workspaceId, queryClient, onTaskUpdated, addToast],
	);

	const selectedMembers = useMemo(
		() =>
			selectedIds
				.map((id) => members.find((member) => member.id === id))
				.filter((member): member is Member => Boolean(member)),
		[members, selectedIds],
	);

	return {
		currentUser,
		effectiveAssigneeIds,
		isEditing,
		setIsEditing,
		isSaving,
		selectedIds,
		setSelectedIds,
		assignees,
		memberOptions,
		authorMember,
		handleSaveAssignees,
		handleSaveTime,
		selectedMembers,
	};
};
