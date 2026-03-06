import { create } from "zustand";
import { LAST_ACTIVE_CHAT_STORAGE_KEY } from "@shared/constants/chat";

export interface User {
	id: number;
	email: string;
	name?: string;
	position?: string;
	avatar?: string;
	token?: string;
	role?: "admin" | "user";
}

interface AuthState {
	user: User | null;
	token: string | null;
	login: (token: string) => void;
	setUser: (user: User) => void;
	updateUserProfile: (profile: Partial<User>) => void;
	logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
	user: JSON.parse(localStorage.getItem("user") || "null"),
	token: localStorage.getItem("token"),
	login: (token: string) => {
		localStorage.setItem("token", token);
		set({ token });
	},
	setUser: (user: User) => {
		localStorage.setItem("user", JSON.stringify(user));
		set({ user });
	},
	updateUserProfile: (profile: Partial<User>) => {
		set((state) => {
			if (!state.user) return state;
			const newUser = { ...state.user, ...profile };
			localStorage.setItem("user", JSON.stringify(newUser));
			return { user: newUser };
		});
	},
	logout: () => {
		try {
			Object.keys(localStorage).forEach((key) => {
				if (
					key === LAST_ACTIVE_CHAT_STORAGE_KEY ||
					key.startsWith(`${LAST_ACTIVE_CHAT_STORAGE_KEY}:`)
				) {
					localStorage.removeItem(key);
				}
			});
		} catch {}
		localStorage.removeItem("token");
		localStorage.removeItem("user");
		set({ user: null, token: null });
	},
}));
