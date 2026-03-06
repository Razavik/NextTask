import { FC, ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore, authService } from "@entities/user";
import { useChatStore } from "@entities/chat";
import {
	DEFAULT_HOTKEY_SETTINGS,
	applyUserSettings,
	eventToHotkey,
} from "@shared/lib/settings";
import BottomDock from "@widgets/bottom-dock/ui";
import { useToastStore } from "@shared/model/toastStore";
import { useAppNotifications } from "@widgets/layout/model/useAppNotifications";
import styles from "./index.module.css";
import Loader from "@shared/ui/loader";

const Layout: FC<{ children: ReactNode }> = ({ children }) => {
	const navigate = useNavigate();
	const { user, setUser, token: authToken } = useAuthStore();
	const openWindow = useChatStore((state) => state.openWindow);
	const addToast = useToastStore((state) => state.addToast);
	const [isUserInitialized, setIsUserInitialized] = useState(false);
	const isAuthPage =
		/\/login/i.test(window.location.pathname) ||
		/\/register/i.test(window.location.pathname);

	useAppNotifications({
		authToken,
		isAuthPage,
		addToast,
	});

	useEffect(() => {
		const localToken = localStorage.getItem("token");
		if (!localToken) {
			navigate("/login");
			return;
		}

		if (isUserInitialized) {
			return;
		}

		const fetchUser = async () => {
			try {
				const userData = await authService.getCurrentUser();
				const profileData = await authService.getCurrentProfile();
				applyUserSettings(profileData.settings);
				setUser(userData);
			} catch (error) {
				console.error(
					"Failed to fetch user profile, logging out.",
					error,
				);
				authService.logout();
				navigate("/login");
			} finally {
				setIsUserInitialized(true);
			}
		};

		void fetchUser();
	}, [navigate, isUserInitialized, setUser]);

	useEffect(() => {
		const handleHotkeys = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const isTypingTarget =
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable;

			if (isTypingTarget) {
				return;
			}

			const pressed = eventToHotkey(event);

			if (pressed === DEFAULT_HOTKEY_SETTINGS.openSettings) {
				event.preventDefault();
				navigate("/settings");
				return;
			}

			if (pressed === DEFAULT_HOTKEY_SETTINGS.openProfile) {
				event.preventDefault();
				navigate("/profile/general");
				return;
			}

			if (pressed === DEFAULT_HOTKEY_SETTINGS.openPlanning) {
				event.preventDefault();
				navigate("/planning");
				return;
			}

			if (pressed === DEFAULT_HOTKEY_SETTINGS.openChat) {
				event.preventDefault();
				openWindow();
			}
		};

		window.addEventListener("keydown", handleHotkeys);
		return () => window.removeEventListener("keydown", handleHotkeys);
	}, [navigate, openWindow]);

	if (!user) {
		return <Loader />;
	}

	return (
		<>
			<main className={styles.mainContent}>{children}</main>
			<BottomDock user={user} />
		</>
	);
};

export default Layout;
