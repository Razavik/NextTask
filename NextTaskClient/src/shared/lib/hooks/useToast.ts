import {
	useToastStore,
	createSuccessToast,
	createErrorToast,
	createWarningToast,
	createInfoToast,
	createMessageToast,
} from "@shared/model/toastStore";

export const useToast = () => {
	const addToast = useToastStore((state) => state.addToast);

	const showToast = (toast: Parameters<typeof addToast>[0]) => {
		addToast(toast);
	};

	const success = (title: string, message?: string, duration?: number) => {
		addToast(createSuccessToast(title, message, duration));
	};

	const error = (title: string, message?: string, duration?: number) => {
		addToast(createErrorToast(title, message, duration));
	};

	const warning = (title: string, message?: string, duration?: number) => {
		addToast(createWarningToast(title, message, duration));
	};

	const info = (title: string, message?: string, duration?: number) => {
		addToast(createInfoToast(title, message, duration));
	};

	const message = (
		title: string,
		messageText?: string,
		avatar?: string,
		onClick?: () => void,
		duration?: number,
	) => {
		addToast(
			createMessageToast(title, messageText, avatar, onClick, duration),
		);
	};

	return {
		showToast,
		success,
		error,
		warning,
		info,
		message,
	};
};
