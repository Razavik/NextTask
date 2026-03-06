import { FC, useEffect, useState } from "react";
import { profileService } from "@entities/user";
import {
	collectCurrentUserSettings,
	DEFAULT_NOTIFICATION_SETTINGS,
	NOTIFICATION_SETTINGS_STORAGE_KEY,
	type NotificationSettingsState,
	readStoredSettings,
	writeStoredSettings,
} from "@shared/lib/settings";
import styles from "./index.module.css";
import Switch from "@shared/ui/switch";

interface NotificationSwitchProps {
	title: string;
	description: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	caption?: string;
}

const NotificationSwitch: FC<NotificationSwitchProps> = ({
	title,
	description,
	checked,
	onChange,
	caption,
}) => {
	return (
		<div className={styles.notificationItem}>
			<div className={styles.notificationLabel}>
				<div className={styles.notificationTitle}>{title}</div>
				<div className={styles.notificationDescription}>
					{description}
				</div>
				{caption && (
					<div className={styles.notificationCaption}>{caption}</div>
				)}
			</div>
			<div className={styles.switchWrapper}>
				<Switch checked={checked} onChange={onChange} label="" />
			</div>
		</div>
	);
};

const SettingsNotifications: FC = () => {
	const [settings, setSettings] = useState<NotificationSettingsState>(
		DEFAULT_NOTIFICATION_SETTINGS,
	);

	useEffect(() => {
		setSettings(
			readStoredSettings(
				NOTIFICATION_SETTINGS_STORAGE_KEY,
				DEFAULT_NOTIFICATION_SETTINGS,
			),
		);
	}, []);

	useEffect(() => {
		writeStoredSettings(NOTIFICATION_SETTINGS_STORAGE_KEY, settings);
	}, [settings]);

	const handleEmailToggle = (checked: boolean) => {
		const next = { ...settings, emailNotifications: checked };
		setSettings(next);
		void profileService.updateSettings({
			...collectCurrentUserSettings(),
			notifications: next,
		});
	};

	const handlePushToggle = async (checked: boolean) => {
		if (!checked) {
			const next = { ...settings, pushNotifications: false };
			setSettings(next);
			void profileService.updateSettings({
				...collectCurrentUserSettings(),
				notifications: next,
			});
			return;
		}

		if (!("Notification" in window)) {
			setSettings((prev) => ({ ...prev, pushNotifications: false }));
			return;
		}

		if (Notification.permission === "granted") {
			const next = { ...settings, pushNotifications: true };
			setSettings(next);
			void profileService.updateSettings({
				...collectCurrentUserSettings(),
				notifications: next,
			});
			return;
		}

		if (Notification.permission === "denied") {
			setSettings((prev) => ({ ...prev, pushNotifications: false }));
			return;
		}

		const permission = await Notification.requestPermission();
		const next = {
			...settings,
			pushNotifications: permission === "granted",
		};
		setSettings((prev) => ({
			...prev,
			pushNotifications: permission === "granted",
		}));
		void profileService.updateSettings({
			...collectCurrentUserSettings(),
			notifications: next,
		});
	};

	const pushCaption = !("Notification" in window)
		? "Браузер не поддерживает системные уведомления"
		: Notification.permission === "denied"
			? "Доступ заблокирован в браузере"
			: Notification.permission === "granted"
				? "Системные уведомления разрешены"
				: "При включении будет запрошено разрешение браузера";

	return (
		<>
			<div className={styles.notificationGroup}>
				<NotificationSwitch
					title="Email-уведомления"
					description="Получать уведомления о задачах и упоминаниях на электронную почту"
					checked={settings.emailNotifications}
					onChange={handleEmailToggle}
				/>
				<NotificationSwitch
					title="Push-уведомления"
					description="Получать мгновенные уведомления в браузере"
					checked={settings.pushNotifications}
					onChange={handlePushToggle}
					caption={pushCaption}
				/>
			</div>
		</>
	);
};

export default SettingsNotifications;
