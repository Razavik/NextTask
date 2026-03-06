import { FC } from "react";
import styles from "./index.module.css";
import ThemeSettings from "./components/theme-settings";
import SettingsNotifications from "./components/settings-notifications";

interface SectionProps {
	title: string;
	description: string;
	children: React.ReactNode;
}

const Section: FC<SectionProps> = ({ title, description, children }) => {
	return (
		<section className={styles.section}>
			<div className={styles.sectionHeader}>
				<h2 className={styles.sectionTitle}>{title}</h2>
				<p className={styles.sectionDescription}>{description}</p>
			</div>
			{children}
		</section>
	);
};

const SettingsPage: FC = () => {
	return (
		<div className={styles.page}>
			<Section
				title="Тема"
				description="Выберите комфортную схему оформления и управляйте визуальными параметрами платформы."
			>
				<ThemeSettings />
			</Section>
			<Section
				title="Уведомления"
				description="Настройте способы оповещения о событиях в рабочих пространствах"
			>
				<SettingsNotifications />
			</Section>
		</div>
	);
};

export default SettingsPage;
