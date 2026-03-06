import { createRoot } from "react-dom/client";
import App from "@app/App";
import ThemeProvider from "@app/providers/theme-provider";

createRoot(document.getElementById("root")!).render(
	<ThemeProvider>
		<App />
	</ThemeProvider>,
);
