import "@app/App.css";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "@app/routes";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@app/providers/queryClient";
import ToastContainer from "@shared/ui/toast-container";
import ChatContainer from "@widgets/chat-container/ui";

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<BrowserRouter>
				<AppRoutes />
				<ToastContainer />
				<ChatContainer />
			</BrowserRouter>
		</QueryClientProvider>
	);
}

export default App;
