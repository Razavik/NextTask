import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

// Получаем путь к текущему модулю и его директорию (замена для __dirname в ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		alias: {
			"@": resolve(__dirname, "./src"),
			"@app": resolve(__dirname, "./src/app"),
			"@shared": resolve(__dirname, "./src/shared"),
			"@entities": resolve(__dirname, "./src/entities"),
			"@features": resolve(__dirname, "./src/features"),
			"@widgets": resolve(__dirname, "./src/widgets"),
			"@pages": resolve(__dirname, "./src/pages"),
			"@assets": resolve(__dirname, "./src/shared/assets"),
			"@api": resolve(__dirname, "./src/shared/api"),
			"@config": resolve(__dirname, "./src/shared/config"),
			"@styles": resolve(__dirname, "./src/shared/styles"),
		},
	},
});
