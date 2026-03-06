import { FC, useState } from "react";
import styles from "./index.module.css";
import Switch from "@shared/ui/switch";

interface NotificationSwitchProps {
	title: string;
	description: string;
	defaultEnabled?: boolean;
}

const NotificationSwitch: FC<NotificationSwitchProps> = ({
	title,
	description,
	defaultEnabled = false,
}) => {
	const [checked, setChecked] = useState(defaultEnabled);

	return (
		<div className={styles.notificationItem}>
			<div className={styles.notificationLabel}>
				<div className={styles.notificationTitle}>{title}</div>
				<div className={styles.notificationDescription}>{description}</div>
			</div>
			<div className={styles.switchWrapper}>
				<Switch
					checked={checked}
					onChange={setChecked}
					label=""
				/>
			</div>
		</div>
	);
};

const SettingsNotifications: FC = () => {
	return (
		<>
			<div className={styles.notificationGroup}>
				<NotificationSwitch
					title="Email-уведомления"
					description="Получать уведомления о задачах и упоминаниях на электронную почту"
					defaultEnabled
				/>
				<NotificationSwitch
					title="Push-уведомления"
					description="Получать мгновенные уведомления в браузере"
				/>
			</div>
		</>
	);
};

export default SettingsNotifications;
