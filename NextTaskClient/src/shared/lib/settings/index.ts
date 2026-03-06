export const NOTIFICATION_SETTINGS_STORAGE_KEY =
	"nexttask:notification-settings";

export interface NotificationSettingsState {
	emailNotifications: boolean;
	pushNotifications: boolean;
}

export interface PersistedUserSettings {
	theme?: "light" | "dark";
	notifications: NotificationSettingsState;
	hotkeys: {
		openSettings: string;
		openProfile: string;
		openPlanning: string;
		openChat: string;
	};
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsState = {
	emailNotifications: true,
	pushNotifications: false,
};

export const DEFAULT_HOTKEY_SETTINGS = {
	openSettings: "Ctrl+Shift+/",
	openProfile: "Ctrl+Shift+P",
	openPlanning: "Ctrl+Shift+L",
	openChat: "Ctrl+Shift+C",
};

export const DEFAULT_USER_SETTINGS: PersistedUserSettings = {
	theme: undefined,
	notifications: DEFAULT_NOTIFICATION_SETTINGS,
	hotkeys: DEFAULT_HOTKEY_SETTINGS,
};

export const readStoredSettings = <T>(key: string, fallback: T): T => {
	if (typeof window === "undefined") {
		return fallback;
	}

	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return fallback;
		return { ...fallback, ...JSON.parse(raw) };
	} catch {
		return fallback;
	}
};

export const writeStoredSettings = <T>(key: string, value: T) => {
	if (typeof window === "undefined") {
		return;
	}

	try {
		window.localStorage.setItem(key, JSON.stringify(value));
	} catch {}
};

export const normalizeHotkey = (value: string) =>
	value
		.split("+")
		.map((part) => part.trim())
		.filter(Boolean)
		.map((part) => {
			const lower = part.toLowerCase();
			if (lower === "control" || lower === "ctrl") return "Ctrl";
			if (lower === "shift") return "Shift";
			if (lower === "alt" || lower === "option") return "Alt";
			if (lower === "meta" || lower === "cmd" || lower === "command")
				return "Meta";
			if (part.length === 1) return part.toUpperCase();
			return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
		})
		.join("+");

export const eventToHotkey = (event: KeyboardEvent) => {
	const parts: string[] = [];
	if (event.ctrlKey) parts.push("Ctrl");
	if (event.shiftKey) parts.push("Shift");
	if (event.altKey) parts.push("Alt");
	if (event.metaKey) parts.push("Meta");

	const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
	if (!["Control", "Shift", "Alt", "Meta"].includes(key)) {
		parts.push(key);
	}

	return normalizeHotkey(parts.join("+"));
};

export const applyUserSettings = (
	settings?: Partial<PersistedUserSettings>,
) => {
	if (typeof window === "undefined" || !settings) {
		return;
	}

	if (settings.theme === "light" || settings.theme === "dark") {
		window.localStorage.setItem("nexttask:theme", settings.theme);
		document.documentElement.setAttribute("data-theme", settings.theme);
	}

	if (settings.notifications) {
		writeStoredSettings(NOTIFICATION_SETTINGS_STORAGE_KEY, {
			...DEFAULT_NOTIFICATION_SETTINGS,
			...settings.notifications,
		});
	}
};

export const collectCurrentUserSettings = (): PersistedUserSettings => ({
	theme:
		typeof window !== "undefined"
			? ((window.localStorage.getItem("nexttask:theme") as
					| "light"
					| "dark"
					| null) ?? undefined)
			: undefined,
	notifications: readStoredSettings(
		NOTIFICATION_SETTINGS_STORAGE_KEY,
		DEFAULT_NOTIFICATION_SETTINGS,
	),
	hotkeys: DEFAULT_HOTKEY_SETTINGS,
});
