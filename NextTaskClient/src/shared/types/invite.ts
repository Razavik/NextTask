// Типы приглашений (централизовано)
// Все комментарии на русском согласно требованиям кодовой базы

export interface WorkspaceRef {
  id: number;
  name: string;
}

export interface UserRef {
  name: string;
  email: string;
}

// Входящее приглашение для текущего пользователя
export interface IncomingInvite {
  id: number;
  token: string;
  workspace: WorkspaceRef;
  inviter: UserRef;
  expires_at?: string;
  status: "pending" | "accepted" | "declined" | "expired";
}

// E-mail приглашение, отправленное из workspace (owner scope)
export interface EmailInvite {
  id: number;
  email: string;
  role?: "owner" | "editor" | "reader";
  created_at: string;
  expires_at?: string;
  status: "pending" | "revoked" | "expired" | "accepted";
}

// Ссылка-приглашение
export interface InviteLinkItem {
  invite_token: string;
  expires_at?: string;
  times_used: number;
  max_uses?: number;
}
