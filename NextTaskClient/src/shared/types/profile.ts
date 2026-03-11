import type { PersistedUserSettings } from "@shared/lib/settings";

export interface ProfileData {
	id?: number;
	email: string;
	name?: string;
	avatar?: string;
	position?: string;
	settings?: Partial<PersistedUserSettings>;
}

export interface ProfileUpdateRequest {
	name?: string;
	position?: string;
	avatar?: string;
}

export interface PasswordChangeRequest {
	current_password: string;
	new_password: string;
}

export type UserSettings = PersistedUserSettings;
export type NotificationSettings = PersistedUserSettings["notifications"];
export type HotkeySettings = PersistedUserSettings["hotkeys"];
