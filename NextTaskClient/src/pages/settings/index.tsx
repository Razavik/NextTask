import { ChangeEvent, FC, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
	ArrowRight,
	Download,
	Keyboard,
	LogOut,
	Upload,
	RotateCcw,
	Shield,
	User,
} from "lucide-react";
import Button from "@shared/ui/button";
import { useToast } from "@shared/lib/hooks/useToast";
import { profileService, useAuthStore } from "@entities/user";
import { THEME_STORAGE_KEY } from "@app/providers/theme-provider";
import {
	applyUserSettings,
	collectCurrentUserSettings,
	DEFAULT_HOTKEY_SETTINGS,
	DEFAULT_NOTIFICATION_SETTINGS,
	NOTIFICATION_SETTINGS_STORAGE_KEY,
	writeStoredSettings,
} from "@shared/lib/settings";
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
	const navigate = useNavigate();
	const toast = useToast();
	const logout = useAuthStore((state) => state.logout);
	const user = useAuthStore((state) => state.user);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [isSavingSettings, setIsSavingSettings] = useState(false);

	useEffect(() => {
		const loadSettings = async () => {
			try {
				const profile = await profileService.getProfile();
				if (profile.settings) {
					applyUserSettings(profile.settings);
				}
			} catch {
				// no-op
			}
		};

		void loadSettings();
	}, []);

	const hotkeyItems: {
		key: keyof typeof DEFAULT_HOTKEY_SETTINGS;
		title: string;
		description: string;
		shortcut: string;
	}[] = [
		{
			key: "openSettings",
			title: "Открыть настройки",
			description: "Быстрый переход на страницу /settings",
			shortcut: DEFAULT_HOTKEY_SETTINGS.openSettings,
		},
		{
			key: "openProfile",
			title: "Открыть профиль",
			description: "Переход в настройки профиля",
			shortcut: DEFAULT_HOTKEY_SETTINGS.openProfile,
		},
		{
			key: "openPlanning",
			title: "Открыть планирование",
			description: "Открывает страницу планирования задач",
			shortcut: DEFAULT_HOTKEY_SETTINGS.openPlanning,
		},
		{
			key: "openChat",
			title: "Открыть чат",
			description: "Раскрывает окно чата поверх интерфейса",
			shortcut: DEFAULT_HOTKEY_SETTINGS.openChat,
		},
	];

	const syncSettingsToServer = async (
		overrides?: Partial<ReturnType<typeof collectCurrentUserSettings>>,
	) => {
		setIsSavingSettings(true);
		try {
			const current = collectCurrentUserSettings();
			await profileService.updateSettings({
				...current,
				...overrides,
				notifications: {
					...current.notifications,
					...overrides?.notifications,
				},
				hotkeys: {
					...current.hotkeys,
					...overrides?.hotkeys,
				},
			});
		} catch {
			toast.error("Ошибка", "Не удалось сохранить настройки на сервере");
		} finally {
			setIsSavingSettings(false);
		}
	};

	const handleExportSettings = () => {
		try {
			const payload = {
				exported_at: new Date().toISOString(),
				user: user
					? {
							id: user.id,
							email: user.email,
							name: user.name,
						}
					: null,
				theme: localStorage.getItem(THEME_STORAGE_KEY),
				notifications: JSON.parse(
					localStorage.getItem(NOTIFICATION_SETTINGS_STORAGE_KEY) ||
						"{}",
				),
				hotkeys: DEFAULT_HOTKEY_SETTINGS,
			};

			const blob = new Blob([JSON.stringify(payload, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = "nexttask-settings.json";
			link.click();
			URL.revokeObjectURL(url);
			toast.success(
				"Экспорт готов",
				"Настройки успешно сохранены в файл",
			);
		} catch {
			toast.error("Ошибка", "Не удалось экспортировать настройки");
		}
	};

	const handleResetLocalSettings = () => {
		try {
			localStorage.removeItem(THEME_STORAGE_KEY);
			localStorage.removeItem(NOTIFICATION_SETTINGS_STORAGE_KEY);
			void syncSettingsToServer({
				theme: undefined,
				notifications: DEFAULT_NOTIFICATION_SETTINGS,
				hotkeys: DEFAULT_HOTKEY_SETTINGS,
			});
			toast.success(
				"Локальные настройки сброшены",
				"Обновите страницу, чтобы применить системные значения",
			);
		} catch {
			toast.error("Ошибка", "Не удалось сбросить локальные настройки");
		}
	};

	const handleLogout = () => {
		logout();
		navigate("/login");
	};

	const handleOpenImport = () => {
		fileInputRef.current?.click();
	};

	const handleImportSettings = async (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		try {
			const content = await file.text();
			const parsed = JSON.parse(content) as {
				theme?: string;
				notifications?: Partial<typeof DEFAULT_NOTIFICATION_SETTINGS>;
			};

			if (parsed.theme === "light" || parsed.theme === "dark") {
				localStorage.setItem(THEME_STORAGE_KEY, parsed.theme);
				document.documentElement.setAttribute(
					"data-theme",
					parsed.theme,
				);
			}

			if (parsed.notifications) {
				writeStoredSettings(NOTIFICATION_SETTINGS_STORAGE_KEY, {
					...DEFAULT_NOTIFICATION_SETTINGS,
					...parsed.notifications,
				});
			}

			await syncSettingsToServer({
				theme:
					parsed.theme === "light" || parsed.theme === "dark"
						? parsed.theme
						: collectCurrentUserSettings().theme,
				notifications: parsed.notifications
					? {
							...DEFAULT_NOTIFICATION_SETTINGS,
							...parsed.notifications,
						}
					: collectCurrentUserSettings().notifications,
				hotkeys: DEFAULT_HOTKEY_SETTINGS,
			});

			toast.success(
				"Импорт выполнен",
				"Настройки применены. При необходимости обновите страницу.",
			);
		} catch {
			toast.error(
				"Ошибка импорта",
				"Файл настроек имеет неверный формат",
			);
		} finally {
			e.target.value = "";
		}
	};

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
			<Section
				title="Горячие клавиши"
				description="Настройте быстрые действия приложения и держите под рукой список сочетаний."
			>
				<div className={styles.hotkeyList}>
					{hotkeyItems.map((item) => (
						<div key={item.key} className={styles.hotkeyCard}>
							<div className={styles.hotkeyCardHeader}>
								<div className={styles.hotkeyIconWrap}>
									<Keyboard size={16} />
								</div>
								<div>
									<div className={styles.hotkeyTitle}>
										{item.title}
									</div>
									<div className={styles.hotkeyDescription}>
										{item.description}
									</div>
								</div>
							</div>
							<div className={styles.hotkeyHint}>
								Базовое сочетание: <kbd>{item.shortcut}</kbd>
							</div>
						</div>
					))}
				</div>
			</Section>
			<Section
				title="Аккаунт и приложение"
				description="Управляйте профилем, безопасностью входа и локальными данными приложения."
			>
				<div className={styles.actionsGrid}>
					<button
						type="button"
						className={styles.actionCard}
						onClick={() => navigate("/profile/general")}
					>
						<div className={styles.actionIconWrap}>
							<User size={18} />
						</div>
						<div className={styles.actionContent}>
							<span className={styles.actionTitle}>Профиль</span>
							<span className={styles.actionDescription}>
								Изменить имя, должность и аватар
							</span>
						</div>
						<ArrowRight size={16} className={styles.actionArrow} />
					</button>
					<button
						type="button"
						className={styles.actionCard}
						onClick={() => navigate("/profile/security")}
					>
						<div className={styles.actionIconWrap}>
							<Shield size={18} />
						</div>
						<div className={styles.actionContent}>
							<span className={styles.actionTitle}>
								Безопасность
							</span>
							<span className={styles.actionDescription}>
								Сменить пароль и проверить параметры доступа
							</span>
						</div>
						<ArrowRight size={16} className={styles.actionArrow} />
					</button>
				</div>

				<div className={styles.utilityPanel}>
					<div className={styles.utilityInfo}>
						<h3 className={styles.utilityTitle}>
							Локальные данные
						</h3>
						<p className={styles.utilityDescription}>
							Можно сохранить текущие пользовательские настройки в
							файл или очистить их локально в браузере.
						</p>
					</div>
					<div className={styles.utilityActions}>
						<Button
							type="button"
							variant="ghost"
							onClick={handleExportSettings}
							disabled={isSavingSettings}
						>
							<Download size={16} />
							Экспорт настроек
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={handleOpenImport}
							disabled={isSavingSettings}
						>
							<Upload size={16} />
							Импорт настроек
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={handleResetLocalSettings}
							disabled={isSavingSettings}
						>
							<RotateCcw size={16} />
							Сбросить локальные настройки
						</Button>
						<Button
							type="button"
							onClick={handleLogout}
							disabled={isSavingSettings}
						>
							<LogOut size={16} />
							Выйти из аккаунта
						</Button>
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept="application/json,.json"
						onChange={handleImportSettings}
						className={styles.hiddenInput}
					/>
				</div>
			</Section>
		</div>
	);
};

export default SettingsPage;
