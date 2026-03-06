import { FC, ReactNode } from "react";
import styles from "./index.module.css";
import glass from "@shared/styles/glass.module.css";

export interface TabItem {
	id: string;
	label: string;
	icon?: ReactNode;
	disabled?: boolean;
	badge?: number | ReactNode; // Индикатор (число или произвольный узел)
}

interface TabNavigationProps {
	tabs: TabItem[];
	activeTab: string;
	onTabChange: (tabId: string) => void;
	className?: string;
}

const TabNavigation: FC<TabNavigationProps> = ({
	tabs,
	activeTab,
	onTabChange,
	className = "",
}) => {
	return (
		<div className={styles.tabsContainer}>
			<div
				className={`${styles.tabs} ${glass.glassSurface} ${className}`}
			>
				{tabs.map((tab) => {
					const hasBadge = (() => {
						if (tab.badge === undefined || tab.disabled)
							return false;
						return typeof tab.badge === "number"
							? tab.badge > 0
							: !!tab.badge;
					})();

					return (
						<button
							key={tab.id}
							onClick={() => !tab.disabled && onTabChange(tab.id)}
							className={`${styles.tab} ${activeTab === tab.id ? styles.active : ""} ${
								tab.disabled ? styles.disabled : ""
							}`}
							disabled={tab.disabled}
						>
							{tab.icon && (
								<span className={styles.icon}>{tab.icon}</span>
							)}
							<span className={styles.label}>{tab.label}</span>
							{hasBadge && (
								<span
									className={styles.badge}
									aria-label="Новые элементы"
								>
									{tab.badge}
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
};

export default TabNavigation;
