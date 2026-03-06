export const WorkspaceRoleEnum = {
	owner: "owner",
	editor: "editor",
	reader: "reader",
} as const;

export type WorkspaceRole = typeof WorkspaceRoleEnum[keyof typeof WorkspaceRoleEnum];

export const ALL_WORKSPACE_ROLES: WorkspaceRole[] =
	Object.values(WorkspaceRoleEnum);

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
	[WorkspaceRoleEnum.owner]: "Владелец",
	[WorkspaceRoleEnum.editor]: "Редактор",
	[WorkspaceRoleEnum.reader]: "Читатель",
};