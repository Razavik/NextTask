import { FC } from "react";
import { Link, Outlet } from "react-router-dom";
import styles from "./index.module.css";

const Main: FC = () => {
	return (
		<div className={styles.wrapper}>
			<header className={styles.header}>
				<h1 className={styles.logo}>NextTask</h1>
				<nav>
					<Link to="/workspaces">Workspaces</Link>
				</nav>
			</header>
			<Outlet />
		</div>
	);
};

export default Main;
