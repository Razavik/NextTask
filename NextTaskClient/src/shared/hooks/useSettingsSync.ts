import { useCallback } from "react";
import { apiService } from "@shared/api/api.service";
import { ApiRoute } from "@shared/api/api.routes";
import { collectCurrentUserSettings } from "@shared/lib/settings";

export const useSettingsSync = () => {
	const syncSettings = useCallback(async (overrides?: Partial<ReturnType<typeof collectCurrentUserSettings>>) => {
		try {
			const current = collectCurrentUserSettings();
			
			// Deep merge for specific objects if needed, simple merge for others
			const nextSettings = {
				...current,
				...overrides,
			};

			if (overrides?.notifications) {
				nextSettings.notifications = {
					...current.notifications,
					...overrides.notifications,
				};
			}

			if (overrides?.hotkeys) {
				nextSettings.hotkeys = {
					...current.hotkeys,
					...overrides.hotkeys,
				};
			}

			await apiService.put(ApiRoute.ProfileMe, {
				settings: nextSettings,
			});
			
			return true;
		} catch (error) {
			console.error("Failed to sync settings", error);
			return false;
		}
	}, []);

	return { syncSettings };
};
