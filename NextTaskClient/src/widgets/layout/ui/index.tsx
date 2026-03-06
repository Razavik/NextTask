import { FC, ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore, authService } from "@entities/user";
import BottomDock from "@widgets/bottom-dock/ui";
import styles from "./index.module.css";
import Loader from "@shared/ui/loader";

const Layout: FC<{ children: ReactNode }> = ({ children }) => {
	const navigate = useNavigate();
	const { user, setUser } = useAuthStore();
	const [isUserInitialized, setIsUserInitialized] = useState(false);

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
