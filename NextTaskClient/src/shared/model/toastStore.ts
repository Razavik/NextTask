import { create } from "zustand";

export interface Toast {
	id: string;
	type: "success" | "error" | "warning" | "info" | "message";
	title: string;
	message?: string;
	duration?: number;
	timestamp: number;
	isRemoving?: boolean;
	avatar?: string;
	onClick?: () => void;
}

interface ToastState {
	toasts: Toast[];
	addToast: (toast: Omit<Toast, "id" | "timestamp">) => void;
	startRemoveToast: (id: string) => void;
	removeToast: (id: string) => void;
	clearAllToasts: () => void;
}

export const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	addToast: (toastData) => {
		const id =
			Date.now().toString() + Math.random().toString(36).substr(2, 9);
		const toast: Toast = {
			...toastData,
			id,
			timestamp: Date.now(),
			duration: toastData.duration || 5000,
		};
		set((state) => ({ toasts: [...state.toasts, toast] }));
	},
	startRemoveToast: (id) => {
		set((state) => ({
			toasts: state.toasts.map((t) =>
				t.id === id ? { ...t, isRemoving: true } : t,
			),
		}));
	},
	removeToast: (id) => {
		set((state) => ({
			toasts: state.toasts.filter((t) => t.id !== id),
		}));
	},
	clearAllToasts: () => set({ toasts: [] }),
}));

// Вспомогательные функции для создания разных типов уведомлений (теперь возвращают объекты для addToast)
export const createSuccessToast = (
	title: string,
	message?: string,
	duration?: number,
) => ({
	type: "success" as const,
	title,
	message,
	duration,
});

export const createErrorToast = (
	title: string,
	message?: string,
	duration?: number,
) => ({
	type: "error" as const,
	title,
	message,
	duration,
});

export const createWarningToast = (
	title: string,
	message?: string,
	duration?: number,
) => ({
	type: "warning" as const,
	title,
	message,
	duration,
});

export const createInfoToast = (
	title: string,
	message?: string,
	duration?: number,
) => ({
	type: "info" as const,
	title,
	message,
	duration,
});

export const createMessageToast = (
	title: string,
	message?: string,
	avatar?: string,
	onClick?: () => void,
	duration?: number,
) => ({
	type: "message" as const,
	title,
	message,
	avatar,
	onClick,
	duration: duration || 5000,
});
