import { FC } from "react";
import { useTheme } from "@shared/lib/hooks/useTheme";
import type { Theme } from "@app/providers/theme-provider";
import styles from "./index.module.css";

const ThemeSettings: FC = () => {
	const { theme, setTheme } = useTheme();

	const themeOptions: {
		value: Theme;
		title: string;
		description: string;
		previewClass: string;
	}[] = [
		{
			value: "light",
			title: "Светлая тема",
			description:
				"Классическая светлая палитра с высокой читаемостью и нейтральными оттенками.",
			previewClass: styles.themePreviewLight,
		},
		{
			value: "dark",
			title: "Тёмная тема",
			description:
				"Современный тёмный интерфейс с акцентными цветами и мягкими контрастами.",
			previewClass: styles.themePreviewDark,
		},
	];

	return (
		<>
			<div className={styles.themeLayout}>
				<div className={styles.themeOptions}>
					{themeOptions.map((option) => {
						const isActive = option.value === theme;
						return (
							<button
								key={option.value}
								type="button"
								onClick={() => setTheme(option.value)}
								className={`${styles.themeCard} ${isActive ? styles.themeCardActive : ""}`.trim()}
								aria-pressed={isActive}
							>
								<div
									className={`${styles.themePreview} ${option.previewClass}`.trim()}
									aria-hidden="true"
								/>
								<div className={styles.themeCardBody}>
									<span className={styles.themeCardTitle}>
										{option.title}
									</span>
									<span
										className={styles.themeCardDescription}
									>
										{option.description}
									</span>
								</div>
							</button>
						);
					})}
				</div>
			</div>
		</>
	);
};

export default ThemeSettings;
