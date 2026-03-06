import { createContext, useCallback, useEffect, useMemo, useState, type FC, type ReactNode } from "react";

export type Theme = "light" | "dark";

interface ThemeContextValue {
	theme: Theme;
	toggleTheme: () => void;
	setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "nexttask:theme";

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getPreferredTheme = (): Theme => {
	if (typeof window === "undefined") {
		return "dark";
	}

	const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
	if (stored === "light" || stored === "dark") {
		return stored;
	}

	const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
	return prefersDark ? "dark" : "light";
};

const applyThemeToDocument = (theme: Theme) => {
	if (typeof document === "undefined") {
		return;
	}
	document.documentElement.setAttribute("data-theme", theme);
};

const ThemeProvider: FC<{ children: ReactNode }> = ({ children }) => {
	const [theme, setThemeState] = useState<Theme>(() => getPreferredTheme());

	useEffect(() => {
		applyThemeToDocument(theme);
		try {
			window.localStorage.setItem(STORAGE_KEY, theme);
		} catch (error) {
			console.warn("[ThemeProvider] Failed to persist theme", error);
		}
	}, [theme]);

	useEffect(() => {
		const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
		if (!mediaQuery) {
			return;
		}

		const handler = (event: MediaQueryListEvent) => {
			const stored = window.localStorage.getItem(STORAGE_KEY);
			if (stored === null) {
				setThemeState(event.matches ? "dark" : "light");
			}
		};

		mediaQuery.addEventListener("change", handler);
		return () => mediaQuery.removeEventListener("change", handler);
	}, []);

	const setTheme = useCallback((next: Theme) => {
		setThemeState(next);
	}, []);

	const toggleTheme = useCallback(() => {
		setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
	}, []);

	const value = useMemo<ThemeContextValue>(
		() => ({ theme, toggleTheme, setTheme }),
		[theme, toggleTheme, setTheme]
	);

	return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export { STORAGE_KEY as THEME_STORAGE_KEY };
export default ThemeProvider;
